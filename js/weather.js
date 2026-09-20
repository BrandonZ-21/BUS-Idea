// Weather lookup and categorization. This is the ONLY file that ever makes a
// network request, and the ONLY things it ever sends anywhere are: an
// approximate location (latitude/longitude rounded to 2 decimals), a place
// search string the owner typed in Settings, and date ranges. Sales figures,
// item names, and the restaurant's name are never sent. All requests go to
// Open-Meteo (open-meteo.com), which is free for non-commercial use and
// needs no API key or account.

// ---- Category thresholds -----------------------------------------------
// Change the numbers here to retune how days get labeled. Precipitation
// values are in millimeters per day, temperature in degrees Celsius, because
// that's what we store internally (see "Storage units" below) -- the
// owner's chosen display units only affect what's shown on screen.
//
// Plain-language reasoning for the defaults:
//  - "Dry" allows a trace of measurement noise (up to 0.2mm) without calling
//    a day "rainy" when it barely drizzled for a minute.
//  - "Light rain" covers a noticeable drizzle/shower (up to 2.5mm, roughly a
//    tenth of an inch) that likely didn't change much foot traffic.
//  - Anything heavier than that is "Rain".
//  - Any measurable snowfall (0.1cm+) is called "Snow" regardless of rain
//    amount, since snow affects traffic differently than rain does.
//  - Temperature bands (based on the day's HIGH, in Celsius): Cold <=5C
//    (~41F), Cool <=15C (~59F), Mild <=24C (~75F), Warm <=30C (~86F),
//    otherwise Hot. These are wide, ordinary bands, not extremes.
const WEATHER_THRESHOLDS = {
  dryMaxMm: 0.2,
  lightRainMaxMm: 2.5,
  snowMinCm: 0.1,
  coldMaxC: 5,
  coolMaxC: 15,
  mildMaxC: 24,
  warmMaxC: 30,
};

function precipCategory(precipSumMm, snowSumCm) {
  if ((snowSumCm || 0) >= WEATHER_THRESHOLDS.snowMinCm) return "snow";
  const p = precipSumMm || 0;
  if (p <= WEATHER_THRESHOLDS.dryMaxMm) return "dry";
  if (p <= WEATHER_THRESHOLDS.lightRainMaxMm) return "lightRain";
  return "rain";
}

function tempCategory(tempMaxC) {
  if (tempMaxC == null) return null;
  if (tempMaxC <= WEATHER_THRESHOLDS.coldMaxC) return "cold";
  if (tempMaxC <= WEATHER_THRESHOLDS.coolMaxC) return "cool";
  if (tempMaxC <= WEATHER_THRESHOLDS.mildMaxC) return "mild";
  if (tempMaxC <= WEATHER_THRESHOLDS.warmMaxC) return "warm";
  return "hot";
}

// ---- Storage units: always Celsius / millimeters ------------------------
// We always ask Open-Meteo for metric units and store metric, then convert
// for display based on the owner's chosen units. That way switching units
// in Settings never requires re-fetching or losing cached data.
function cToF(c) { return c == null ? null : c * 9 / 5 + 32; }
function mmToIn(mm) { return mm == null ? null : mm / 25.4; }
function cmToIn(cm) { return cm == null ? null : cm / 2.54; }

function formatTemp(c, unit) {
  if (c == null) return "--";
  return unit === "F" ? `${Math.round(cToF(c))}°F` : `${Math.round(c)}°C`;
}

function formatPrecip(mm, unit) {
  if (mm == null) return "--";
  return unit === "in" ? `${mmToIn(mm).toFixed(2)} in` : `${mm.toFixed(1)} mm`;
}

// ---- Network helper: timeout + a single retry with backoff --------------
// Never lets a slow/unreachable weather service block the page: every call
// gives up after `timeoutMs`, retries once after a short delay, and then
// gives up for good so the rest of the app keeps working normally.
async function fetchWithTimeoutRetry(url, { timeoutMs = 8000, retries = 1, backoffMs = 1500 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

// ---- Geocoding: turn a city/ZIP the owner typed into coordinates --------
// Returns up to 5 candidate places so the owner can confirm the right one
// (many town names exist in more than one state/country).
async function geocodeLocation(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const data = await fetchWithTimeoutRetry(url, { timeoutMs: 6000, retries: 1 });
  const results = (data && data.results) || [];
  return results.map((r) => ({
    name: r.name,
    admin1: r.admin1 || "",
    country: r.country || "",
    latitude: Math.round(r.latitude * 100) / 100,
    longitude: Math.round(r.longitude * 100) / 100,
    timezone: r.timezone || "auto",
  }));
}

const DAILY_FIELDS = "temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,weather_code";

function toDailyRecords(daily, isForecastFn) {
  if (!daily || !daily.time) return [];
  return daily.time.map((date, i) => ({
    date,
    tempMax: daily.temperature_2m_max ? daily.temperature_2m_max[i] : null,
    tempMin: daily.temperature_2m_min ? daily.temperature_2m_min[i] : null,
    precipSum: daily.precipitation_sum ? daily.precipitation_sum[i] : null,
    snowSum: daily.snowfall_sum ? daily.snowfall_sum[i] : null,
    weatherCode: daily.weather_code ? daily.weather_code[i] : null,
    isForecast: isForecastFn(date),
    fetchedAt: Date.now(),
  }));
}

// Historical actuals for a date range (the archive lags ~5 days behind
// today, so very recent dates should come from fetchRecentAndForecast
// instead -- see below).
async function fetchHistoricalWeather(lat, lon, startDate, endDate, timezone) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=${DAILY_FIELDS}&temperature_unit=celsius&precipitation_unit=mm&timezone=${encodeURIComponent(timezone || "auto")}`;
  const data = await fetchWithTimeoutRetry(url);
  const today = toDateStrLocal(new Date());
  return toDailyRecords(data.daily, (d) => d > today);
}

// Covers the archive's lag (recent past days) plus the next-week forecast,
// in one call, using the forecast API's `past_days` option.
async function fetchRecentAndForecast(lat, lon, timezone, pastDays, forecastDays) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=${DAILY_FIELDS}&temperature_unit=celsius&precipitation_unit=mm&timezone=${encodeURIComponent(timezone || "auto")}&past_days=${pastDays}&forecast_days=${forecastDays}`;
  const data = await fetchWithTimeoutRetry(url);
  const today = toDateStrLocal(new Date());
  return toDailyRecords(data.daily, (d) => d > today);
}

function toDateStrLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
