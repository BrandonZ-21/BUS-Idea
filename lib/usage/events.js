// Anonymous usage steps: the allow-list, validation and D1 access.
//
// An event is { browserId, event, reason?, source?, detail?, refHost?,
// refTag?, device? } and nothing else. Every value comes from a fixed list or
// must match a strict shape (short code-like names only), so no sales data,
// item names, file contents or free text can ever be stored -- even by a
// hand-made request.

export const MAX_EVENT_BYTES = 1024;
export const MAX_EVENTS_PER_BROWSER_PER_DAY = 500;

// event -> allowed reason codes (empty = no reason allowed)
export const EVENTS = {
  visit: [],
  page_view: [],
  click: [],
  engaged: ["30s", "2m", "5m", "10m"],
  sample_loaded: [],
  upload_started: [],
  upload_ok: [],
  upload_failed: ["unsupported_type", "read_error", "empty_file", "missing_columns", "no_item_column", "bad_date", "bad_price", "no_valid_rows", "error"],
  data_added: [],
  report_viewed: [],
  square_connect_started: [],
  square_connected: [],
  square_connect_failed: ["denied", "state", "config", "error"],
  square_sync_ok: [],
  square_sync_failed: ["session_ended", "failed"],
  report_saved: [],
  // Advice cards: "shown" (once per type per day per browser) and the
  // "Was this useful?" answer. detail = the recommendation type, never its text.
  rec_shown: [],
  rec_useful: ["yes", "no"],
};

// Recommendation types (public/js/insights.js + public/js/advice.js ids).
export const REC_IDS = [
  "busiestWindow", "slowHours", "bestSlowDay", "topSellers", "longTail", "pairs", "orderSize",
  "recentTrend", "seasonality", "refunds", "discounts", "channels",
  "noteImpact", "priceChange", "concentration", "returning", "channelMix", "breakEven",
  "weatherAhead", "eventAhead", "priceVsMarket",
];

// The app's pages (public/js/router.js), by name.
export const PAGES = ["home", "dashboard", "data", "hours", "days", "items", "trend", "order-types", "heatmap", "notes", "ask", "customers", "grow", "founder"];
export const DEVICES = ["mobile", "tablet", "desktop"];

export const FAILURE_EVENTS = ["upload_failed", "square_connect_failed", "square_sync_failed"];
const SOURCES = ["own", "sample", "square", "unknown"];
const FIELDS = ["browserId", "event", "reason", "source", "detail", "refHost", "refTag", "device"];

// A clicked control, named by the code: an element id, a class name, or
// "nav:items" / "link:docs.google.com". Letters first, no spaces, short.
const CLICK_TARGET = /^[A-Za-z][A-Za-z0-9:._-]{0,47}$/;
const REF_HOST = /^[a-z0-9][a-z0-9.-]{0,99}$/;
const REF_TAG = /^[a-z0-9_-]{1,32}$/;
const COUNTRY = /^[A-Z0-9]{2}$/;

const blank = (v) => v === undefined || v === null;

// Returns { ok: true, value } or { ok: false, field }.
export function validateEvent(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return { ok: false, field: "event" };
  for (const k of Object.keys(input)) if (!FIELDS.includes(k)) return { ok: false, field: k };
  if (typeof input.browserId !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(input.browserId)) return { ok: false, field: "browserId" };
  if (!Object.prototype.hasOwnProperty.call(EVENTS, input.event)) return { ok: false, field: "event" };
  const event = input.event;
  const reason = blank(input.reason) ? null : input.reason;
  if (reason !== null && !EVENTS[event].includes(reason)) return { ok: false, field: "reason" };
  const source = blank(input.source) ? null : input.source;
  if (source !== null && !SOURCES.includes(source)) return { ok: false, field: "source" };

  // detail: a page name on visits and page views, a control name on clicks.
  const detail = blank(input.detail) ? null : input.detail;
  if (detail !== null) {
    const okDetail = event === "click" ? typeof detail === "string" && CLICK_TARGET.test(detail)
      : event === "visit" || event === "page_view" ? PAGES.includes(detail)
      : event === "rec_shown" || event === "rec_useful" ? REC_IDS.includes(detail)
      : false;
    if (!okDetail) return { ok: false, field: "detail" };
  }
  if ((event === "click" || event === "rec_shown" || event === "rec_useful") && detail === null) return { ok: false, field: "detail" };
  if (event === "rec_useful" && reason === null) return { ok: false, field: "reason" };

  // Where the visit came from and the device type: on visits only.
  const refHost = blank(input.refHost) ? null : input.refHost;
  const refTag = blank(input.refTag) ? null : input.refTag;
  const device = blank(input.device) ? null : input.device;
  if (refHost !== null && (event !== "visit" || typeof refHost !== "string" || !REF_HOST.test(refHost))) return { ok: false, field: "refHost" };
  if (refTag !== null && (event !== "visit" || typeof refTag !== "string" || !REF_TAG.test(refTag))) return { ok: false, field: "refTag" };
  if (device !== null && (event !== "visit" || !DEVICES.includes(device))) return { ok: false, field: "device" };

  return { ok: true, value: { browserId: input.browserId, event, reason, source, detail, refHost, refTag, device } };
}

// Cloudflare's two-letter country for the request (no IP is read or kept).
// Only kept on visits. Anything unexpected becomes null.
export function cleanCountry(country) {
  return typeof country === "string" && COUNTRY.test(country) ? country : null;
}

// Stores one event unless that browser is excluded (the admin's own devices)
// or already sent the daily maximum -- one statement, so parallel requests
// can't slip past. Returns true if stored.
export async function insertEvent(db, ev, nowMs = Date.now(), country = null) {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const result = await db
    .prepare(
      `INSERT INTO usage_events (at, day, browser_id, event, reason, source, detail, ref_host, ref_tag, country, device)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?8, ?9, ?10, ?11, ?12
       WHERE (SELECT COUNT(*) FROM usage_events WHERE browser_id = ?3 AND day = ?2) < ?7
         AND NOT EXISTS (SELECT 1 FROM usage_excluded_browsers WHERE browser_id = ?3)`
    )
    .bind(
      Math.floor(nowMs / 1000), day, ev.browserId, ev.event, ev.reason, ev.source, MAX_EVENTS_PER_BROWSER_PER_DAY,
      ev.detail ?? null, ev.refHost ?? null, ev.refTag ?? null,
      ev.event === "visit" ? cleanCountry(country) : null, ev.device ?? null
    )
    .run();
  return result.meta.changes === 1;
}

// ---------- Excluded browsers (the admin's own devices) ----------

export function isBrowserId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{22}$/.test(id);
}

// Leaves the browser's past events in place but out of every dashboard
// number (see NOT_EXCLUDED below), and stops new ones being stored.
export async function setBrowserExcluded(db, browserId, excluded) {
  if (excluded) {
    await db.prepare("INSERT INTO usage_excluded_browsers (browser_id) VALUES (?1) ON CONFLICT(browser_id) DO NOTHING").bind(browserId).run();
  } else {
    await db.prepare("DELETE FROM usage_excluded_browsers WHERE browser_id = ?1").bind(browserId).run();
  }
}

const NOT_EXCLUDED = "browser_id NOT IN (SELECT browser_id FROM usage_excluded_browsers)";

// Everything the dashboard needs for one window, read-only. Excluded
// browsers and admin accounts are left out of every number.
export async function loadLiveData(db, sinceSec) {
  const [events, recent, first, saved, excluded, firstSeen] = await db.batch([
    db.prepare(
      `SELECT at, browser_id, event, reason, source, detail, ref_host, ref_tag, country, device
       FROM usage_events WHERE at >= ?1 AND ${NOT_EXCLUDED} ORDER BY at LIMIT 50000`
    ).bind(sinceSec),
    db.prepare(
      `SELECT at, event, reason FROM usage_events WHERE event IN (${FAILURE_EVENTS.map(() => "?").join(", ")}) AND ${NOT_EXCLUDED}
       ORDER BY at DESC LIMIT 20`
    ).bind(...FAILURE_EVENTS),
    db.prepare(`SELECT MIN(at) AS first FROM usage_events WHERE ${NOT_EXCLUDED}`),
    db.prepare("SELECT COUNT(DISTINCT merchant_id) AS n FROM saved_reports WHERE merchant_id NOT IN (SELECT merchant_id FROM accounts WHERE role = 'admin')"),
    db.prepare("SELECT COUNT(*) AS n FROM usage_excluded_browsers"),
    // When each browser active in the window was first seen at all (for "new vs. returning").
    db.prepare(
      `SELECT browser_id, MIN(at) AS first FROM usage_events WHERE ${NOT_EXCLUDED}
       GROUP BY browser_id HAVING MAX(at) >= ?1`
    ).bind(sinceSec),
  ]);
  return {
    events: events.results,
    recentFailures: recent.results,
    firstEventAt: first.results[0] ? first.results[0].first : null,
    accountsWithSavedReports: saved.results[0] ? saved.results[0].n : 0,
    excludedBrowsers: excluded.results[0] ? excluded.results[0].n : 0,
    firstSeen: Object.fromEntries(firstSeen.results.map((r) => [r.browser_id, r.first])),
  };
}
