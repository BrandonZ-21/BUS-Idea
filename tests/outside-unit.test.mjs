// Outside data (lib/outside/*, functions/api/outside.js) and the new usage
// events. No network: BLS is a fake fetch, D1 is a tiny in-memory fake that
// understands only the statements this code uses.
// Run: node --test tests/outside-unit.test.mjs   (also part of `npm test`)

import assert from "node:assert/strict";
import test from "node:test";

import { latestTwelveMonthChange, fetchBlsCpi } from "../lib/outside/bls.js";
import { backoffSec, SOURCES } from "../lib/outside/config.js";
import { describeSource, isDue, daysSinceMonthEnd } from "../lib/outside/store.js";
import { runOutsideJob } from "../lib/outside/run.js";
import { onRequestGet as outsideGet } from "../functions/api/outside.js";
import { validateEvent } from "../lib/usage/events.js";
import { summarize } from "../lib/usage/summary.js";
import { roughLocation } from "../lib/square/orders.js";

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0); // 2026-10-27 12:00 UTC
const NOW_SEC = NOW / 1000;

// ---- A BLS-shaped answer ----
function point(year, month, value) {
  return { year: String(year), period: `M${String(month).padStart(2, "0")}`, value: String(value) };
}
function blsAnswer({ national = [], boston = [], status = "REQUEST_SUCCEEDED" } = {}) {
  return { status, Results: { series: [{ seriesID: "CUUR0000SEFV", data: national }, { seriesID: "CUURS11ASEFV", data: boston }] } };
}
const NATIONAL = [point(2026, 9, 398.783), point(2026, 8, 397.868), point(2025, 9, 385.0), point(2025, 8, 384.0), { year: "2025", period: "M10", value: "-" }];
const BOSTON = [point(2026, 9, 459.127), point(2026, 7, 454.85), point(2025, 9, 448.8)];
function fakeFetch(body, status = 200) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    if (body instanceof Error) throw body;
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

// ---- A tiny fake D1 ----
function fakeDb({ switchValue = null, rows = [] } = {}) {
  const db = { data: new Map(rows.map((r) => [r.source_id, { ...r }])), runs: [], switchValue };
  const stmt = (sql) => ({
    args: [],
    bind(...a) { this.args = a; return this; },
    async first() {
      if (sql.includes("FROM app_switches")) return db.switchValue === null ? null : { value: db.switchValue };
      return null;
    },
    async all() {
      if (sql.includes("FROM outside_data")) return { results: [...db.data.values()] };
      if (sql.includes("FROM outside_runs")) return { results: db.runs.slice().reverse() };
      return { results: [] };
    },
    async run() {
      const a = this.args;
      if (sql.startsWith("INSERT INTO outside_data") && sql.includes("value_json")) {
        db.data.set(a[0], { source_id: a[0], value_json: a[1], as_of: a[2], last_success_at: a[3], last_attempt_at: a[3], fail_count: 0, next_retry_at: null, last_error: null });
      } else if (sql.startsWith("INSERT INTO outside_data")) {
        const prev = db.data.get(a[0]) || { source_id: a[0], value_json: null, as_of: null, last_success_at: null };
        db.data.set(a[0], { ...prev, last_attempt_at: a[1], fail_count: a[2], next_retry_at: a[3], last_error: a[4] });
      } else if (sql.startsWith("INSERT INTO outside_runs")) {
        db.runs.push({ at: a[0], ok: a[1], skipped: a[2], outbound_requests: a[3], rows_written: a[4], duration_ms: a[5], note: a[6] });
      } else if (sql.startsWith("INSERT INTO app_switches")) {
        db.switchValue = a[0];
      }
      return { meta: { changes: 1 } };
    },
  });
  db.prepare = (sql) => stmt(sql);
  db.batch = async (list) => Promise.all(list.map((s) => s.run()));
  return db;
}

test("BLS: 12-month change from the latest month that has a year-earlier value", () => {
  const r = latestTwelveMonthChange(NATIONAL);
  assert.deepEqual(r, { month: "2026-09", index: 398.783, pct12: 3.6 });
  // Boston is published every other month: September has a September a year earlier.
  assert.equal(latestTwelveMonthChange(BOSTON).month, "2026-09");
  // A missing month ("-") and annual averages are skipped, never treated as 0.
  assert.equal(latestTwelveMonthChange([point(2026, 10, "-"), point(2026, 9, 110), point(2025, 9, 100), { year: "2025", period: "M13", value: "1" }]).month, "2026-09");
  assert.equal(latestTwelveMonthChange([point(2026, 9, 110)]), null, "no year-earlier value -> nothing");
});

test("BLS fetch: one request, no key needed, and the key (if any) is never echoed", async () => {
  const f = fakeFetch(blsAnswer({ national: NATIONAL, boston: BOSTON }));
  const r = await fetchBlsCpi({}, NOW, f);
  assert.equal(r.ok, true);
  assert.equal(r.requests, 1);
  assert.equal(r.asOf, "2026-09");
  assert.equal(r.value.boston.pct12, 2.3);
  const sent = JSON.parse(f.calls[0].init.body);
  assert.deepEqual(sent.seriesid, ["CUUR0000SEFV", "CUURS11ASEFV"]);
  assert.equal(sent.registrationkey, undefined);
  const withKey = fakeFetch(blsAnswer({ national: NATIONAL }));
  const r2 = await fetchBlsCpi({ BLS_API_KEY: "abcdef0123456789abcdef0123456789" }, NOW, withKey);
  assert.equal(JSON.parse(withKey.calls[0].init.body).registrationkey, "abcdef0123456789abcdef0123456789");
  assert.ok(!JSON.stringify(r2).includes("abcdef0123456789"), "the key is not in the result");
});

test("BLS fetch failures become short codes", async () => {
  assert.equal((await fetchBlsCpi({}, NOW, fakeFetch({}, 503))).error, "http_503");
  assert.equal((await fetchBlsCpi({}, NOW, fakeFetch(new Error("offline")))).error, "network");
  assert.equal((await fetchBlsCpi({}, NOW, fakeFetch(blsAnswer({ status: "REQUEST_NOT_PROCESSED" })))).error, "bls_refused");
  assert.equal((await fetchBlsCpi({}, NOW, fakeFetch(blsAnswer({ national: [] })))).error, "no_national_value");
});

test("freshness: due once a day, backoff after failures, stale values hidden", () => {
  assert.equal(isDue(null, "bls_cpi", NOW_SEC), true);
  assert.equal(isDue({ last_success_at: NOW_SEC - 3600 }, "bls_cpi", NOW_SEC), false);
  assert.equal(isDue({ last_success_at: NOW_SEC - 86400 }, "bls_cpi", NOW_SEC), true);
  assert.equal(isDue({ last_success_at: NOW_SEC - 86400, next_retry_at: NOW_SEC + 60 }, "bls_cpi", NOW_SEC), false, "inside a backoff window");
  assert.deepEqual([1, 2, 3, 9].map(backoffSec), [6 * 3600, 12 * 3600, 24 * 3600, 24 * 3600]);
  assert.equal(daysSinceMonthEnd("2026-09", NOW_SEC), 26);

  const fresh = describeSource({ value_json: JSON.stringify({ national: { month: "2026-09", pct12: 3.6 }, boston: { month: "2026-09", pct12: 2.3 } }), as_of: "2026-09", last_success_at: NOW_SEC, fail_count: 0 }, "bls_cpi", NOW_SEC);
  assert.equal(fresh.status, "fresh");
  assert.equal(fresh.value.national.pct12, 3.6);

  const old = describeSource({ value_json: JSON.stringify({ national: { month: "2026-05", pct12: 3.0 } }), as_of: "2026-05", last_success_at: NOW_SEC, fail_count: 0 }, "bls_cpi", NOW_SEC);
  assert.equal(old.status, "stale");
  assert.equal(old.value, null, "stale values are hidden from owners");
  assert.ok(SOURCES.bls_cpi.staleDays.national < daysSinceMonthEnd("2026-05", NOW_SEC));

  const failingButFresh = describeSource({ value_json: JSON.stringify({ national: { month: "2026-09", pct12: 3.6 } }), last_success_at: NOW_SEC - 2 * 86400, fail_count: 2, last_error: "http_503" }, "bls_cpi", NOW_SEC);
  assert.equal(failingButFresh.status, "failing_but_fresh");
  assert.ok(failingButFresh.value, "the last good value is still shown while it's fresh");
  assert.equal(describeSource({ source_id: "bls_cpi", fail_count: 3 }, "bls_cpi", NOW_SEC).status, "failed");
});

test("scheduled job: fetches when due, keeps the last good value on failure, backs off", async () => {
  const db = fakeDb();
  const ok = await runOutsideJob({ DB: db }, NOW, fakeFetch(blsAnswer({ national: NATIONAL, boston: BOSTON })));
  assert.equal(ok.ok, true);
  assert.equal(ok.outboundRequests, 1);
  assert.equal(JSON.parse(db.data.get("bls_cpi").value_json).national.pct12, 3.6);

  // Six hours later: nothing due, no outside request.
  const idle = await runOutsideJob({ DB: db }, NOW + 6 * 3600e3, fakeFetch(new Error("should not be called")));
  assert.equal(idle.outboundRequests, 0);
  assert.equal(idle.note, "nothing_due");

  // A day later BLS is down: the old value stays, a failure is counted, a retry is scheduled.
  const later = NOW + 25 * 3600e3;
  const bad = await runOutsideJob({ DB: db }, later, fakeFetch({}, 503));
  assert.equal(bad.ok, false);
  const row = db.data.get("bls_cpi");
  assert.equal(JSON.parse(row.value_json).national.pct12, 3.6, "last good value kept");
  assert.equal(row.fail_count, 1);
  assert.equal(row.next_retry_at, later / 1000 + 6 * 3600);
  assert.equal(db.runs.length, 3, "every run is logged");
});

test("scheduled job: the off switch (Founder page or OUTSIDE_DATA) stops all fetching", async () => {
  const f = fakeFetch(blsAnswer({ national: NATIONAL }));
  const off = await runOutsideJob({ DB: fakeDb({ switchValue: "off" }) }, NOW, f);
  assert.equal(off.skipped, "switched_off");
  const offVar = await runOutsideJob({ DB: fakeDb(), OUTSIDE_DATA: "off" }, NOW, f);
  assert.equal(offVar.skipped, "switched_off");
  assert.equal(f.calls.length, 0);
});

test("/api/outside: only fresh values, nothing when switched off, never an error", async () => {
  const fresh = { source_id: "bls_cpi", value_json: JSON.stringify({ national: { month: "2026-09", pct12: 3.6 }, boston: null }), as_of: "2026-09", last_success_at: Math.floor(Date.now() / 1000), fail_count: 0 };
  const call = async (env) => (await outsideGet({ request: new Request("https://tally.example/api/outside"), env, waitUntil: () => {} })).json();
  const body = await call({ DB: fakeDb({ rows: [fresh] }) });
  assert.equal(body.enabled, true);
  assert.equal(body.sources.bls_cpi.value.national.pct12, 3.6);
  assert.match(body.sources.bls_cpi.license, /BLS\.gov cannot vouch/);

  const stale = { ...fresh, value_json: JSON.stringify({ national: { month: "2025-01", pct12: 3.6 } }) };
  assert.deepEqual((await call({ DB: fakeDb({ rows: [stale] }) })).sources, {}, "stale -> hidden");
  assert.equal((await call({ DB: fakeDb({ rows: [fresh], switchValue: "off" }) })).enabled, false);
  const broken = { prepare() { throw new Error("no such table"); }, batch() { throw new Error("x"); } };
  const res = await outsideGet({ request: new Request("https://tally.example/api/outside"), env: { DB: broken }, waitUntil: () => {} });
  assert.equal(res.status, 200, "a missing table never becomes an error page");
});

test("usage events: advice 'shown' and 'useful' carry only a known card type and yes/no", () => {
  const id = "AAAAAAAAAAAAAAAAAAAAAA";
  assert.equal(validateEvent({ browserId: id, event: "rec_shown", detail: "pairs" }).ok, true);
  assert.equal(validateEvent({ browserId: id, event: "rec_useful", detail: "pairs", reason: "yes" }).ok, true);
  assert.equal(validateEvent({ browserId: id, event: "rec_useful", detail: "pairs" }).ok, false, "an answer is required");
  assert.equal(validateEvent({ browserId: id, event: "rec_useful", detail: "pairs", reason: "maybe" }).ok, false);
  assert.equal(validateEvent({ browserId: id, event: "rec_shown", detail: "Latte sold 40%" }).ok, false, "no free text");
  assert.equal(validateEvent({ browserId: id, event: "rec_shown" }).ok, false);

  const ev = (browser_id, event, detail, reason) => ({ at: NOW_SEC - 60, browser_id, event, detail, reason: reason || null, source: null });
  const s = summarize({ events: [ev("a", "rec_shown", "pairs"), ev("b", "rec_shown", "pairs"), ev("a", "rec_useful", "pairs", "yes"), ev("b", "rec_useful", "pairs", "no"), ev("a", "rec_shown", "noteImpact")], recentFailures: [], accountsWithSavedReports: 0 }, { days: 7, nowSec: NOW_SEC, mode: "live", collecting: true });
  assert.deepEqual(s.recommendations[0], { id: "pairs", shown: 2, browsers: 2, yes: 1, no: 1 });
});

test("Square location: first active location with coordinates, rounded to ~1 km", () => {
  assert.equal(roughLocation([]), null);
  assert.equal(roughLocation([{ status: "ACTIVE" }]), null, "no coordinates -> nothing");
  const loc = roughLocation([
    { status: "INACTIVE", coordinates: { latitude: 1, longitude: 1 } },
    { status: "ACTIVE", timezone: "America/New_York", address: { locality: "Waltham", address_line_1: "415 South St" }, coordinates: { latitude: 42.36612, longitude: -71.25899 } },
  ]);
  assert.deepEqual(loc, { name: "Waltham", latitude: 42.37, longitude: -71.26, timezone: "America/New_York" });
  assert.ok(!JSON.stringify(loc).includes("South St"), "no street address");
});
