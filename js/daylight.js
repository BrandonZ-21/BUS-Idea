// Sunrise/sunset calculator using the standard NOAA solar equations. It is
// pure math on a latitude, longitude and date -- no network request and
// nothing leaves the device. Accuracy is typically within 1-2 minutes.

function sunTimesUtc(lat, lon, year, month, day) {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const jd = Date.UTC(year, month - 1, day, 12) / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;

  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T)
    + Math.sin(3 * M * rad) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad)) * deg;

  const y = Math.tan((eps / 2) * rad) ** 2;
  const eqTime = 4 * deg * (
    y * Math.sin(2 * L0 * rad)
    - 2 * e * Math.sin(M * rad)
    + 4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad)
    - 0.5 * y * y * Math.sin(4 * L0 * rad)
    - 1.25 * e * e * Math.sin(2 * M * rad)
  );

  const cosHA = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl * rad))
    - Math.tan(lat * rad) * Math.tan(decl * rad);
  if (cosHA > 1 || cosHA < -1) return null; // polar day/night: no sunrise or sunset
  const HA = Math.acos(cosHA) * deg;

  const solarNoonMin = 720 - 4 * lon - eqTime; // minutes after 00:00 UTC
  const dayStartUtc = Date.UTC(year, month - 1, day);
  return {
    sunrise: new Date(dayStartUtc + (solarNoonMin - 4 * HA) * 60000),
    sunset: new Date(dayStartUtc + (solarNoonMin + 4 * HA) * 60000),
  };
}

// Minutes after local midnight (in the given IANA time zone) for a Date.
function localMinutesOfDay(date, timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone: timeZone && timeZone !== "auto" ? timeZone : undefined, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  } catch (e) {
    parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  }
  const h = parseInt(parts.find((p) => p.type === "hour").value, 10) % 24;
  const m = parseInt(parts.find((p) => p.type === "minute").value, 10);
  return h * 60 + m;
}

// dateStr "YYYY-MM-DD" -> { sunriseMin, sunsetMin, daylightMin } in the
// restaurant's local time, or null if there's no sunrise/sunset that day.
function daylightFor(dateStr, loc) {
  if (!loc) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = sunTimesUtc(loc.latitude, loc.longitude, y, m, d);
  if (!t) return null;
  const sunriseMin = localMinutesOfDay(t.sunrise, loc.timezone);
  const sunsetMin = localMinutesOfDay(t.sunset, loc.timezone);
  return { sunriseMin, sunsetMin, daylightMin: Math.round((t.sunset - t.sunrise) / 60000) };
}

function formatClockMinutes(min) {
  const h24 = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  const period = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")}${period}`;
}

function formatDuration(min) {
  return `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;
}

// "Early sunset" cutoff used by the daylight insight (minutes after midnight).
const EARLY_SUNSET_MINUTES = 17 * 60;
