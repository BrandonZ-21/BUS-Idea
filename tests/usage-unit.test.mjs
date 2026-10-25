// Unit tests for the founder dashboard's counting rules (lib/usage/*) and
// the events endpoint's "off" switch. All events here are synthetic.
// Run:  npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { EVENTS, cleanCountry, validateEvent } from "../lib/usage/events.js";
import { friendlySource, summarize } from "../lib/usage/summary.js";
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
  assert.deepEqual(validateEvent({ browserId: ID("a"), event: "visit" }), { ok: true, value: { browserId: ID("a"), event: "visit", reason: null, source: null, detail: null, refHost: null, refTag: null, device: null } });
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

test("events: pages, clicks, sources and devices only in their strict shapes", () => {
  const ok = (input) => assert.equal(validateEvent({ browserId: ID("a"), ...input }).ok, true, JSON.stringify(input));
  const no = (input, field) => assert.deepEqual(validateEvent({ browserId: ID("a"), ...input }), { ok: false, field }, JSON.stringify(input));
  ok({ event: "visit", detail: "home", refHost: "www.reddit.com", refTag: "reddit", device: "mobile" });
  ok({ event: "page_view", detail: "items" });
  ok({ event: "click", detail: "heroSampleBtn" });
  ok({ event: "click", detail: "nav:items" });
  ok({ event: "click", detail: "link:docs.google.com" });
  ok({ event: "engaged", reason: "2m" });
  // Anything that could carry data or free text is refused.
  no({ event: "page_view", detail: "Latte $4.50" }, "detail");
  no({ event: "page_view", detail: "secret-page" }, "detail");
  no({ event: "click", detail: "Latte 12oz" }, "detail");
  no({ event: "click", detail: "x".repeat(49) }, "detail");
  no({ event: "click", detail: "<script>" }, "detail");
  no({ event: "click" }, "detail");
  no({ event: "upload_ok", detail: "home" }, "detail");
  no({ event: "visit", refHost: "reddit.com/r/smallbusiness/comments/abc" }, "refHost");
  no({ event: "visit", refHost: "Reddit.com" }, "refHost");
  no({ event: "page_view", refHost: "reddit.com" }, "refHost");
  no({ event: "visit", refTag: "my cafe" }, "refTag");
  no({ event: "visit", device: "iPhone 15" }, "device");
  no({ event: "click", detail: "x", device: "mobile" }, "device");
  no({ event: "engaged", reason: "3h" }, "reason");
  no({ event: "visit", ip: "1.2.3.4" }, "ip");
});

test("country: only a two-letter code is kept, anything else becomes null", () => {
  assert.equal(cleanCountry("US"), "US");
  assert.equal(cleanCountry("us"), null);
  assert.equal(cleanCountry("1.2.3.4"), null);
  assert.equal(cleanCountry(undefined), null);
});

test("sources: first visit decides; tags win; hosts are tidied", () => {
  assert.equal(friendlySource("reddit", "www.google.com"), "link tag: reddit");
  assert.equal(friendlySource(null, "www.reddit.com"), "reddit.com");
  assert.equal(friendlySource(null, "out.reddit.com"), "reddit.com");
  assert.equal(friendlySource(null, "com.reddit.frontpage"), "reddit.com (app)");
  assert.equal(friendlySource(null, "www.google.co.uk"), "google");
  assert.equal(friendlySource(null, null), "direct / unknown");
  const visit = (b, daysAgo, extra) => ({ ...ev(b, daysAgo, "visit"), ref_host: null, ref_tag: null, country: null, device: null, detail: "home", ...extra });
  const s = summarize(data([
    visit("A", 3, { ref_tag: "reddit", country: "US", device: "mobile" }),
    visit("A", 1, { ref_host: "www.google.com", country: "US", device: "mobile" }), // later visit doesn't change A's source
    ev("A", 1, "upload_ok", null, "own"),
    visit("B", 2, { ref_host: "www.reddit.com", country: "CA", device: "desktop" }),
    ev("B", 2, "sample_loaded", null, "sample"),
    visit("C", 1, {}),
  ]), opts);
  assert.deepEqual(s.sources.map((x) => [x.source, x.browsers, x.ownIn, x.sampleOnly]), [
    ["direct / unknown", 1, 0, 0], ["link tag: reddit", 1, 1, 0], ["reddit.com", 1, 0, 1],
  ]);
  assert.deepEqual(s.countries, [{ country: "US", browsers: 1 }, { country: "CA", browsers: 1 }, { country: "unknown", browsers: 1 }].sort((a, b) => b.browsers - a.browsers || a.country.localeCompare(b.country)));
  assert.deepEqual(s.dataChoice, { square: 0, ownFile: 1, triedFailed: 0, sampleOnly: 1, lookedOnly: 1 });
  assert.deepEqual(s.visitors, { browsers: 3, newInWindow: null, returning: 1, sessions: 4 });
});

test("pages, clicks, time on page and visit journeys", () => {
  const at = (b, min, event, reason = null, detail = null, source = null) => ({ at: NOW - DAY + min * 60, browser_id: b, event, reason, source, detail });
  const s = summarize({ ...data([
    at("A", 0, "visit", null, "home"), at("A", 0, "page_view", null, "home"), at("A", 1, "click", null, "heroSampleBtn"),
    at("A", 1, "sample_loaded", null, null, "sample"), at("A", 2, "page_view", null, "dashboard"), at("A", 3, "engaged", "2m"),
    at("A", 40, "visit", null, "dashboard"), // 37 min later: a second visit
    at("B", 5, "visit", null, "home"), at("B", 5, "page_view", null, "home"), at("B", 6, "click", null, "heroSampleBtn"),
  ]), firstSeen: { A: NOW - 30 * DAY, B: NOW - DAY } }, opts);
  assert.deepEqual(s.pages, [{ page: "home", views: 2, browsers: 2 }, { page: "dashboard", views: 1, browsers: 1 }]);
  assert.deepEqual(s.clicks, [{ target: "heroSampleBtn", count: 2, browsers: 2 }]);
  assert.deepEqual(s.engagement, { under30s: 1, "30s": 0, "2m": 1, "5m": 0, "10m": 0 });
  assert.equal(s.visitors.newInWindow, 1, "A was first seen before the window");
  assert.equal(s.sessions.length, 3);
  assert.equal(s.sessions[0].visitor, 1, "A (first seen earliest) is Visitor 1");
  const first = s.sessions.find((x) => x.browserId === "A" && x.steps.length > 1);
  assert.deepEqual(first.steps.map((x) => x.event), ["visit", "page_view", "click", "sample_loaded", "page_view", "engaged"]);
  assert.equal(first.engaged, "2m");
  assert.equal(s.daily.length, 7);
  assert.equal(s.daily[5].browsers, 2);
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
  // The richer sections have demo numbers too.
  assert.equal(s.visitors.browsers, 9);
  assert.equal(s.visitors.newInWindow, 7);
  assert.deepEqual(s.dataChoice, { square: 1, ownFile: 2, triedFailed: 3, sampleOnly: 1, lookedOnly: 2 });
  assert.ok(s.sources.some((x) => x.source === "reddit.com (app)"));
  assert.ok(s.clicks.length > 0 && s.pages.length > 0 && s.sessions.length > 0);
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
