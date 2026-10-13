// Advisory insights: the facts. Pure calculation -- no DOM, no network, no
// wording. Every number an owner will ever read in an insight is computed
// here from the sales rows; js/insight-text.js only turns these facts into
// English or Chinese sentences and may not add a number of its own.
//
// Input rows are the app's sales rows ({ date, time, item, quantity, price,
// orderId, kind, ... }) with one-off payments and closed days ALREADY left
// out by the caller (see normalSellingRows in app.js), and indexItems(rows)
// already called so itemRowsFor can split packed Square receipts.
// Optional row fields used when a Square export provides them:
//   refund (true on a refund row), discount (dollars off that receipt),
//   location, orderType.
//
// Rules of the house:
//  - Days and hours are compared by PER-DAY AVERAGES over days that had
//    sales, never by totals (a weekday that occurs more often isn't "better").
//  - Every rule has a minimum sample (INSIGHT_MIN). Below it the rule
//    returns status "not_enough" with what it needs and what it has.
//  - Nothing here predicts a result. `strength` and `reach` only rank
//    insights against each other: how marked the pattern is (0-1) and how
//    much of the business it touches (0-1). Neither is ever shown.

const INSIGHT_MIN = {
  sellingDays: 14, // nothing at all is offered on less than two weeks of selling
  timedDays: 14, // selling days with a time of day, for any hour-based rule
  weekdayOccurrences: 4, // of EACH weekday being compared
  weekdaysCompared: 3,
  weekdayGapPct: 15,
  regularHours: 4,
  itemUnits: 50,
  distinctItems: 8,
  longTailItems: 12,
  longTailWeeks: 8,
  pairReceipts: 20, // receipts containing both items
  pairItemReceipts: 30, // receipts containing each item
  pairLift: 1.5,
  receipts: 200,
  singleItemSharePct: 40,
  trendWindowDays: 28,
  trendSellingDays: 14, // in each 28-day window
  months: 4,
  monthSellingDays: 15,
  monthGapPct: 20,
  refundPayments: 200,
  groupReceipts: 50, // per channel or location being compared
};

const INSIGHT_CONF_WEIGHT = { high: 1, medium: 0.6, low: 0.3 };

// How sure, from sample size alone: 3x the minimum is "high", 1.5x "medium".
function insightConfidence(n, min) {
  return n >= min * 3 ? "high" : n >= min * 1.5 ? "medium" : "low";
}

function insightLowerConfidence(c) {
  return c === "high" ? "medium" : "low";
}

function insightRound2(x) {
  return Math.round(x * 100) / 100;
}

function insightPct(part, whole) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function insightNotEnough(id, angle, link, needs) {
  return { id, angle, link, status: "not_enough", needs };
}

// The lowest/highest-sum run of `width` consecutive hours inside [from, to].
function insightHourWindow(perHour, from, to, width, pickMax) {
  let best = null;
  for (let h = from; h + width - 1 <= to; h++) {
    let sum = 0;
    for (let k = 0; k < width; k++) sum += perHour[h + k];
    if (!best || (pickMax ? sum > best.sum : sum < best.sum)) best = { start: h, end: h + width, sum };
  }
  return best;
}

// Everything the rules share, computed once.
function insightContext(rows) {
  const refundRows = rows.filter((r) => r.refund || rowRevenue(r) < 0);
  const sales = rows.filter((r) => !r.refund && rowRevenue(r) > 0);
  const range = dateRangeOf(sales);
  const totalSales = sales.reduce((s, r) => s + rowRevenue(r), 0);
  const sellingDates = new Set(sales.map((r) => r.date));
  const spanDays = range ? Math.round(weeksCovered(sales) * 7) : 0;

  const receiptKey = (r) => r.orderId || `${r.date}|${r.time || ""}`;
  const receipts = new Map();
  sales.forEach((r) => {
    const key = receiptKey(r);
    const rc = receipts.get(key) || { date: r.date, time: r.time, total: 0, units: 0, items: new Set(), orderType: r.orderType || null, location: r.location || null };
    rc.total += rowRevenue(r);
    receipts.set(key, rc);
  });
  const items = itemRowsFor(sales).filter((it) => it.kind === "product" && it.qty > 0);
  items.forEach((it) => {
    const rc = receipts.get(receiptKey(it.receipt));
    if (!rc) return;
    rc.units += it.qty;
    rc.items.add(it.name);
  });

  return { rows, sales, refundRows, range, totalSales, sellingDates, spanDays, weeks: spanDays / 7, receipts, items, receiptKey };
}

// ---------- Timing ----------

function insightHourStats(ctx) {
  const timed = ctx.sales.filter((r) => r.time);
  const timedDates = new Set(timed.map((r) => r.date));
  const totals = new Array(24).fill(0);
  const daysWithSales = Array.from({ length: 24 }, () => new Set());
  timed.forEach((r) => {
    const h = rowHour(r);
    totals[h] += rowRevenue(r);
    daysWithSales[h].add(r.date);
  });
  const days = timedDates.size;
  const perDay = totals.map((v) => (days ? v / days : 0));
  // "Regular" hours: sold something on at least half the selling days.
  const regular = [];
  for (let h = 0; h < 24; h++) if (days && daysWithSales[h].size >= days * 0.5) regular.push(h);
  return { timed, days, totals, perDay, regular, timedSales: totals.reduce((s, v) => s + v, 0) };
}

function insightBusiestWindow(ctx, hs) {
  const id = "busiestWindow", angle = "timing", link = "#/heatmap";
  if (hs.days < INSIGHT_MIN.timedDays) return insightNotEnough(id, angle, link, { what: "timedDays", need: INSIGHT_MIN.timedDays, have: hs.days });
  const win = insightHourWindow(hs.perDay, 0, 23, 2, true);
  const sharePct = insightPct(win.sum, hs.perDay.reduce((s, v) => s + v, 0));

  // The weekday on which that window is strongest (per occurrence of that weekday).
  const dowSales = new Array(7).fill(0);
  const dowDates = Array.from({ length: 7 }, () => new Set());
  hs.timed.forEach((r) => {
    const dow = rowDayOfWeek(r);
    dowDates[dow].add(r.date);
    const h = rowHour(r);
    if (h >= win.start && h < win.end) dowSales[dow] += rowRevenue(r);
  });
  let peak = null;
  for (let d = 0; d < 7; d++) {
    const n = dowDates[d].size;
    if (n < INSIGHT_MIN.weekdayOccurrences) continue;
    const avg = dowSales[d] / n;
    if (!peak || avg > peak.avg) peak = { dow: d, avg, n };
  }

  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(hs.days, INSIGHT_MIN.timedDays),
    strength: Math.min(1, (sharePct / 100) * 2), reach: sharePct / 100,
    facts: {
      startHour: win.start, endHour: win.end,
      avgPerDay: insightRound2(win.sum), sharePct: Math.round(sharePct),
      peakDow: peak ? peak.dow : null, peakDowAvg: peak ? insightRound2(peak.avg) : null, peakDowDays: peak ? peak.n : null,
    },
    sample: { sellingDays: hs.days },
  };
}

function insightSlowHours(ctx, hs) {
  const id = "slowHours", angle = "timing", link = "#/hours";
  if (hs.days < INSIGHT_MIN.timedDays) return insightNotEnough(id, angle, link, { what: "timedDays", need: INSIGHT_MIN.timedDays, have: hs.days });
  if (hs.regular.length < INSIGHT_MIN.regularHours) return insightNotEnough(id, angle, link, { what: "regularHours", need: INSIGHT_MIN.regularHours, have: hs.regular.length });
  const open = hs.regular[0], close = hs.regular[hs.regular.length - 1];
  // The opening and closing hours are quiet by nature; look between them.
  const quiet = close - open >= 4 ? insightHourWindow(hs.perDay, open + 1, close - 1, 2, false) : null;
  if (!quiet) return insightNotEnough(id, angle, link, { what: "regularHours", need: 5, have: close - open + 1 });
  const openHours = close - open + 1;
  let openSum = 0;
  for (let h = open; h <= close; h++) openSum += hs.perDay[h];
  const typicalWindow = (openSum / openHours) * 2;
  const belowPct = typicalWindow > 0 ? (1 - quiet.sum / typicalWindow) * 100 : 0;
  if (belowPct < 25) return insightNotEnough(id, angle, link, { what: "noClearPattern" });
  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(hs.days, INSIGHT_MIN.timedDays),
    strength: Math.min(1, belowPct / 100), reach: 2 / openHours,
    facts: {
      startHour: quiet.start, endHour: quiet.end, avgPerDay: insightRound2(quiet.sum),
      typicalAvgPerDay: insightRound2(typicalWindow), belowPct: Math.round(belowPct),
      openHour: open, closeHour: close + 1,
    },
    sample: { sellingDays: hs.days },
  };
}

function insightBestSlowDay(ctx) {
  const id = "bestSlowDay", angle = "timing", link = "#/days";
  const totals = new Array(7).fill(0);
  const dates = Array.from({ length: 7 }, () => new Set());
  ctx.sales.forEach((r) => {
    const dow = rowDayOfWeek(r);
    totals[dow] += rowRevenue(r);
    dates[dow].add(r.date);
  });
  const days = [];
  for (let d = 0; d < 7; d++) {
    if (dates[d].size >= INSIGHT_MIN.weekdayOccurrences) days.push({ dow: d, n: dates[d].size, avg: totals[d] / dates[d].size, total: totals[d] });
  }
  if (days.length < INSIGHT_MIN.weekdaysCompared) {
    return insightNotEnough(id, angle, link, { what: "weekdayOccurrences", need: INSIGHT_MIN.weekdayOccurrences, have: Math.max(0, ...dates.map((s) => s.size)) });
  }
  const best = days.reduce((a, b) => (b.avg > a.avg ? b : a));
  const slow = days.reduce((a, b) => (b.avg < a.avg ? b : a));
  const gapPct = slow.avg > 0 ? ((best.avg - slow.avg) / slow.avg) * 100 : 0;
  if (gapPct < INSIGHT_MIN.weekdayGapPct) return insightNotEnough(id, angle, link, { what: "noClearPattern" });
  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(Math.min(best.n, slow.n), INSIGHT_MIN.weekdayOccurrences),
    strength: Math.min(1, gapPct / 100), reach: insightPct(best.total + slow.total, ctx.totalSales) / 100,
    facts: {
      bestDow: best.dow, bestAvg: insightRound2(best.avg), bestDays: best.n,
      slowDow: slow.dow, slowAvg: insightRound2(slow.avg), slowDays: slow.n,
      gapPct: Math.round(gapPct), gapAmount: insightRound2(best.avg - slow.avg),
      times: Math.round((best.avg / slow.avg) * 10) / 10,
    },
    sample: { sellingDays: ctx.sellingDates.size },
  };
}

// ---------- Product mix ----------

function insightItemTotals(ctx) {
  const map = new Map();
  ctx.items.forEach((it) => {
    const cur = map.get(it.name) || { name: it.name, units: 0, revenue: 0 };
    cur.units += it.qty;
    cur.revenue += it.lineTotal;
    map.set(it.name, cur);
  });
  const list = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
  return { list, units: list.reduce((s, x) => s + x.units, 0), revenue: list.reduce((s, x) => s + x.revenue, 0) };
}

function insightTopSellers(ctx, it) {
  const id = "topSellers", angle = "mix", link = "#/items";
  if (it.units < INSIGHT_MIN.itemUnits) return insightNotEnough(id, angle, link, { what: "itemUnits", need: INSIGHT_MIN.itemUnits, have: it.units });
  if (it.list.length < INSIGHT_MIN.distinctItems) return insightNotEnough(id, angle, link, { what: "distinctItems", need: INSIGHT_MIN.distinctItems, have: it.list.length });
  const top = it.list.slice(0, 3).map((x) => ({ name: x.name, units: x.units, revenue: insightRound2(x.revenue), sharePct: Math.round(insightPct(x.revenue, it.revenue)) }));
  const top3Share = insightPct(it.list.slice(0, 3).reduce((s, x) => s + x.revenue, 0), it.revenue);
  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(it.units, INSIGHT_MIN.itemUnits),
    strength: top3Share / 100, reach: top3Share / 100,
    facts: { top, top3SharePct: Math.round(top3Share), distinctItems: it.list.length },
    sample: { units: it.units },
  };
}

function insightLongTail(ctx, it) {
  const id = "longTail", angle = "mix", link = "#/items";
  if (ctx.weeks < INSIGHT_MIN.longTailWeeks) return insightNotEnough(id, angle, link, { what: "weeks", need: INSIGHT_MIN.longTailWeeks, have: Math.floor(ctx.weeks) });
  if (it.list.length < INSIGHT_MIN.longTailItems) return insightNotEnough(id, angle, link, { what: "distinctItems", need: INSIGHT_MIN.longTailItems, have: it.list.length });
  // The slower-selling half of the menu, by revenue.
  const tail = it.list.slice(Math.ceil(it.list.length / 2));
  const tailRevenue = tail.reduce((s, x) => s + x.revenue, 0);
  const tailPct = insightPct(tailRevenue, it.revenue);
  if (tailPct > 15) return insightNotEnough(id, angle, link, { what: "noClearPattern" });
  const slowest = tail.slice(-3).reverse().map((x) => ({ name: x.name, units: x.units, revenue: insightRound2(x.revenue) }));
  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(ctx.weeks, INSIGHT_MIN.longTailWeeks),
    strength: Math.min(1, tail.length / it.list.length + (15 - tailPct) / 30), reach: Math.max(0.05, tailPct / 100),
    facts: { tailItems: tail.length, distinctItems: it.list.length, tailRevenuePct: tailPct >= 1 ? Math.round(tailPct) : insightRound2(tailPct), tailRevenue: insightRound2(tailRevenue), slowest },
    sample: { weeks: Math.floor(ctx.weeks) },
  };
}

function insightPairs(ctx) {
  const id = "pairs", angle = "mix", link = "#/items";
  const n = ctx.receipts.size;
  if (n < INSIGHT_MIN.receipts) return insightNotEnough(id, angle, link, { what: "receipts", need: INSIGHT_MIN.receipts, have: n });
  const itemCount = new Map();
  const pairCount = new Map();
  ctx.receipts.forEach((rc) => {
    const names = Array.from(rc.items).sort();
    names.forEach((a) => itemCount.set(a, (itemCount.get(a) || 0) + 1));
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = names[i] + "\u0000" + names[j];
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
    }
  });
  let best = null;
  pairCount.forEach((both, key) => {
    if (both < INSIGHT_MIN.pairReceipts) return;
    const [x, y] = key.split("\u0000");
    const cx = itemCount.get(x), cy = itemCount.get(y);
    if (cx < INSIGHT_MIN.pairItemReceipts || cy < INSIGHT_MIN.pairItemReceipts) return;
    const lift = (both / n) / ((cx / n) * (cy / n));
    if (lift < INSIGHT_MIN.pairLift) return;
    if (!best || both > best.both || (both === best.both && key < best.key)) best = { key, x, y, cx, cy, both, lift };
  });
  if (!best) return insightNotEnough(id, angle, link, { what: "pairReceipts", need: INSIGHT_MIN.pairReceipts, have: Math.max(0, ...pairCount.values()) });
  // "Anchor" = the item whose buyers more often add the other one.
  const anchorIsX = best.both / best.cx >= best.both / best.cy;
  const anchor = anchorIsX ? best.x : best.y, addOn = anchorIsX ? best.y : best.x;
  const anchorReceipts = anchorIsX ? best.cx : best.cy, addOnReceipts = anchorIsX ? best.cy : best.cx;
  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(best.both, INSIGHT_MIN.pairReceipts),
    strength: Math.min(1, (best.lift - 1) / 2), reach: anchorReceipts / n,
    facts: {
      anchor, addOn, both: best.both, anchorReceipts,
      withPct: Math.round(insightPct(best.both, anchorReceipts)),
      basePct: Math.round(insightPct(addOnReceipts, n)),
      withoutReceipts: anchorReceipts - best.both, receipts: n,
    },
    sample: { pairReceipts: best.both },
  };
}

// ---------- Pricing and order size ----------

function insightOrderSize(ctx) {
  const id = "orderSize", angle = "pricing", link = "#/dashboard";
  const all = Array.from(ctx.receipts.values()).filter((rc) => rc.units > 0);
  if (all.length < INSIGHT_MIN.receipts) return insightNotEnough(id, angle, link, { what: "receipts", need: INSIGHT_MIN.receipts, have: all.length });
  const single = all.filter((rc) => rc.units === 1);
  const multi = all.filter((rc) => rc.units > 1);
  const sum = (list) => list.reduce((s, rc) => s + rc.total, 0);
  const singlePct = insightPct(single.length, all.length);
  if (singlePct < INSIGHT_MIN.singleItemSharePct || !multi.length) return insightNotEnough(id, angle, link, { what: "noClearPattern" });
  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(all.length, INSIGHT_MIN.receipts),
    strength: singlePct / 100, reach: insightPct(sum(single), sum(all)) / 100,
    facts: {
      singlePct: Math.round(singlePct), singleReceipts: single.length,
      avgOrder: insightRound2(sum(all) / all.length),
      avgSingle: insightRound2(sum(single) / single.length),
      avgMulti: insightRound2(sum(multi) / multi.length), multiReceipts: multi.length,
    },
    sample: { receipts: all.length },
  };
}

// ---------- Trends ----------

function insightRecentTrend(ctx) {
  const id = "recentTrend", angle = "trends", link = "#/trend";
  const w = INSIGHT_MIN.trendWindowDays;
  if (!ctx.range || ctx.spanDays < w * 2) return insightNotEnough(id, angle, link, { what: "days", need: w * 2, have: ctx.spanDays });
  const end = ctx.range.max;
  const recentStart = shiftDate(end, -(w - 1));
  const priorEnd = shiftDate(end, -w);
  const priorStart = shiftDate(end, -(w * 2 - 1));
  const windowOf = (from, to) => {
    const list = ctx.sales.filter((r) => r.date >= from && r.date <= to);
    const days = new Set(list.map((r) => r.date)).size;
    const total = list.reduce((s, r) => s + rowRevenue(r), 0);
    return { from, to, days, total, avg: days ? total / days : 0, list };
  };
  const recent = windowOf(recentStart, end), prior = windowOf(priorStart, priorEnd);
  const minDays = Math.min(recent.days, prior.days);
  if (minDays < INSIGHT_MIN.trendSellingDays) return insightNotEnough(id, angle, link, { what: "sellingDaysPerWindow", need: INSIGHT_MIN.trendSellingDays, have: minDays });
  const changePct = prior.avg > 0 ? ((recent.avg - prior.avg) / prior.avg) * 100 : 0;

  // The item whose sales per selling day moved most between the two windows.
  const perDayByItem = (win) => {
    const m = new Map();
    itemRowsFor(win.list).filter((it) => it.kind === "product" && it.qty > 0).forEach((it) => m.set(it.name, (m.get(it.name) || 0) + it.lineTotal / win.days));
    return m;
  };
  const a = perDayByItem(recent), b = perDayByItem(prior);
  let mover = null;
  new Set([...a.keys(), ...b.keys()]).forEach((name) => {
    const change = (a.get(name) || 0) - (b.get(name) || 0);
    if (!mover || Math.abs(change) > Math.abs(mover.change) || (Math.abs(change) === Math.abs(mover.change) && name < mover.name)) mover = { name, change };
  });

  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(minDays, INSIGHT_MIN.trendSellingDays),
    strength: Math.min(1, Math.abs(changePct) / 30), reach: 1,
    facts: {
      direction: Math.abs(changePct) < 5 ? "flat" : changePct > 0 ? "up" : "down",
      changePct: Math.round(Math.abs(changePct)),
      recentAvg: insightRound2(recent.avg), recentDays: recent.days, recentFrom: recent.from, recentTo: recent.to,
      priorAvg: insightRound2(prior.avg), priorDays: prior.days, priorFrom: prior.from, priorTo: prior.to,
      moverName: mover && Math.abs(mover.change) >= 0.005 ? mover.name : null,
      moverDirection: mover && mover.change < 0 ? "down" : "up",
      moverPerDay: mover ? insightRound2(Math.abs(mover.change)) : null,
    },
    sample: { sellingDays: recent.days + prior.days },
  };
}

function insightSeasonality(ctx) {
  const id = "seasonality", angle = "trends", link = "#/trend";
  const byMonth = new Map();
  ctx.sales.forEach((r) => {
    const key = r.date.slice(0, 7);
    const m = byMonth.get(key) || { month: key, total: 0, dates: new Set() };
    m.total += rowRevenue(r);
    m.dates.add(r.date);
    byMonth.set(key, m);
  });
  const months = Array.from(byMonth.values())
    .filter((m) => m.dates.size >= INSIGHT_MIN.monthSellingDays)
    .map((m) => ({ month: m.month, days: m.dates.size, avg: m.total / m.dates.size }));
  if (months.length < INSIGHT_MIN.months) return insightNotEnough(id, angle, link, { what: "months", need: INSIGHT_MIN.months, have: months.length });
  const best = months.reduce((x, y) => (y.avg > x.avg ? y : x));
  const slow = months.reduce((x, y) => (y.avg < x.avg ? y : x));
  const gapPct = slow.avg > 0 ? ((best.avg - slow.avg) / slow.avg) * 100 : 0;
  if (gapPct < INSIGHT_MIN.monthGapPct) return insightNotEnough(id, angle, link, { what: "noClearPattern" });
  const underAYear = ctx.spanDays < 395;
  return {
    id, angle, link, status: "ok",
    // One pass through the calendar can't separate "season" from "that year".
    confidence: underAYear ? "low" : insightConfidence(months.length, INSIGHT_MIN.months * 3),
    strength: Math.min(1, gapPct / 100), reach: 0.5,
    facts: {
      bestMonth: best.month, bestAvg: insightRound2(best.avg), bestDays: best.days,
      slowMonth: slow.month, slowAvg: insightRound2(slow.avg), slowDays: slow.days,
      gapPct: Math.round(gapPct), times: Math.round((best.avg / slow.avg) * 10) / 10, monthsCompared: months.length, underAYear,
    },
    sample: { months: months.length },
  };
}

// ---------- Operations ----------

function insightRefunds(ctx) {
  const id = "refunds", angle = "operations", link = "#/items";
  const payments = ctx.receipts.size;
  if (payments < INSIGHT_MIN.refundPayments) return insightNotEnough(id, angle, link, { what: "receipts", need: INSIGHT_MIN.refundPayments, have: payments });
  const refundKeys = new Set(ctx.refundRows.map(ctx.receiptKey));
  const refundAmount = ctx.refundRows.reduce((s, r) => s + Math.abs(rowRevenue(r)), 0);
  if (!refundKeys.size) return insightNotEnough(id, angle, link, { what: "noRefunds" });
  const ratePct = insightPct(refundKeys.size, payments);
  return {
    id, angle, link, status: "ok",
    // A handful of refunds says little about why they happen.
    confidence: refundKeys.size < 10 ? "low" : insightConfidence(refundKeys.size, 10),
    strength: Math.min(1, ratePct / 5), reach: Math.max(0.05, insightPct(refundAmount, ctx.totalSales) / 100),
    facts: {
      refunds: refundKeys.size, ratePct: insightRound2(ratePct), per1000: Math.round(ratePct * 10),
      refundAmount: insightRound2(refundAmount), amountPct: insightRound2(insightPct(refundAmount, ctx.totalSales)), payments,
    },
    sample: { refunds: refundKeys.size },
  };
}

function insightDiscounts(ctx) {
  const id = "discounts", angle = "operations", link = "#/dashboard";
  const withField = ctx.sales.filter((r) => typeof r.discount === "number");
  if (!withField.length) return insightNotEnough(id, angle, link, { what: "noDiscountColumn" });
  const discounted = withField.filter((r) => r.discount > 0);
  if (!discounted.length) return insightNotEnough(id, angle, link, { what: "noDiscounts" });
  const amount = discounted.reduce((s, r) => s + r.discount, 0);
  const keys = new Set(discounted.map(ctx.receiptKey));
  if (keys.size < INSIGHT_MIN.pairReceipts) return insightNotEnough(id, angle, link, { what: "discountedReceipts", need: INSIGHT_MIN.pairReceipts, have: keys.size });
  const pctOfSales = insightPct(amount, ctx.totalSales);
  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(keys.size, INSIGHT_MIN.pairReceipts),
    strength: Math.min(1, pctOfSales / 10), reach: keys.size / ctx.receipts.size,
    facts: { discountedReceipts: keys.size, receiptPct: Math.round(insightPct(keys.size, ctx.receipts.size)), amount: insightRound2(amount), pctOfSales: insightRound2(pctOfSales) },
    sample: { receipts: ctx.receipts.size },
  };
}

// ---------- Channels and locations ----------

function insightChannels(ctx) {
  const id = "channels", angle = "channels", link = "#/order-types";
  const groupsFor = (field) => {
    const m = new Map();
    ctx.receipts.forEach((rc) => {
      const key = rc[field];
      if (!key) return;
      const g = m.get(key) || { name: key, receipts: 0, total: 0 };
      g.receipts++;
      g.total += rc.total;
      m.set(key, g);
    });
    return Array.from(m.values()).filter((g) => g.receipts >= INSIGHT_MIN.groupReceipts);
  };
  let kind = "location", groups = groupsFor("location");
  if (groups.length < 2) { kind = "orderType"; groups = groupsFor("orderType"); }
  if (groups.length < 2) return insightNotEnough(id, angle, link, { what: "groups", need: 2, have: groups.length });
  groups.forEach((g) => { g.avg = g.total / g.receipts; });
  const high = groups.reduce((x, y) => (y.avg > x.avg ? y : x));
  const low = groups.reduce((x, y) => (y.avg < x.avg ? y : x));
  const gapPct = low.avg > 0 ? ((high.avg - low.avg) / low.avg) * 100 : 0;
  if (gapPct < 10) return insightNotEnough(id, angle, link, { what: "noClearPattern" });
  const counted = groups.reduce((s, g) => s + g.receipts, 0);
  return {
    id, angle, link: kind === "location" ? "#/dashboard" : link, status: "ok",
    confidence: insightConfidence(Math.min(high.receipts, low.receipts), INSIGHT_MIN.groupReceipts),
    strength: Math.min(1, gapPct / 100), reach: Math.min(high.receipts, low.receipts) / counted,
    facts: {
      kind, highName: high.name, highAvg: insightRound2(high.avg), highReceipts: high.receipts,
      lowName: low.name, lowAvg: insightRound2(low.avg), lowReceipts: low.receipts, gapPct: Math.round(gapPct),
    },
    sample: { receipts: counted },
  };
}

// ---------- The memo ----------

// Returns { meta, insights, top3, notEnough, cantTell }:
//   insights   every rule that found something, strongest first
//   top3       ids of the three to act on first
//   notEnough  rules that didn't have the data (with what they need)
//   cantTell   keys for the "what this data can't tell you" note
function generateInsightFacts(rows) {
  const ctx = insightContext(rows);
  const meta = {
    start: ctx.range ? ctx.range.min : null, end: ctx.range ? ctx.range.max : null,
    spanDays: ctx.spanDays, sellingDays: ctx.sellingDates.size, receipts: ctx.receipts.size,
    totalSales: insightRound2(ctx.totalSales),
  };
  if (!ctx.sales.length) return { meta, insights: [], top3: [], notEnough: [], cantTell: [] };

  const hs = insightHourStats(ctx);
  const it = insightItemTotals(ctx);
  const all = [
    insightBusiestWindow(ctx, hs), insightSlowHours(ctx, hs), insightBestSlowDay(ctx),
    insightTopSellers(ctx, it), insightLongTail(ctx, it), insightPairs(ctx),
    insightOrderSize(ctx), insightRecentTrend(ctx), insightSeasonality(ctx),
    insightRefunds(ctx), insightDiscounts(ctx), insightChannels(ctx),
  ].map((x) => (x.status === "ok" && meta.sellingDays < INSIGHT_MIN.sellingDays
    ? insightNotEnough(x.id, x.angle, x.link, { what: "sellingDays", need: INSIGHT_MIN.sellingDays, have: meta.sellingDays })
    : x));
  const score = (x) => INSIGHT_CONF_WEIGHT[x.confidence] * x.strength * x.reach;
  const insights = all.filter((x) => x.status === "ok").sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));

  // Top 3: strongest first, but no more than one per angle, so the list
  // isn't three versions of "you're busy at lunch".
  const top3 = [];
  const usedAngles = new Set();
  insights.forEach((x) => {
    if (top3.length < 3 && !usedAngles.has(x.angle)) { top3.push(x.id); usedAngles.add(x.angle); }
  });
  insights.forEach((x) => { if (top3.length < 3 && !top3.includes(x.id)) top3.push(x.id); });

  const cantTell = ["profit", "nonBuyers", "cause", "labour"];
  if (ctx.spanDays < 395) cantTell.push("oneYear");
  if (!ctx.sales.some((r) => typeof r.discount === "number")) cantTell.push("discounts");
  cantTell.push("weather");

  return { meta, insights, top3, notEnough: all.filter((x) => x.status === "not_enough"), cantTell };
}
