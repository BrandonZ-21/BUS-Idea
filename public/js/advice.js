// More advice from the owner's own data: the facts. Pure calculation, like
// js/insights.js -- no DOM, no network, no wording. Every rule returns the
// same shape as an insight there:
//   { id, angle, link, status: "ok", confidence, strength, reach, facts, sample, chart? }
// or insightNotEnough(...) when the data can't support it yet. A rule that
// has nothing to say at all (e.g. no rain in the forecast) returns null.
//
// Inputs:
//   rows  normal selling rows (closed days and one-offs already left out)
//   env   what else the page knows, all from this browser:
//     { today, notes, isHoliday(date), weather: Map, localDates: [...],
//       outside: { bls } | null, inputs: { fees, fixedMonthly, costPct } }
// Thresholds: ADVICE_CONFIG.min in js/advice-config.js.
//
// Nothing here claims a cause. Comparisons say what changed next to what,
// and the wording (js/advice-text.js) always adds that other things may matter.

function adviceMin() {
  return ADVICE_CONFIG.min;
}

// Sales per selling day: Map date -> total (sales only, refunds left out).
function adviceDailyTotals(ctx) {
  const m = new Map();
  ctx.sales.forEach((r) => m.set(r.date, (m.get(r.date) || 0) + rowRevenue(r)));
  return m;
}

function adviceAvg(list) {
  return list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0;
}

function adviceDaysBetween(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Signed % change from `before` to `after`, rounded; null if before is 0.
function adviceChangePct(before, after) {
  return before > 0 ? Math.round(((after - before) / before) * 100) : null;
}

// ---------- 1. Did my change work? (Day Notes and promos) ----------

// Every note as a period: { start, end, note }. Closed days are not changes.
function adviceNotePeriods(notes) {
  return (notes || [])
    .filter((n) => n && n.date && !(n.tags || []).includes("closed"))
    .map((n) => ({ start: n.date, end: n.endDate && n.endDate >= n.date ? n.endDate : n.date, note: n }))
    .sort((a, b) => (a.start < b.start ? 1 : -1)); // newest first
}

function adviceNoteImpact(ctx, env) {
  const id = "noteImpact", angle = "change", link = "#/notes";
  const M = adviceMin();
  const periods = adviceNotePeriods(env.notes);
  if (!periods.length) return insightNotEnough(id, angle, link, { what: "noNotes" });
  const daily = adviceDailyTotals(ctx);
  const inAnyNote = (d) => periods.some((p) => d >= p.start && d <= p.end);
  const isHoliday = env.isHoliday || (() => false);

  const results = [];
  let bestHave = 0;
  periods.forEach((p) => {
    const periodDays = [];
    for (let d = p.start; d <= p.end; d = shiftDate(d, 1)) if (daily.has(d)) periodDays.push(d);
    if (!periodDays.length) return;
    // Same weekday, 1..N weeks before the note started (and after it ended):
    // only ordinary selling days -- no holidays and no other noted days.
    const comp = new Set();
    periodDays.forEach((d) => {
      for (let k = 1; k <= M.noteLookbackWeeks; k++) {
        [shiftDate(d, -7 * k), shiftDate(d, 7 * k)].forEach((c) => {
          if ((c < p.start || c > p.end) && daily.has(c) && !isHoliday(c) && !inAnyNote(c)) comp.add(c);
        });
      }
    });
    const compDays = Array.from(comp);
    bestHave = Math.max(bestHave, compDays.length);
    if (compDays.length < M.noteComparisonDays) return;
    const periodAvg = adviceAvg(periodDays.map((d) => daily.get(d)));
    const compAvg = adviceAvg(compDays.map((d) => daily.get(d)));
    results.push({
      label: (p.note.text || "").trim().slice(0, 60) || null,
      tag: (p.note.tags || []).find((t) => t !== "closed") || null,
      isPromo: (p.note.tags || []).includes("promo"),
      start: p.start, end: p.end,
      periodDays: periodDays.length,
      periodAvg: insightRound2(periodAvg), compAvg: insightRound2(compAvg),
      diffPct: adviceChangePct(compAvg, periodAvg),
      beforeDays: compDays.filter((d) => d < p.start).length,
      afterDays: compDays.filter((d) => d > p.end).length,
      compDays: compDays.length,
    });
  });
  if (!results.length) return insightNotEnough(id, angle, link, { what: "noteComparison", need: M.noteComparisonDays, have: bestHave });

  // Headline: the newest promo if there is one, else the newest note.
  const head = results.find((r) => r.isPromo) || results[0];
  const others = results.filter((r) => r !== head).slice(0, M.noteMaxCards - 1);
  // A comparison is never proof, so it is never "high".
  let confidence = insightConfidence(head.compDays, M.noteComparisonDays);
  if (confidence === "high") confidence = "medium";
  if (head.periodDays < 3) confidence = "low";
  return {
    id, angle, link, status: "ok", confidence,
    strength: Math.min(1, Math.abs(head.diffPct || 0) / 40), reach: head.isPromo ? 0.6 : 0.3,
    facts: Object.assign({}, head, { others }),
    sample: { compDays: head.compDays },
    chart: { kind: "pair", values: [head.compAvg, head.periodAvg], labels: ["compare", "period"] },
  };
}

// ---------- 2. Price change check ----------

const ADVICE_EXACT_PRICES = new Set(["exact", "matched"]);

// Runs of days with the same usual (most common) price, oldest first.
function advicePriceRuns(byDate) {
  const dates = Array.from(byDate.keys()).sort();
  const runs = [];
  dates.forEach((d) => {
    const prices = byDate.get(d);
    const counts = new Map();
    prices.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
    let price = null, best = 0;
    counts.forEach((c, p) => { if (c > best || (c === best && p < price)) { price = p; best = c; } });
    const last = runs[runs.length - 1];
    if (last && last.price === price) { last.end = d; last.dates.push(d); } else runs.push({ price, start: d, end: d, dates: [d] });
  });
  // A one- or two-day blip (a mistyped price, a special) isn't a price change.
  const kept = [];
  runs.forEach((r) => {
    if (r.dates.length < 3) return;
    const last = kept[kept.length - 1];
    if (last && last.price === r.price) { last.end = r.end; last.dates.push(...r.dates); } else kept.push(r);
  });
  return kept;
}

function advicePriceChange(ctx) {
  const id = "priceChange", angle = "pricing", link = "#/items";
  const M = adviceMin();
  const byKey = new Map();
  ctx.items.forEach((it) => {
    if (!ADVICE_EXACT_PRICES.has(it.priceSource) || it.kind !== "product" || it.qty <= 0) return;
    const key = `${it.name}\u0000${it.variation || ""}`;
    if (!byKey.has(key)) byKey.set(key, { name: it.name, variation: it.variation || null, byDate: new Map(), units: new Map() });
    const g = byKey.get(key);
    const unit = Math.round(it.unitPrice * 100) / 100;
    if (!g.byDate.has(it.date)) g.byDate.set(it.date, []);
    g.byDate.get(it.date).push(unit);
    g.units.set(it.date, (g.units.get(it.date) || 0) + it.qty);
  });

  const storeDays = Array.from(new Set(ctx.sales.map((r) => r.date))).sort();
  const storeReceipts = new Map();
  ctx.receipts.forEach((rc) => storeReceipts.set(rc.date, (storeReceipts.get(rc.date) || 0) + 1));
  const unitsAll = new Map();
  ctx.items.forEach((it) => { if (it.kind === "product" && it.qty > 0) unitsAll.set(it.date, (unitsAll.get(it.date) || 0) + it.qty); });

  const changes = [];
  byKey.forEach((g) => {
    const runs = advicePriceRuns(g.byDate);
    for (let i = runs.length - 1; i >= 1; i--) {
      const a = runs[i - 1], b = runs[i];
      const pct = ((b.price - a.price) / a.price) * 100;
      if (Math.abs(pct) < M.priceChangePct) continue;
      if (adviceDaysBetween(a.start, a.end) + 1 < M.priceStableDays || adviceDaysBetween(b.start, b.end) + 1 < M.priceStableDays) continue;
      const beforeFrom = [a.start, shiftDate(b.start, -M.priceWindowDays)].sort()[1];
      const beforeTo = shiftDate(b.start, -1);
      const afterFrom = b.start;
      const afterTo = [b.end, shiftDate(b.start, M.priceWindowDays - 1)].sort()[0];
      const inWin = (d, from, to) => d >= from && d <= to;
      const sumUnits = (from, to) => Array.from(g.units.entries()).filter(([d]) => inWin(d, from, to)).reduce((s, [, u]) => s + u, 0);
      const days = (from, to) => storeDays.filter((d) => inWin(d, from, to));
      const bDays = days(beforeFrom, beforeTo), aDays = days(afterFrom, afterTo);
      const bUnits = sumUnits(beforeFrom, beforeTo), aUnits = sumUnits(afterFrom, afterTo);
      if (bUnits < M.priceUnitsEachSide || aUnits < M.priceUnitsEachSide || !bDays.length || !aDays.length) continue;
      const perDay = (u, list) => u / list.length;
      const ordersPerDay = (list) => list.reduce((s, d) => s + (storeReceipts.get(d) || 0), 0) / list.length;
      const allUnits = (list) => list.reduce((s, d) => s + (unitsAll.get(d) || 0), 0);
      changes.push({
        name: g.name, variation: g.variation,
        // changeDate = the first day it SOLD at the new price (the real change may be a day or two earlier).
        oldPrice: a.price, newPrice: b.price, changePct: Math.round(pct), changeDate: b.start,
        beforeFrom, beforeTo, afterFrom, afterTo, beforeDays: bDays.length, afterDays: aDays.length,
        beforeUnitsPerDay: insightRound2(perDay(bUnits, bDays)), afterUnitsPerDay: insightRound2(perDay(aUnits, aDays)),
        unitsChangePct: adviceChangePct(perDay(bUnits, bDays), perDay(aUnits, aDays)),
        storeOrdersChangePct: adviceChangePct(ordersPerDay(bDays), ordersPerDay(aDays)),
        shareBeforePct: Math.round(insightPct(bUnits, allUnits(bDays))), shareAfterPct: Math.round(insightPct(aUnits, allUnits(aDays))),
        unitsBefore: bUnits, unitsAfter: aUnits,
      });
      break; // only the latest change of each item
    }
  });
  if (!changes.length) return insightNotEnough(id, angle, link, { what: "noPriceChange", need: M.priceChangePct });
  changes.sort((x, y) => (x.changeDate < y.changeDate ? 1 : x.changeDate > y.changeDate ? -1 : x.name.localeCompare(y.name)));
  const head = changes[0];
  const minDays = Math.min(head.beforeDays, head.afterDays);
  return {
    id, angle, link, status: "ok",
    // A before/after on one item is never better than medium.
    confidence: minDays >= M.priceStableDays * 2 ? "medium" : "low",
    strength: Math.min(1, Math.abs(head.unitsChangePct || 0) / 40 + 0.2), reach: 0.4,
    facts: Object.assign({}, head, { otherChanges: changes.length - 1 }),
    sample: { days: head.beforeDays + head.afterDays },
    chart: { kind: "pair", values: [head.beforeUnitsPerDay, head.afterUnitsPerDay], labels: ["before", "after"] },
  };
}

// ---------- 3. Concentration ----------

function adviceConcentration(ctx, it) {
  const id = "concentration", angle = "mix", link = "#/items";
  const M = adviceMin();
  if (it.list.length < M.concentrationItems) return insightNotEnough(id, angle, link, { what: "distinctItems", need: M.concentrationItems, have: it.list.length });
  if (ctx.weeks < M.concentrationWeeks) return insightNotEnough(id, angle, link, { what: "weeks", need: M.concentrationWeeks, have: Math.floor(ctx.weeks) });
  const n = it.list.length;
  const topCount = Math.max(1, Math.ceil(n * 0.2));
  const topRevenue = it.list.slice(0, topCount).reduce((s, x) => s + x.revenue, 0);
  const topSharePct = Math.round(insightPct(topRevenue, it.revenue));
  const weeks = Math.max(1, Math.floor(ctx.weeks));
  const barely = it.list.filter((x) => x.units / weeks < M.barelySellsPerWeek).sort((a, b) => a.units - b.units || a.name.localeCompare(b.name));
  if (topSharePct < 50 && !barely.length) return insightNotEnough(id, angle, link, { what: "salesSpread" });
  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(weeks, M.concentrationWeeks),
    strength: Math.min(1, topSharePct / 100 + barely.length / n / 2), reach: 0.6,
    facts: {
      distinctItems: n, topCount, topSharePct, restCount: n - topCount, restSharePct: 100 - topSharePct,
      barelyCount: barely.length, barelyNames: barely.slice(0, 3).map((x) => x.name), weeks,
    },
    sample: { weeks },
    chart: { kind: "split", values: [topSharePct, 100 - topSharePct], labels: ["top", "rest"] },
  };
}

// ---------- 4. Returning customers ----------

function adviceReturning(ctx) {
  const id = "returning", angle = "customers", link = "#/customers";
  const M = adviceMin();
  const total = ctx.receipts.size;
  const coded = new Map(); // receipt key -> { hash, total, date }
  ctx.sales.forEach((r) => {
    if (!r.customerHash) return;
    const key = ctx.receiptKey(r);
    const rc = ctx.receipts.get(key);
    if (rc && !coded.has(key)) coded.set(key, { hash: r.customerHash, total: rc.total, date: r.date });
  });
  if (!coded.size) return insightNotEnough(id, angle, link, { what: "noCustomerCodes" });
  const coveragePct = Math.round(insightPct(coded.size, total));
  if (coveragePct < M.customerCoveragePct) return insightNotEnough(id, angle, link, { what: "customerCoverage", need: M.customerCoveragePct, have: coveragePct });
  const dates = new Map();
  coded.forEach((c) => {
    if (!dates.has(c.hash)) dates.set(c.hash, new Set());
    dates.get(c.hash).add(c.date);
  });
  if (dates.size < M.customers) return insightNotEnough(id, angle, link, { what: "customers", need: M.customers, have: dates.size });
  const repeat = new Set(Array.from(dates.entries()).filter(([, s]) => s.size >= 2).map(([h]) => h));
  let codedSales = 0, repeatSales = 0;
  coded.forEach((c) => { codedSales += c.total; if (repeat.has(c.hash)) repeatSales += c.total; });
  const repeatSalesPct = Math.round(insightPct(repeatSales, codedSales));
  return {
    id, angle, link, status: "ok",
    confidence: coveragePct < 40 ? "low" : insightConfidence(dates.size, M.customers),
    strength: Math.min(1, repeatSalesPct / 100), reach: coveragePct / 100,
    facts: {
      coveragePct, customers: dates.size, repeatCustomers: repeat.size,
      repeatCustPct: Math.round(insightPct(repeat.size, dates.size)), repeatSalesPct,
    },
    sample: { customers: dates.size },
    chart: { kind: "split", values: [repeatSalesPct, 100 - repeatSalesPct], labels: ["repeat", "once"] },
  };
}

// ---------- 5. Channel view (with optional fees) ----------

// Square's order data has no "dine-in" flag: an order without a pickup,
// delivery or shipment is just an order with no type. Those are labeled
// "in person or not marked" -- never "dine-in" -- by the wording.
const ADVICE_CHANNEL_NONE = "__none";

function adviceChannelKey(raw) {
  const s = String(raw || "").trim();
  return s || ADVICE_CHANNEL_NONE;
}

function adviceChannels(ctx, env) {
  const id = "channelMix", angle = "channels", link = "#/order-types";
  const M = adviceMin();
  if (!ctx.sales.some((r) => r.orderType)) return insightNotEnough(id, angle, link, { what: "noChannels" });
  const groups = new Map();
  ctx.receipts.forEach((rc) => {
    const key = adviceChannelKey(rc.orderType);
    const g = groups.get(key) || { key, receipts: 0, sales: 0 };
    g.receipts++;
    g.sales += rc.total;
    groups.set(key, g);
  });
  const list = Array.from(groups.values()).filter((g) => g.receipts >= M.channelReceipts).sort((a, b) => b.sales - a.sales);
  if (list.length < 2) return insightNotEnough(id, angle, link, { what: "groups", need: 2, have: list.length });
  const total = list.reduce((s, g) => s + g.sales, 0);
  const fees = (env.inputs && env.inputs.fees) || {};
  const channels = list.map((g) => {
    const fee = Number(fees[g.key]);
    const feePct = Number.isFinite(fee) && fee >= 0 && fee < 100 ? fee : null;
    return {
      key: g.key, receipts: g.receipts, sales: insightRound2(g.sales), sharePct: Math.round(insightPct(g.sales, total)),
      avgOrder: insightRound2(g.sales / g.receipts), feePct,
      takeHome: feePct === null ? null : insightRound2(g.sales * (1 - feePct / 100)),
    };
  });
  const withFee = channels.filter((c) => c.feePct !== null);
  const feesEntered = withFee.length > 0;
  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(Math.min(...list.map((g) => g.receipts)), M.channelReceipts),
    // A channel split is background; it ranks higher once fees show what's kept.
    strength: feesEntered ? 0.4 : 0.25, reach: 0.4,
    facts: {
      channels, feesEntered, total: insightRound2(total),
      feeSales: feesEntered ? insightRound2(withFee.reduce((s, c) => s + c.sales, 0)) : null,
      feeTakeHome: feesEntered ? insightRound2(withFee.reduce((s, c) => s + c.takeHome, 0)) : null,
    },
    sample: { receipts: list.reduce((s, g) => s + g.receipts, 0) },
    chart: { kind: "bars", values: channels.map((c) => c.sales), labels: channels.map((c) => c.key) },
  };
}

// ---------- 6. Optional break-even ----------

function adviceBreakEven(ctx, env) {
  const id = "breakEven", angle = "money", link = "#/trend";
  const inp = env.inputs || {};
  const fixed = Number(inp.fixedMonthly), cost = Number(inp.costPct);
  if (!(fixed > 0) || !(cost >= 0 && cost < 100)) return null; // only when the owner chose to enter both
  if (!ctx.range) return null;
  const from = shiftDate(ctx.range.max, -89);
  const days = adviceDaysBetween(from < ctx.range.min ? ctx.range.min : from, ctx.range.max) + 1;
  if (days < 28) return insightNotEnough(id, angle, link, { what: "days", need: 28, have: days });
  const sales = ctx.sales.filter((r) => r.date >= from).reduce((s, r) => s + rowRevenue(r), 0);
  const avgMonthly = (sales / days) * 30.4;
  const breakEvenMonthly = fixed / (1 - cost / 100);
  return {
    id, angle, link, status: "ok", confidence: "low", // built from the owner's own estimates
    strength: 0.5, reach: 1,
    facts: {
      fixedMonthly: insightRound2(fixed), costPct: insightRound2(cost),
      breakEvenMonthly: insightRound2(breakEvenMonthly), avgMonthly: insightRound2(avgMonthly),
      gapPct: adviceChangePct(breakEvenMonthly, avgMonthly), days,
    },
    sample: { days },
    chart: { kind: "pair", values: [insightRound2(breakEvenMonthly), insightRound2(avgMonthly)], labels: ["needed", "actual"] },
  };
}

// ---------- 7. Weather ahead (outside data: Open-Meteo, if turned on) ----------

function adviceWeatherAhead(ctx, env) {
  const id = "weatherAhead", angle = "ahead", link = "#/dashboard";
  const M = adviceMin();
  if (!env.weather || !env.weather.size || !env.today || typeof precipCategory !== "function") return null;
  const isWet = (w) => ["rain", "snow"].includes(precipCategory(w.precipSum, w.snowSum));
  let next = null;
  for (let i = 1; i <= 7 && !next; i++) {
    const d = shiftDate(env.today, i);
    const w = env.weather.get(d);
    if (w && isWet(w)) next = { date: d, kind: precipCategory(w.precipSum, w.snowSum) };
  }
  if (!next) return null; // no rain or snow coming: nothing to say
  const dow = rowDayOfWeek({ date: next.date });
  const daily = adviceDailyTotals(ctx);
  const isHoliday = env.isHoliday || (() => false);
  const wet = [], dry = [];
  daily.forEach((total, d) => {
    if (d >= env.today || rowDayOfWeek({ date: d }) !== dow || isHoliday(d)) return;
    const w = env.weather.get(d);
    if (!w || w.isForecast) return;
    const cat = precipCategory(w.precipSum, w.snowSum);
    if (cat === "rain" || cat === "snow") wet.push(total);
    else if (cat === "dry") dry.push(total);
  });
  if (wet.length < M.weatherDaysEach || dry.length < M.weatherDaysEach) {
    return insightNotEnough(id, angle, link, { what: "weatherDays", need: M.weatherDaysEach, have: Math.min(wet.length, dry.length) });
  }
  const wetAvg = adviceAvg(wet), dryAvg = adviceAvg(dry);
  const diffPct = adviceChangePct(dryAvg, wetAvg);
  if (diffPct === null || Math.abs(diffPct) < M.weatherGapPct) return null; // weather hasn't mattered much on that day
  return {
    id, angle, link, status: "ok",
    confidence: insightConfidence(Math.min(wet.length, dry.length), M.weatherDaysEach),
    strength: Math.min(1, Math.abs(diffPct) / 40), reach: 0.5,
    facts: { date: next.date, dow, kind: next.kind, wetAvg: insightRound2(wetAvg), dryAvg: insightRound2(dryAvg), wetDays: wet.length, dryDays: dry.length, diffPct },
    sample: { wetDays: wet.length },
    chart: { kind: "pair", values: [insightRound2(dryAvg), insightRound2(wetAvg)], labels: ["dry", "wet"] },
    outside: ["openMeteo"],
  };
}

// ---------- 8. Local dates ahead (hand-typed Brandeis calendar) ----------

function adviceEventAhead(ctx, env) {
  const id = "eventAhead", angle = "ahead", link = "#/notes";
  const M = adviceMin();
  const periods = env.localDates || [];
  if (!periods.length || !env.today || !ctx.range) return null;
  const coming = periods
    .filter((p) => p.start > env.today && adviceDaysBetween(env.today, p.start) <= M.eventLookaheadDays)
    .sort((a, b) => (a.start < b.start ? -1 : 1))[0];
  if (!coming) return null;
  const daily = adviceDailyTotals(ctx);
  const isHoliday = env.isHoliday || (() => false);
  const inAny = (d) => periods.some((p) => d >= p.start && d <= p.end);
  const past = periods.filter((p) => p.kind === coming.kind && p.end < env.today && p.end >= ctx.range.min && p.start <= ctx.range.max);
  const inDays = [], baseDays = [];
  let used = 0;
  past.forEach((p) => {
    const inside = [];
    for (let d = p.start; d <= p.end; d = shiftDate(d, 1)) if (daily.has(d)) inside.push(daily.get(d));
    // The 4 weeks before the period: ordinary days only.
    const base = [];
    for (let d = shiftDate(p.start, -28); d < p.start; d = shiftDate(d, 1)) if (daily.has(d) && !inAny(d) && !isHoliday(d)) base.push(daily.get(d));
    if (!inside.length || base.length < 7) return;
    used++;
    inDays.push(...inside);
    baseDays.push(...base);
  });
  if (used < M.eventPastPeriods || inDays.length < M.eventSellingDays) {
    return insightNotEnough(id, angle, link, { what: "eventHistory", need: M.eventSellingDays, have: inDays.length });
  }
  const inAvg = adviceAvg(inDays), baseAvg = adviceAvg(baseDays);
  const diffPct = adviceChangePct(baseAvg, inAvg);
  if (diffPct === null || Math.abs(diffPct) < M.eventGapPct) return null;
  return {
    id, angle, link, status: "ok",
    confidence: used >= 2 ? insightConfidence(inDays.length, M.eventSellingDays) : "low",
    strength: Math.min(1, Math.abs(diffPct) / 40), reach: 0.5,
    facts: { kind: coming.kind, start: coming.start, end: coming.end, pastPeriods: used, pastDays: inDays.length, inAvg: insightRound2(inAvg), baseAvg: insightRound2(baseAvg), diffPct },
    sample: { pastDays: inDays.length },
    chart: { kind: "pair", values: [insightRound2(baseAvg), insightRound2(inAvg)], labels: ["usual", "period"] },
    outside: ["localDates"],
  };
}

// ---------- 9. Your prices vs restaurant prices (outside data: BLS CPI) ----------

// env.outside.bls = { national: { month: "2026-09", pct12 }, boston?: {...}, retrievedAt }
function adviceMarket(env) {
  const b = env.outside && env.outside.bls;
  if (!b || !b.national || typeof b.national.pct12 !== "number") return null;
  const local = env.nearBoston && b.boston && typeof b.boston.pct12 === "number" ? b.boston : null;
  return {
    marketPct: b.national.pct12, marketMonth: b.national.month,
    localPct: local ? local.pct12 : null, localMonth: local ? local.month : null,
  };
}

function advicePriceVsMarket(ctx, env) {
  const id = "priceVsMarket", angle = "pricing", link = "#/items";
  const M = adviceMin();
  const market = adviceMarket(env);
  if (!market || !ctx.range) return null;
  const month = ctx.range.max.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const baseMonth = `${y - 1}-${String(m).padStart(2, "0")}`;
  if (ctx.range.min.slice(0, 7) > baseMonth) return null; // less than a year of data
  const priceIn = (mon) => {
    const g = new Map();
    ctx.items.forEach((it) => {
      if (!ADVICE_EXACT_PRICES.has(it.priceSource) || it.kind !== "product" || it.qty <= 0 || it.date.slice(0, 7) !== mon) return;
      const key = `${it.name}\u0000${it.variation || ""}`;
      const cur = g.get(key) || { units: 0, sales: 0 };
      cur.units += it.qty;
      cur.sales += it.lineTotal;
      g.set(key, cur);
    });
    return g;
  };
  const now = priceIn(month), then = priceIn(baseMonth);
  let weight = 0, weighted = 0, items = 0;
  then.forEach((t, key) => {
    const n = now.get(key);
    if (!n) return;
    const change = (n.sales / n.units - t.sales / t.units) / (t.sales / t.units);
    weighted += change * t.units;
    weight += t.units;
    items++;
  });
  if (items < M.priceVsMarketItems) return insightNotEnough(id, angle, link, { what: "commonItems", need: M.priceVsMarketItems, have: items });
  const ownPct = Math.round((weighted / weight) * 1000) / 10;
  return {
    id, angle, link, status: "ok", confidence: "medium",
    strength: 0.3, reach: 0.5,
    facts: Object.assign({ ownPct, ownMonth: month, ownBaseMonth: baseMonth, items }, market),
    sample: { items },
    chart: { kind: "pair", values: [ownPct, market.marketPct], labels: ["you", "market"] },
    outside: ["bls"],
  };
}

// ---------- Illustrations (never predictions) ----------

// Returns { low, high, key, vars } or null. Shown as "an illustration, not a
// prediction" with its assumptions spelled out.
function adviceImpact(fact, ctx) {
  const spread = ADVICE_CONFIG.impactSpread;
  const perMonth = (n) => (ctx.spanDays > 0 ? (n / ctx.spanDays) * 30.4 : 0);
  const range = (est) => ({ low: insightRound2(est * (1 - spread)), high: insightRound2(est * (1 + spread)) });
  if (fact.id === "pairs") {
    const addOn = ctx.items.filter((it) => it.name === fact.facts.addOn && it.qty > 0);
    const units = addOn.reduce((s, it) => s + it.qty, 0);
    if (!units) return null;
    const price = addOn.reduce((s, it) => s + it.lineTotal, 0) / units;
    const est = perMonth(fact.facts.withoutReceipts) * ADVICE_CONFIG.impactAddOnRate * price;
    if (est < 1) return null;
    return Object.assign(range(est), { key: "pairs", vars: { rate: Math.round(1 / ADVICE_CONFIG.impactAddOnRate), price: insightRound2(price) } });
  }
  if (fact.id === "slowHours") {
    const sellingPerMonth = ctx.spanDays > 0 ? (ctx.sellingDates.size / ctx.spanDays) * 30.4 : 0;
    const est = fact.facts.avgPerDay * (ADVICE_CONFIG.impactQuietLiftPct / 100) * sellingPerMonth;
    if (est < 1) return null;
    return Object.assign(range(est), { key: "slowHours", vars: { pct: ADVICE_CONFIG.impactQuietLiftPct } });
  }
  return null;
}

// ---------- All of the above ----------

// Returns { insights: [...ok facts], notEnough: [...], ctx }. Rules that
// returned null (nothing to say) are simply absent.
function generateExtraAdvice(rows, env) {
  const ctx = insightContext(rows);
  if (!ctx.sales.length) return { insights: [], notEnough: [], ctx };
  const it = insightItemTotals(ctx);
  const outsideOn = env.outsideOn !== false;
  const all = [
    adviceNoteImpact(ctx, env), advicePriceChange(ctx), adviceConcentration(ctx, it),
    adviceReturning(ctx), adviceChannels(ctx, env), adviceBreakEven(ctx, env),
    outsideOn ? adviceWeatherAhead(ctx, env) : null,
    outsideOn ? adviceEventAhead(ctx, env) : null,
    outsideOn ? advicePriceVsMarket(ctx, env) : null,
  ].filter(Boolean).map((x) => (x.status === "ok" && ctx.sellingDates.size < INSIGHT_MIN.sellingDays
    ? insightNotEnough(x.id, x.angle, x.link, { what: "sellingDays", need: INSIGHT_MIN.sellingDays, have: ctx.sellingDates.size })
    : x));
  // The price-change card gets national price context when it's available.
  const market = outsideOn ? adviceMarket(env) : null;
  all.forEach((x) => {
    if (x.id === "priceChange" && x.status === "ok" && market) {
      Object.assign(x.facts, market);
      x.outside = ["bls"];
    }
  });
  return { insights: all.filter((x) => x.status === "ok"), notEnough: all.filter((x) => x.status === "not_enough"), ctx };
}
