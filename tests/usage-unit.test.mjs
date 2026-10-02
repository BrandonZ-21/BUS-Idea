// Unit tests for the founder dashboard's counting rules (lib/usage/*) and
// the events endpoint's "off" switch. All events here are synthetic.
// Run:  npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { EVENTS, validateEvent } from "../lib/usage/events.js";
import { summarize } from "../lib/usage/summary.js";
import { demoData } from "../lib/usage/demo.js";
import { onRequestPost as postEvent } from "../functions/api/events.js";

const DAY = 86400;
const NOW = 1_790_000_000 - (1_790_000_000 % DAY) + 23 * 3600; // 23:00 UTC on a fixed day
const ID = (c) => c.repeat(22);

const ev = (browser, daysAgo, event, reason = null, source = null) => ({ at: NOW - daysAgo * DAY, browser_id: browser, event, reason, source });
const data = (events) => ({ events, recentFailures: [], firstEventAt: events.length ? Math.min(...events.map((e) => e.at)) : null, accountsWithSavedReports: 0 });
const opts = { days: 7, nowSec: NOW, mode: "live", collecting: true };

// ---------- validation ----------

test("events: only allow-listed names, reasons and sources; nothing else accepted", () => {
  assert.deepEqual(validateEvent({ browserId: ID("a"), event: "visit" }), { ok: true, value: { browserId: ID("a"), event: "visit", reason: null, source: null } });
  assert.equal(validateEvent({ browserId: ID("a"), event: "upload_failed", reason: "bad_date", source: "own" }).ok, true);
  const bad = [
    [{ browserId: ID("a"), event: "visit", item: "Latte" }, "item"],
    [{ browserId: ID("a"), event: "visit", amount: 12.5 }, "amount"],
    [{ browserId: "short", event: "visit" }, "browserId"],
    [{ browserId: ID("a"), event: "bought_latte" }, "event"],
    [{ browserId: ID("a"), event: "upload_failed", reason: "Latte $4.50 not recognized" }, "reason"],
    [{ browserId: ID("a"), event: "visit", reason: "bad_date" }, "reason"],
    [{ browserId: ID("a"), event: "visit", source: "Mock Cafe" }, "source"],
    [{ browserId: ID("a"), event: "toString" }, "event"],
  ];
  for (const [input, field] of bad) assert.deepEqual(validateEvent(input), { ok: false, field }, JSON.stringify(input));
  assert.deepEqual(validateEvent(null), { ok: false, field: "event" });
  assert.ok(Object.keys(EVENTS).every((k) => /^[a-z_]+$/.test(k)));
});

// ---------- counting rules ----------

test("a known successful journey lands in every right place", () => {
  const s = summarize(data([
    ev("A", 1, "visit"), ev("A", 1, "upload_started", null, "own"), ev("A", 1, "upload_ok", null, "own"),
    ev("A", 1, "data_added", null, "own"), ev("A", 1, "report_viewed", null, "own"),
  ]), opts);
  assert.deepEqual(s.firstReport, { visitors: 1, reachedOwn: 1, rate: 1 });
  assert.deepEqual(s.funnel.map((x) => x.browsers), [1, 1, 1, 1]);
  assert.deepEqual(s.failures, []);
});

test("a failed journey is not counted as success", () => {
  const s = summarize(data([
    ev("B", 1, "visit"), ev("B", 1, "upload_started", null, "own"), ev("B", 1, "upload_failed", "bad_date", "own"),
  ]), opts);
  assert.deepEqual(s.firstReport, { visitors: 1, reachedOwn: 0, rate: 0 });
  assert.deepEqual(s.funnel.map((x) => x.browsers), [1, 1, 0, 0]);
  assert.deepEqual(s.failures, [{ event: "upload_failed", reason: "bad_date", count: 1, browsers: 1 }]);
});

test("sample data never counts as the owner's own data", () => {
  const s = summarize(data([
    ev("C", 1, "visit"), ev("C", 1, "sample_loaded", null, "sample"), ev("C", 1, "upload_ok", null, "sample"), ev("C", 1, "report_viewed", null, "sample"),
  ]), opts);
  assert.equal(s.firstReport.reachedOwn, 0);
  assert.equal(s.funnel[2].browsers, 0);
  assert.equal(s.trust.sampleOnly, 1);
});

test("reloads and repeats count each browser once; repeat events still count as events", () => {
  const s = summarize(data([
    ev("D", 1, "visit"), ev("D", 1, "visit"), ev("D", 1, "report_viewed", null, "own"), ev("D", 1, "report_viewed", null, "own"),
    ev("D", 1, "upload_failed", "bad_date", "own"), ev("D", 1, "upload_failed", "bad_date", "own"),
  ]), opts);
  assert.deepEqual(s.firstReport, { visitors: 1, reachedOwn: 1, rate: 1 });
  assert.deepEqual(s.failures, [{ event: "upload_failed", reason: "bad_date", count: 2, browsers: 1 }]);
});

test("came back = own data added on two different days (same day twice doesn't count)", () => {
  const s = summarize(data([
    ev("E", 5, "data_added", null, "own"), ev("E", 2, "data_added", null, "square"),
    ev("F", 3, "data_added", null, "own"), ev("F", 3, "data_added", null, "own"),
    ev("G", 3, "data_added", null, "sample"),
  ]), opts);
  assert.deepEqual(s.cameBack, { withOwnData: 2, cameBack: 1, rate: 0.5 });
});

test("a finished Square connect counts as started even if the start event was missed", () => {
  const s = summarize(data([ev("J", 1, "visit"), ev("J", 1, "square_connected")]), opts);
  assert.equal(s.trust.connectStarted, 1);
  assert.equal(s.trust.connected, 1);
  assert.equal(s.trust.connectRate, 1);
  assert.deepEqual(s.funnel.map((x) => x.browsers), [1, 1, 1, 0], "never more 'got in' than 'tried'");
});

test("the date window excludes older events", () => {
  const s = summarize(data([ev("H", 8, "visit"), ev("I", 6, "visit")]), opts);
  assert.equal(s.firstReport.visitors, 1);
  assert.equal(summarize(data([ev("H", 8, "visit"), ev("I", 6, "visit")]), { ...opts, days: 28 }).firstReport.visitors, 2);
});

test("zero denominators give null rates (shown as --), not 0% or NaN", () => {
  const s = summarize(data([]), opts);
  assert.deepEqual(s.firstReport, { visitors: 0, reachedOwn: 0, rate: null });
  assert.equal(s.cameBack.rate, null);
  assert.equal(s.trust.connectRate, null);
  assert.equal(s.eventsInWindow, 0);
  assert.equal(s.firstEventAt, null);
});

test("demo data is deterministic, clearly labeled, and gives the expected numbers", () => {
  assert.deepEqual(demoData(NOW), demoData(NOW));
  assert.ok(demoData(NOW).events.every((e) => e.browser_id.startsWith("demo-browser-")));
  const s = summarize(demoData(NOW), { days: 28, nowSec: NOW, mode: "demo", collecting: false });
  assert.equal(s.mode, "demo");
  assert.deepEqual(s.firstReport, { visitors: 9, reachedOwn: 3, rate: 3 / 9 });
  assert.deepEqual(s.funnel.map((x) => x.browsers), [9, 6, 3, 3]);
  assert.deepEqual(s.cameBack, { withOwnData: 3, cameBack: 2, rate: 2 / 3 });
  assert.deepEqual({ sampleOnly: s.trust.sampleOnly, connectStarted: s.trust.connectStarted, connected: s.trust.connected }, { sampleOnly: 1, connectStarted: 2, connected: 1 });
  assert.equal(s.failures.length, 4);
  assert.equal(s.recentFailures[0].reason, "unsupported_type", "newest first");
});

// ---------- the off switch ----------

test("with USAGE_EVENTS not 'on', the endpoint stores nothing and says so", async () => {
  let touched = false;
  const db = new Proxy({}, { get() { touched = true; return () => { throw new Error("DB used"); }; } });
  const req = new Request("https://bus-idea.pages.dev/api/events", {
    method: "POST", headers: { Origin: "https://bus-idea.pages.dev", "Content-Type": "application/json" },
    body: JSON.stringify({ browserId: ID("a"), event: "visit" }),
  });
  for (const env of [{ DB: db }, { DB: db, USAGE_EVENTS: "off" }, { DB: db, USAGE_EVENTS: "ON" }]) {
    const res = await postEvent({ request: req.clone(), env });
    assert.deepEqual(await res.json(), { collecting: false });
  }
  assert.equal(touched, false);
  const crossSite = new Request("https://bus-idea.pages.dev/api/events", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" });
  assert.equal((await postEvent({ request: crossSite, env: { DB: db, USAGE_EVENTS: "on" } })).status, 403);
});
