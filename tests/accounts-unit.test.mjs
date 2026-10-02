// Unit tests for lib/account/* and the capped JSON reader.
// Run:  npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { MAX_REPORT_BYTES, isReportId, validateReport } from "../lib/account/reports.js";
import { readJsonBody } from "../lib/square/http.js";
import { randomId } from "../lib/square/crypto.js";
import { sampleReport } from "./report-fixture.mjs";

test("a well-formed summary is accepted and normalized (money rounded to cents)", () => {
  const r = validateReport(sampleReport());
  assert.equal(r.ok, true);
  assert.equal(r.report.totals.sales, 12345.68);
  assert.deepEqual(Object.keys(r.report), ["v", "source", "periodStart", "periodEnd", "totals", "byWeekday", "byHour", "topItems", "insights"]);
  assert.equal(validateReport(sampleReport({ byHour: null })).ok, true, "files without times have no hourly data");
});

test("unknown fields are rejected -- including attempts to set owner, role or raw rows", () => {
  for (const extra of [{ merchantId: "SOMEONE_ELSE" }, { role: "admin" }, { rows: [{ date: "2026-08-01", item: "Latte" }] }, { id: "x" }]) {
    const r = validateReport(sampleReport(extra));
    assert.equal(r.ok, false, JSON.stringify(extra));
    assert.match(r.field, /^report\./);
  }
  assert.equal(validateReport(sampleReport({ topItems: [{ name: "Latte", quantity: 1, revenue: 1, customer: "Jane" }] })).ok, false);
  assert.equal(validateReport(sampleReport({ totals: { sales: 1, orders: 1, avgOrder: 1, cardNumber: "4111" } })).ok, false);
});

test("bad values are rejected with the field named", () => {
  const cases = [
    [{ v: 2 }, "v"],
    [{ source: "pos" }, "source"],
    [{ periodStart: "2026-02-30" }, "periodStart"],
    [{ periodStart: "2026-09-01", periodEnd: "2026-08-01" }, "periodEnd"],
    [{ totals: { sales: -5, orders: 1, avgOrder: 1 } }, "totals.sales"],
    [{ totals: { sales: 1, orders: 1.5, avgOrder: 1 } }, "totals.orders"],
    [{ totals: { sales: Infinity, orders: 1, avgOrder: 1 } }, "totals.sales"],
    [{ byWeekday: [1, 2, 3] }, "byWeekday"],
    [{ byHour: Array(24).fill("1") }, "byHour[0]"],
    [{ topItems: Array(11).fill({ name: "x", quantity: 1, revenue: 1 }) }, "topItems"],
    [{ topItems: [{ name: "x".repeat(81), quantity: 1, revenue: 1 }] }, "topItems[0].name"],
    [{ insights: [{ headline: "", action: "" }] }, "insights[0].headline"],
  ];
  for (const [over, field] of cases) assert.deepEqual(validateReport(sampleReport(over)), { ok: false, field }, JSON.stringify(over));
  assert.deepEqual(validateReport(null), { ok: false, field: "report" });
  assert.deepEqual(validateReport([]), { ok: false, field: "report" });
});

test("SQL-looking text is just text (stored as a value, never run)", () => {
  const r = validateReport(sampleReport({ topItems: [{ name: "'); DROP TABLE saved_reports; --", quantity: 1, revenue: 1 }] }));
  assert.equal(r.ok, true);
  assert.equal(r.report.topItems[0].name, "'); DROP TABLE saved_reports; --");
});

test("report ids: only the server's own random format is accepted", () => {
  assert.ok(isReportId(randomId(16)));
  for (const bad of ["", "1", "' OR 1=1 --", "../reports", randomId(32), null, 5]) assert.ok(!isReportId(bad), String(bad));
});

const post = (body, headers = { "Content-Type": "application/json" }) =>
  new Request("http://localhost/api/reports", { method: "POST", headers, body });

test("readJsonBody: needs JSON, caps size even without Content-Length, rejects bad JSON", async () => {
  assert.deepEqual(await readJsonBody(post('{"a":1}'), MAX_REPORT_BYTES), { ok: true, value: { a: 1 } });
  assert.deepEqual(await readJsonBody(post('{"a":1}', { "Content-Type": "text/plain" }), MAX_REPORT_BYTES), { ok: false, status: 415, error: "json_required" });
  assert.deepEqual(await readJsonBody(post("{nope"), MAX_REPORT_BYTES), { ok: false, status: 400, error: "bad_json" });
  const big = JSON.stringify({ pad: "x".repeat(MAX_REPORT_BYTES) });
  assert.deepEqual(await readJsonBody(post(big), MAX_REPORT_BYTES), { ok: false, status: 413, error: "too_large" });
  // A streamed body has no Content-Length; the reader still stops at the cap.
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < 20; i++) c.enqueue(new TextEncoder().encode("x".repeat(8192)));
      c.close();
    },
  });
  const req = new Request("http://localhost/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" });
  assert.deepEqual(await readJsonBody(req, MAX_REPORT_BYTES), { ok: false, status: 413, error: "too_large" });
});
