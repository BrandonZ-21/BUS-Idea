// D1 access for the outside-data cache (migration 0007) and the freshness
// rules. Everything here is about public statistics; nothing about owners.

import { DAY_SEC, MAX_RUNS_KEPT, SOURCES, backoffSec } from "./config.js";

// ---------- Switch (Founder page, instant, no deploy) ----------

// Off if the deploy-time variable says so OR the admin flipped the switch.
export async function outsideDataOn(env) {
  if (String(env.OUTSIDE_DATA || "on") === "off") return false;
  try {
    const row = await env.DB.prepare("SELECT value FROM app_switches WHERE key = 'outside_data'").first();
    return !row || row.value !== "off";
  } catch {
    return false; // table missing (migration not applied yet) -> stay off, quietly
  }
}

export async function setOutsideDataSwitch(db, on) {
  await db.prepare("INSERT INTO app_switches (key, value) VALUES ('outside_data', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(on ? "on" : "off").run();
}

// ---------- Values ----------

export async function readSources(db) {
  const { results } = await db.prepare("SELECT * FROM outside_data").all();
  return results || [];
}

export async function saveSuccess(db, sourceId, { value, asOf }, nowSec) {
  await db.prepare(
    `INSERT INTO outside_data (source_id, value_json, as_of, last_success_at, last_attempt_at, fail_count, next_retry_at, last_error)
     VALUES (?1, ?2, ?3, ?4, ?4, 0, NULL, NULL)
     ON CONFLICT(source_id) DO UPDATE SET value_json = excluded.value_json, as_of = excluded.as_of,
       last_success_at = excluded.last_success_at, last_attempt_at = excluded.last_attempt_at,
       fail_count = 0, next_retry_at = NULL, last_error = NULL`
  ).bind(sourceId, JSON.stringify(value), asOf || null, nowSec).run();
}

// Keeps the last good value; only the attempt, the count and the backoff change.
export async function saveFailure(db, sourceId, error, nowSec, previousFails) {
  const fails = (previousFails || 0) + 1;
  await db.prepare(
    `INSERT INTO outside_data (source_id, last_attempt_at, fail_count, next_retry_at, last_error)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(source_id) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, fail_count = excluded.fail_count,
       next_retry_at = excluded.next_retry_at, last_error = excluded.last_error`
  ).bind(sourceId, nowSec, fails, nowSec + backoffSec(fails), String(error).slice(0, 40)).run();
}

// Is a fetch due? Never fetched, or the last success is older than the
// source's refresh interval -- and not inside a backoff window.
export function isDue(row, sourceId, nowSec) {
  const src = SOURCES[sourceId];
  if (row && row.next_retry_at && nowSec < row.next_retry_at) return false;
  if (!row || !row.last_success_at) return true;
  return nowSec - row.last_success_at >= src.refreshEverySec - 3600; // an hour of slack for cron timing
}

// Days from the end of a "YYYY-MM" month to now.
export function daysSinceMonthEnd(month, nowSec) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) return Infinity;
  const [y, m] = month.split("-").map(Number);
  const end = Date.UTC(y, m, 1) / 1000; // first moment of the next month
  return Math.floor((nowSec - end) / DAY_SEC);
}

// 'fresh' | 'stale' | 'failed' | 'never' for one stored row, plus what owners may see.
export function describeSource(row, sourceId, nowSec) {
  const src = SOURCES[sourceId];
  if (!row || !row.value_json) {
    return { id: sourceId, status: row && row.fail_count ? "failed" : "never", value: null, failCount: row ? row.fail_count : 0, lastError: row ? row.last_error : null, lastAttemptAt: row ? row.last_attempt_at : null };
  }
  let value = null;
  try { value = JSON.parse(row.value_json); } catch { value = null; }
  let ownerValue = null;
  let stale = true;
  if (sourceId === "bls_cpi" && value && value.national) {
    const nationalOk = daysSinceMonthEnd(value.national.month, nowSec) <= src.staleDays.national;
    const bostonOk = value.boston && daysSinceMonthEnd(value.boston.month, nowSec) <= src.staleDays.boston;
    stale = !nationalOk;
    ownerValue = nationalOk ? { national: value.national, boston: bostonOk ? value.boston : null } : null;
  }
  return {
    id: sourceId,
    status: stale ? "stale" : row.fail_count ? "failing_but_fresh" : "fresh",
    value: ownerValue, // null = hidden from owners
    storedValue: value,
    asOf: row.as_of,
    lastSuccessAt: row.last_success_at,
    lastAttemptAt: row.last_attempt_at,
    failCount: row.fail_count,
    lastError: row.last_error,
    nextRetryAt: row.next_retry_at,
  };
}

// ---------- Runs ----------

export async function recordRun(db, run) {
  await db.batch([
    db.prepare("INSERT INTO outside_runs (at, ok, skipped, outbound_requests, rows_written, duration_ms, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
      .bind(run.at, run.ok ? 1 : 0, run.skipped || null, run.outboundRequests || 0, run.rowsWritten || 0, run.durationMs || 0, run.note || null),
    db.prepare(`DELETE FROM outside_runs WHERE id <= (SELECT id FROM outside_runs ORDER BY id DESC LIMIT 1 OFFSET ${MAX_RUNS_KEPT})`),
  ]);
}

export async function recentRuns(db, limit = 20) {
  const { results } = await db.prepare("SELECT at, ok, skipped, outbound_requests, rows_written, duration_ms, note FROM outside_runs ORDER BY id DESC LIMIT ?1").bind(limit).all();
  return results || [];
}
