// BLS Public Data API: fetch the two "food away from home" price series and
// work out each one's 12-month change. Official API only (no scraping).
// https://www.bls.gov/developers/
//
// Works WITHOUT a registration key (25 queries a day; Tally uses 1). If a
// BLS_API_KEY secret is ever added, it is sent in the request body and is
// never logged, stored or returned.

import { FETCH_TIMEOUT_MS, SOURCES } from "./config.js";

const API = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

// "M09" -> 9; "M13" (annual average) and anything else -> null.
function monthOf(period) {
  const m = /^M(0[1-9]|1[0-2])$/.exec(String(period || ""));
  return m ? Number(m[1]) : null;
}

// One series' data points -> { month: "2026-09", index, pct12 } for the
// latest month that has a value AND a value for the same month a year earlier.
// Missing months (BLS writes "-") are skipped. null if nothing usable.
export function latestTwelveMonthChange(points) {
  const byMonth = new Map();
  for (const p of points || []) {
    const m = monthOf(p.period);
    const y = Number(p.year);
    const v = Number(p.value);
    if (!m || !Number.isInteger(y) || !Number.isFinite(v) || v <= 0) continue;
    byMonth.set(`${y}-${String(m).padStart(2, "0")}`, v);
  }
  const months = [...byMonth.keys()].sort().reverse();
  for (const key of months) {
    const [y, m] = key.split("-");
    const prev = byMonth.get(`${Number(y) - 1}-${m}`);
    if (!prev) continue;
    return { month: key, index: byMonth.get(key), pct12: Math.round((byMonth.get(key) / prev - 1) * 1000) / 10 };
  }
  return null;
}

// Returns { ok: true, value, asOf, requests } or { ok: false, error, requests }.
export async function fetchBlsCpi(env, nowMs, fetchImpl = fetch) {
  const src = SOURCES.bls_cpi;
  const year = new Date(nowMs).getUTCFullYear();
  const body = { seriesid: [src.series.national, src.series.boston], startyear: String(year - 2), endyear: String(year) };
  if (typeof env.BLS_API_KEY === "string" && /^[A-Za-z0-9]{16,64}$/.test(env.BLS_API_KEY)) body.registrationkey = env.BLS_API_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Tally (student project; outside-data job)" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return { ok: false, error: "network", requests: 1 };
  }
  clearTimeout(timer);
  if (!res.ok) return { ok: false, error: `http_${res.status}`, requests: 1 };
  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "bad_json", requests: 1 };
  }
  if (!data || data.status !== "REQUEST_SUCCEEDED" || !data.Results || !Array.isArray(data.Results.series)) {
    // e.g. REQUEST_NOT_PROCESSED when the daily limit is reached
    return { ok: false, error: data && data.status === "REQUEST_NOT_PROCESSED" ? "bls_refused" : "bad_shape", requests: 1 };
  }
  const find = (id) => (data.Results.series.find((s) => s && s.seriesID === id) || {}).data;
  const national = latestTwelveMonthChange(find(src.series.national));
  const boston = latestTwelveMonthChange(find(src.series.boston));
  if (!national) return { ok: false, error: "no_national_value", requests: 1 };
  return { ok: true, value: { national, boston }, asOf: national.month, requests: 1 };
}
