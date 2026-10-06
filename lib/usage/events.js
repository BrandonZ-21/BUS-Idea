// Anonymous usage steps: the allow-list, validation and D1 access.
//
// An event is { browserId, event, reason?, source? } and nothing else.
// Every value comes from a fixed list, so no sales data, item names, file
// contents or free text can ever be stored -- even by a hand-made request.

export const MAX_EVENT_BYTES = 1024;
export const MAX_EVENTS_PER_BROWSER_PER_DAY = 300;

// event -> allowed reason codes (empty = no reason allowed)
export const EVENTS = {
  visit: [],
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
};

export const FAILURE_EVENTS = ["upload_failed", "square_connect_failed", "square_sync_failed"];
const SOURCES = ["own", "sample", "square", "unknown"];
const FIELDS = ["browserId", "event", "reason", "source"];

// Returns { ok: true, value } or { ok: false, field }.
export function validateEvent(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return { ok: false, field: "event" };
  for (const k of Object.keys(input)) if (!FIELDS.includes(k)) return { ok: false, field: k };
  if (typeof input.browserId !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(input.browserId)) return { ok: false, field: "browserId" };
  if (!Object.prototype.hasOwnProperty.call(EVENTS, input.event)) return { ok: false, field: "event" };
  const reason = input.reason === undefined || input.reason === null ? null : input.reason;
  if (reason !== null && !EVENTS[input.event].includes(reason)) return { ok: false, field: "reason" };
  const source = input.source === undefined || input.source === null ? null : input.source;
  if (source !== null && !SOURCES.includes(source)) return { ok: false, field: "source" };
  return { ok: true, value: { browserId: input.browserId, event: input.event, reason, source } };
}

// Stores one event unless that browser is excluded (the admin's own devices)
// or already sent the daily maximum -- one statement, so parallel requests
// can't slip past. Returns true if stored.
export async function insertEvent(db, ev, nowMs = Date.now()) {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const result = await db
    .prepare(
      `INSERT INTO usage_events (at, day, browser_id, event, reason, source)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE (SELECT COUNT(*) FROM usage_events WHERE browser_id = ?3 AND day = ?2) < ?7
         AND NOT EXISTS (SELECT 1 FROM usage_excluded_browsers WHERE browser_id = ?3)`
    )
    .bind(Math.floor(nowMs / 1000), day, ev.browserId, ev.event, ev.reason, ev.source, MAX_EVENTS_PER_BROWSER_PER_DAY)
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
  const [events, recent, first, saved, excluded] = await db.batch([
    db.prepare(`SELECT at, browser_id, event, reason, source FROM usage_events WHERE at >= ?1 AND ${NOT_EXCLUDED} ORDER BY at LIMIT 50000`).bind(sinceSec),
    db.prepare(
      `SELECT at, event, reason FROM usage_events WHERE event IN (${FAILURE_EVENTS.map(() => "?").join(", ")}) AND ${NOT_EXCLUDED}
       ORDER BY at DESC LIMIT 20`
    ).bind(...FAILURE_EVENTS),
    db.prepare(`SELECT MIN(at) AS first FROM usage_events WHERE ${NOT_EXCLUDED}`),
    db.prepare("SELECT COUNT(DISTINCT merchant_id) AS n FROM saved_reports WHERE merchant_id NOT IN (SELECT merchant_id FROM accounts WHERE role = 'admin')"),
    db.prepare("SELECT COUNT(*) AS n FROM usage_excluded_browsers"),
  ]);
  return {
    events: events.results,
    recentFailures: recent.results,
    firstEventAt: first.results[0] ? first.results[0].first : null,
    accountsWithSavedReports: saved.results[0] ? saved.results[0].n : 0,
    excludedBrowsers: excluded.results[0] ? excluded.results[0].n : 0,
  };
}
