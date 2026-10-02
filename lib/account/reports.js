// Saved report summaries: validation and D1 access.
//
// A report is an allow-listed set of aggregates. validateReport() rejects
// anything else (unknown fields, raw rows, a "role" or "merchantId" field)
// and rebuilds a clean object, so only these fields are ever stored.
// Every query is scoped by the owner's merchant id from the server session.

import { randomId } from "../square/crypto.js";

export const MAX_REPORT_BYTES = 64 * 1024;
export const MAX_REPORTS_PER_ACCOUNT = 50;

const SOURCES = ["csv", "square", "mixed"];
const TOP_FIELDS = ["v", "source", "periodStart", "periodEnd", "totals", "byWeekday", "byHour", "topItems", "insights"];
const MAX_MONEY = 1e9;
const MAX_ITEMS = 10;
const MAX_INSIGHTS = 8;
const MAX_NAME = 80;
const MAX_TEXT = 300;

class InvalidReport extends Error {}

const fail = (what) => {
  throw new InvalidReport(what);
};

function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function onlyKeys(obj, allowed, what) {
  if (!isPlainObject(obj)) fail(what);
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) fail(`${what}.${k}`);
}

function amount(x, what) {
  if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > MAX_MONEY) fail(what);
  return Math.round(x * 100) / 100;
}

function count(x, what) {
  if (!Number.isInteger(x) || x < 0 || x > MAX_MONEY) fail(what);
  return x;
}

function text(x, max, what) {
  if (typeof x !== "string") fail(what);
  const s = x.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!s || s.length > max) fail(what);
  return s;
}

function isoDate(x, what) {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) fail(what);
  const d = new Date(`${x}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== x) fail(what);
  return x;
}

function amounts(list, length, what) {
  if (!Array.isArray(list) || list.length !== length) fail(what);
  return list.map((x, i) => amount(x, `${what}[${i}]`));
}

// Returns { ok: true, report } or { ok: false, field } naming the first bad field.
export function validateReport(input) {
  try {
    onlyKeys(input, TOP_FIELDS, "report");
    if (input.v !== 1) fail("v");
    if (!SOURCES.includes(input.source)) fail("source");
    const periodStart = isoDate(input.periodStart, "periodStart");
    const periodEnd = isoDate(input.periodEnd, "periodEnd");
    if (periodStart > periodEnd) fail("periodEnd");

    onlyKeys(input.totals, ["sales", "orders", "avgOrder"], "totals");
    const totals = {
      sales: amount(input.totals.sales, "totals.sales"),
      orders: count(input.totals.orders, "totals.orders"),
      avgOrder: amount(input.totals.avgOrder, "totals.avgOrder"),
    };

    const byWeekday = amounts(input.byWeekday, 7, "byWeekday");
    const byHour = input.byHour === null ? null : amounts(input.byHour, 24, "byHour");

    if (!Array.isArray(input.topItems) || input.topItems.length > MAX_ITEMS) fail("topItems");
    const topItems = input.topItems.map((it, i) => {
      onlyKeys(it, ["name", "quantity", "revenue"], `topItems[${i}]`);
      return {
        name: text(it.name, MAX_NAME, `topItems[${i}].name`),
        quantity: amount(it.quantity, `topItems[${i}].quantity`),
        revenue: amount(it.revenue, `topItems[${i}].revenue`),
      };
    });

    if (!Array.isArray(input.insights) || input.insights.length > MAX_INSIGHTS) fail("insights");
    const insights = input.insights.map((ins, i) => {
      onlyKeys(ins, ["headline", "action"], `insights[${i}]`);
      return {
        headline: text(ins.headline, MAX_TEXT, `insights[${i}].headline`),
        action: ins.action === "" ? "" : text(ins.action, MAX_TEXT, `insights[${i}].action`),
      };
    });

    return { ok: true, report: { v: 1, source: input.source, periodStart, periodEnd, totals, byWeekday, byHour, topItems, insights } };
  } catch (err) {
    if (err instanceof InvalidReport) return { ok: false, field: err.message };
    throw err;
  }
}

// ---------- D1 ----------

// Inserts only while the owner has fewer than MAX_REPORTS_PER_ACCOUNT, in a
// single statement so two saves at once can't both slip past the limit.
// Returns the new id, or null when the limit is reached.
export async function insertReport(db, merchantId, report) {
  const id = randomId(16);
  const result = await db
    .prepare(
      `INSERT INTO saved_reports (id, merchant_id, source, period_start, period_end, summary_json)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE (SELECT COUNT(*) FROM saved_reports WHERE merchant_id = ?2) < ?7`
    )
    .bind(id, merchantId, report.source, report.periodStart, report.periodEnd, JSON.stringify(report), MAX_REPORTS_PER_ACCOUNT)
    .run();
  return result.meta.changes === 1 ? id : null;
}

// Newest first; list view only needs the headline numbers.
export async function listReports(db, merchantId) {
  const { results } = await db
    .prepare(
      `SELECT id, created_at, source, period_start, period_end, summary_json
       FROM saved_reports WHERE merchant_id = ?1 ORDER BY created_at DESC, id LIMIT ?2`
    )
    .bind(merchantId, MAX_REPORTS_PER_ACCOUNT)
    .all();
  return results.map((r) => {
    const s = JSON.parse(r.summary_json);
    return {
      id: r.id,
      savedAt: new Date(r.created_at * 1000).toISOString(),
      source: r.source,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      totalSales: s.totals.sales,
      orders: s.totals.orders,
    };
  });
}

// Owner-scoped: someone else's id simply isn't found.
export async function getReport(db, merchantId, id) {
  const row = await db
    .prepare("SELECT id, created_at, summary_json FROM saved_reports WHERE id = ?1 AND merchant_id = ?2")
    .bind(id, merchantId)
    .first();
  return row ? { id: row.id, savedAt: new Date(row.created_at * 1000).toISOString(), report: JSON.parse(row.summary_json) } : null;
}

export async function deleteReport(db, merchantId, id) {
  const result = await db.prepare("DELETE FROM saved_reports WHERE id = ?1 AND merchant_id = ?2").bind(id, merchantId).run();
  return result.meta.changes;
}

export async function deleteAllReports(db, merchantId) {
  const result = await db.prepare("DELETE FROM saved_reports WHERE merchant_id = ?1").bind(merchantId).run();
  return result.meta.changes;
}

// Ids are made by randomId(16): 22 url-safe characters.
export function isReportId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{22}$/.test(id);
}
