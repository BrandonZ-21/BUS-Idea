// Item-level view of Square "Transactions" exports. Square writes one row
// per receipt and packs every item into the Description column, e.g.
//   "2 x Gatorade (Desk) (Cool Blue), Gatorade (Desk) (Fruit Punch)"
// with only the receipt's Gross Sales -- no per-item prices. This splits
// receipts into item rows and works out each item's share of its receipt,
// so item revenue always adds back up to the receipt total, to the cent.
//
// Item row: { receipt, date, time, kind, qty, name, channel, variation,
//             lineTotal, unitPrice, priceSource }
// priceSource:
//   "exact"   - the receipt had one item line, so its price is known
//   "matched"   - priced from a single-item sale of the same item + variation
//                 (same day when there was one, since prices change over time)
//   "remainder" - the one unpriced line on a receipt (often a Custom Amount):
//                 the receipt total minus everything else's price
//   "similar"   - priced from the same item in a different variation (estimate)
//   "split"     - no reference price; shares what's left by quantity (estimate)
// Rows that aren't packed (other registers' one-row-per-item exports) pass
// through as one "exact" item each, so everything here works for any file.

const ESTIMATED_PRICE_SOURCES = new Set(["similar", "split"]);

// A "(...)" group before the variation that names where it was sold, e.g.
// "Gatorade (Desk) (Cool Blue)" -- as opposed to "Chuck-A-Duck (1 duck)".
const CHANNEL_PATTERN = /\b(desk|stand|concession|counter|kiosk|window|bar|patio|truck|front|online)\b/i;

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true });
}

// Splits on commas that aren't inside parentheses.
function splitDescription(desc) {
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of String(desc || "")) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

// "2 x Gatorade (Desk) (Cool Blue)" -> { qty: 2, name: "Gatorade", channel: "Desk", variation: "Cool Blue" }
function parseSegment(seg) {
  let s = String(seg).trim();
  let qty = 1;
  const q = s.match(/^(\d+)\s*x\s+(.*)$/i);
  if (q) { qty = parseInt(q[1], 10) || 1; s = q[2]; }

  const groups = []; // top-level "(...)" groups with their positions
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") { if (depth++ === 0) start = i; }
    else if (s[i] === ")" && depth > 0 && --depth === 0) groups.push({ text: s.slice(start + 1, i).trim(), start, end: i + 1 });
  }
  const variationGroup = groups.length ? groups[groups.length - 1] : null;
  const channelGroup = groups.slice(0, -1).find((g) => CHANNEL_PATTERN.test(g.text)) || null;
  let name = s;
  [variationGroup, channelGroup].filter(Boolean).sort((a, b) => b.start - a.start)
    .forEach((g) => { name = name.slice(0, g.start) + name.slice(g.end); });
  name = name.replace(/\s+/g, " ").replace(/\s+-\s*$/, "").trim() || s;
  return { qty, name, channel: channelGroup ? channelGroup.text : null, variation: variationGroup ? variationGroup.text : null };
}

function segmentsOf(row) {
  // Rows synced from Square carry their variation (e.g. "Large") separately.
  if (!row.packed) return [{ qty: row.quantity || 1, name: row.item, channel: null, variation: row.variation || null }];
  // A payment link's description is a free-text title, not a list of items.
  if (row.kind === "payment_link") return [{ qty: 1, name: row.item, channel: null, variation: null }];
  return splitDescription(row.item).map(parseSegment);
}

function dayNumber(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function mostCommon(values) {
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let best = null, bestCount = 0;
  counts.forEach((c, v) => { if (c > bestCount) { best = v; bestCount = c; } });
  return best;
}

// index: key -> Map(date -> [unit prices]). Prefers that exact day, else
// the nearest day. Returns { price, sameDay } or null.
function referencePrice(index, key, date) {
  const byDate = index.get(key);
  if (!byDate) return null;
  if (byDate.has(date)) return { price: mostCommon(byDate.get(date)), sameDay: true };
  const target = dayNumber(date);
  let best = null, bestGap = Infinity;
  byDate.forEach((prices, d) => {
    const gap = Math.abs(dayNumber(d) - target);
    if (gap < bestGap) { bestGap = gap; best = prices; }
  });
  return { price: mostCommon(best), sameDay: false };
}

function addReference(index, key, date, unit) {
  if (!index.has(key)) index.set(key, new Map());
  const byDate = index.get(key);
  if (!byDate.has(date)) byDate.set(date, []);
  byDate.get(date).push(unit);
}

// Splits totalCents across weights (largest remainder), so the parts add up exactly.
function allocateCents(totalCents, weights) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? totalCents : 0));
  const raw = weights.map((w) => (totalCents * w) / sum);
  const parts = raw.map(Math.floor);
  let left = totalCents - parts.reduce((s, p) => s + p, 0);
  raw.map((r, i) => [r - parts[i], i]).sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => { if (left > 0) { parts[i]++; left--; } });
  return parts;
}

// A Custom Amount is typed in by hand each time, so it has no reference price.
const CUSTOM_AMOUNT = /^custom amount$/i;

// Prices one line of a multi-item receipt. tier = how sure we are:
// 0 same-day match, 1 nearest-day match, 2 another variation, 3 no price.
function priceLine(seg, date, exactPrices, namePrices, fullKey, nameKey) {
  if (!CUSTOM_AMOUNT.test(seg.name)) {
    const exact = referencePrice(exactPrices, fullKey(seg), date);
    if (exact) return { seg, unit: exact.price, tier: exact.sameDay ? 0 : 1, source: "matched" };
    const similar = referencePrice(namePrices, nameKey(seg), date);
    if (similar) return { seg, unit: similar.price, tier: 2, source: "similar" };
  }
  return { seg, unit: null, tier: 3, source: "split" };
}

// Turns priced lines into cents that add up to totalCents exactly. When the
// reference prices don't add up to the receipt (a price change, a custom
// amount, a manual discount), the least certain lines absorb the difference
// and the rest keep their reference price; if that can't work, everything
// is scaled proportionally.
function allocateLines(priced, totalCents) {
  const worst = Math.max(...priced.map((p) => p.tier));
  const fixedCents = (p) => Math.round(p.unit * 100) * p.seg.qty;
  const fixed = priced.filter((p) => p.tier < worst);
  const flex = priced.filter((p) => p.tier === worst);
  const rest = totalCents - fixed.reduce((s, p) => s + fixedCents(p), 0);
  if (fixed.length && rest > 0) {
    const flexCents = allocateCents(rest, flex.map((p) => (p.unit === null ? 1 : p.unit) * p.seg.qty));
    // A single unpriced line next to priced ones is pinned down by subtraction.
    if (flex.length === 1 && worst === 3) flex[0].source = "remainder";
    return priced.map((p) => (p.tier < worst ? fixedCents(p) : flexCents[flex.indexOf(p)]));
  }
  const known = priced.filter((p) => p.unit !== null);
  const avgUnit = known.length ? known.reduce((s, p) => s + p.unit, 0) / known.length : 1;
  return allocateCents(totalCents, priced.map((p) => (p.unit === null ? avgUnit : p.unit) * p.seg.qty));
}

function explodeTransactions(rows) {
  const receipts = rows.map((row) => ({ row, segs: segmentsOf(row), cents: Math.round(row.price * (row.quantity || 1) * 100) }));
  const fullKey = (s) => `${s.name}|${s.channel || ""}|${s.variation || ""}`;
  const nameKey = (s) => `${s.name}|${s.channel || ""}`;

  // 1. Reference unit prices from receipts that sold a single item line.
  const exactPrices = new Map(), namePrices = new Map();
  receipts.forEach(({ row, segs, cents }) => {
    if (!row.packed || segs.length !== 1 || row.kind === "payment_link" || cents <= 0) return;
    if (CUSTOM_AMOUNT.test(segs[0].name)) return;
    const unit = Math.round(cents / segs[0].qty) / 100;
    addReference(exactPrices, fullKey(segs[0]), row.date, unit);
    addReference(namePrices, nameKey(segs[0]), row.date, unit);
  });

  // 2. Price every line, then fit each receipt's lines to its exact total.
  const items = [];
  receipts.forEach(({ row, segs, cents }) => {
    const sign = cents < 0 ? -1 : 1;
    const priced = segs.length === 1
      ? [{ seg: segs[0], unit: null, tier: 0, source: "exact" }]
      : segs.map((seg) => priceLine(seg, row.date, exactPrices, namePrices, fullKey, nameKey));
    const lineCents = allocateLines(priced, Math.abs(cents));

    priced.forEach((p, i) => {
      const qty = row.packed ? p.seg.qty * sign : p.seg.qty;
      const lineTotal = (lineCents[i] * sign) / 100;
      items.push({
        receipt: row, date: row.date, time: row.time, kind: row.kind || "product",
        qty, name: p.seg.name, channel: p.seg.channel, variation: p.seg.variation,
        lineTotal, unitPrice: qty ? lineTotal / qty : 0, priceSource: p.source,
      });
    });
  });
  return items;
}

// Groups item rows by keyFn (default: item name). Sorted by revenue, highest first.
function summarize(items, keyFn) {
  keyFn = keyFn || ((it) => it.name);
  const map = new Map();
  items.forEach((it) => {
    const key = keyFn(it);
    const g = map.get(key) || { key, units: 0, revenue: 0, estimatedUnits: 0 };
    g.units += it.qty;
    g.revenue += it.lineTotal;
    if (ESTIMATED_PRICE_SOURCES.has(it.priceSource)) g.estimatedUnits += Math.abs(it.qty);
    map.set(key, g);
  });
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

// Explodes the whole dataset once (so price matching sees every day), then
// hands out each receipt's items on request. Call indexItems after every reload.
let itemCache = new WeakMap();
function indexItems(allRows) {
  itemCache = new WeakMap();
  explodeTransactions(allRows).forEach((it) => {
    if (!itemCache.has(it.receipt)) itemCache.set(it.receipt, []);
    itemCache.get(it.receipt).push(it);
  });
}

function itemRowsFor(rows) {
  const missing = rows.filter((r) => !itemCache.has(r));
  if (missing.length) {
    explodeTransactions(missing).forEach((it) => {
      if (!itemCache.has(it.receipt)) itemCache.set(it.receipt, []);
      itemCache.get(it.receipt).push(it);
    });
  }
  return rows.flatMap((r) => itemCache.get(r) || []);
}
