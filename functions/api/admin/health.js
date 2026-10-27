// GET /api/admin/health -- Founder page: "Outside data health" and
// "Free-tier health". Admin only. Uses only data Tally already has in D1 (no
// paid analytics, no extra API token), so the usage numbers are ESTIMATES,
// labeled as such on the page. Never reads sales (there are none here).

import { requireAdmin } from "../../../lib/account/auth.js";
import { DAY_SEC, FREE_LIMITS, SOURCES } from "../../../lib/outside/config.js";
import { describeSource, outsideDataOn, readSources, recentRuns } from "../../../lib/outside/store.js";
import { describeError, json } from "../../../lib/square/http.js";

const BYTES_PER_EVENT_ROW = 200; // rough size of one usage_events row incl. indexes

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(env, request);
    if (auth.response) return auth.response;
    const nowSec = Math.floor(Date.now() / 1000);
    const dayStart = nowSec - (nowSec % DAY_SEC); // midnight UTC, when Cloudflare's daily limits reset

    // ---- Outside data ----
    let sources = [], runs = [], switchOn = false, outsideReady = true;
    try {
      const rows = new Map((await readSources(env.DB)).map((r) => [r.source_id, r]));
      sources = Object.keys(SOURCES).map((id) => Object.assign(describeSource(rows.get(id), id, nowSec), { name: SOURCES[id].name, link: SOURCES[id].link }));
      runs = await recentRuns(env.DB, 20);
      switchOn = await outsideDataOn(env);
    } catch {
      outsideReady = false; // migration 0007 not applied here yet
    }

    // ---- Today's usage (UTC day), cheap queries only: they use the index on `at` ----
    const [perBrowser, kinds, maxId] = await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) AS n FROM usage_events WHERE at >= ?1 GROUP BY browser_id").bind(dayStart),
      env.DB.prepare("SELECT event, COUNT(*) AS n FROM usage_events WHERE at >= ?1 AND event IN ('visit', 'square_sync_ok', 'square_sync_failed') GROUP BY event").bind(dayStart),
      env.DB.prepare("SELECT MAX(id) AS n FROM usage_events"),
    ]);
    const counts = (perBrowser.results || []).map((r) => r.n);
    const eventsToday = counts.reduce((s, n) => s + n, 0);
    const kind = Object.fromEntries((kinds.results || []).map((r) => [r.event, r.n]));
    const visits = kind.visit || 0;
    const syncs = (kind.square_sync_ok || 0) + (kind.square_sync_failed || 0);
    const runsToday = runs.filter((r) => r.at >= dayStart);

    // Estimates. Requests: every stored step is one request; each visit also
    // calls status + account + outside (outside is browser-cached, so this
    // over-counts); each sync is about 2 pages. Steps not stored (Do Not
    // Track, daily cap) aren't seen, so the real number can be higher.
    const requests = eventsToday + visits * 3 + syncs * 2;
    // Rows written: one per step + the cron runs' log and values.
    const rowsWritten = eventsToday + runsToday.reduce((s, r) => s + 2 + (r.rows_written || 0), 0);
    // Rows read: each step insert checks that browser's count for the day.
    const rowsRead = counts.reduce((s, n) => s + (n * (n + 1)) / 2, 0) + visits * 5 + runsToday.length * 5;
    const storageBytes = (maxId.results && maxId.results[0] ? maxId.results[0].n || 0 : 0) * BYTES_PER_EVENT_ROW;

    const gauge = (used, limit, label) => ({ label, used: Math.round(used), limit, share: limit ? used / limit : 0, warn: limit ? used / limit >= FREE_LIMITS.warnAtShare : false });
    return json({
      generatedAt: nowSec,
      outside: { ready: outsideReady, switchOn, deployVar: String(env.OUTSIDE_DATA || "on"), sources, runs, lastRunAt: runs[0] ? runs[0].at : null },
      freeTier: {
        dayStart,
        gauges: [
          gauge(requests, FREE_LIMITS.requestsPerDay, "requests"),
          gauge(rowsWritten, FREE_LIMITS.d1RowsWrittenPerDay, "d1Writes"),
          gauge(rowsRead, FREE_LIMITS.d1RowsReadPerDay, "d1Reads"),
          gauge(storageBytes, FREE_LIMITS.d1DatabaseBytes, "d1Storage"),
          gauge(FREE_LIMITS.cronTriggersUsedByTally, FREE_LIMITS.cronTriggersPerAccount, "cronTriggers"),
        ],
        counts: { eventsToday, visits, syncs, browsersToday: counts.length, cronRunsToday: runsToday.length },
      },
    });
  } catch (err) {
    console.error("admin health failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}
