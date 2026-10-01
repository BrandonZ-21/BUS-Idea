// Pure calculation helpers. Everything here takes an array of sales rows
// ({ date, time, item, quantity, price, orderType, orderId }) and returns
// plain numbers/objects for charts and insights. No DOM, no network.

const DOW_KEYS = ["daySun", "dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat"];
const DOW_LONG_KEYS = ["daySunLong", "dayMonLong", "dayTueLong", "dayWedLong", "dayThuLong", "dayFriLong", "daySatLong"];

function rowDayOfWeek(row) {
  // "YYYY-MM-DD" parsed as local date, avoiding UTC off-by-one.
  const [y, m, d] = row.date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay(); // 0 = Sunday
}

function rowHour(row) {
  if (!row.time) return null;
  return parseInt(row.time.split(":")[0], 10);
}

function rowRevenue(row) {
  return row.price * row.quantity;
}

function dateRangeOf(rows) {
  if (!rows.length) return null;
  let min = rows[0].date, max = rows[0].date;
  for (const r of rows) {
    if (r.date < min) min = r.date;
    if (r.date > max) max = r.date;
  }
  return { min, max };
}

function weeksCovered(rows) {
  const range = dateRangeOf(rows);
  if (!range) return 0;
  const [y1, m1, d1] = range.min.split("-").map(Number);
  const [y2, m2, d2] = range.max.split("-").map(Number);
  const days = Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000) + 1;
  return days / 7;
}

function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// The first and last date covered by a range-selector mode ("4weeks",
// "8weeks", "year" = the calendar year of the latest sale, "all"), measured
// back from the most recent date in the data and never before the first sale.
function rangeBounds(rows, mode) {
  const range = dateRangeOf(rows);
  if (!range || mode === "all") return range;
  let min = mode === "year" ? `${range.max.slice(0, 4)}-01-01` : shiftDate(range.max, -(mode === "4weeks" ? 4 : 8) * 7 + 1);
  if (min < range.min) min = range.min;
  return { min, max: range.max };
}

function filterByRange(rows, mode) {
  const bounds = rangeBounds(rows, mode);
  if (!bounds || mode === "all") return rows;
  return rows.filter((r) => r.date >= bounds.min);
}

// How many of each weekday (0 = Sunday) fall between two dates, inclusive,
// skipping any date in skipDates (e.g. days tagged "closed").
function weekdayOccurrences(bounds, skipDates) {
  const counts = new Array(7).fill(0);
  if (!bounds) return counts;
  for (let d = bounds.min; d <= bounds.max; d = shiftDate(d, 1)) {
    if (skipDates && skipDates.has(d)) continue;
    counts[rowDayOfWeek({ date: d })]++;
  }
  return counts;
}

// ---------- One-off payments ----------
// Payment links (trip deposits, facility rentals...) and unusually large
// tickets aren't part of normal day-to-day selling, and a handful of them
// can swamp a busiest-hour or best-day chart. A ticket counts as unusually
// large when it's over 10x the median ticket AND over 3x the 99th
// percentile -- the second guard keeps legitimate big-but-regular orders
// (a group buying 6 day passes) from being flagged at a low-priced shop.
const ONE_OFF_MEDIAN_MULTIPLE = 10;
const ONE_OFF_P99_MULTIPLE = 3;
const ONE_OFF_MIN_TICKETS = 30; // too few tickets to say what "unusual" is

// Returns the Set of row objects that belong to one-off payments.
function findOneOffRows(rows) {
  const oneOff = new Set(rows.filter((r) => r.kind === "payment_link"));
  const tickets = new Map();
  rows.forEach((r, i) => {
    if (oneOff.has(r)) return;
    const key = r.orderId || (r.time ? `${r.date}|${r.time}` : `row${i}`);
    const ticket = tickets.get(key) || { total: 0, rows: [] };
    ticket.total += rowRevenue(r);
    ticket.rows.push(r);
    tickets.set(key, ticket);
  });
  const totals = Array.from(tickets.values()).map((tk) => tk.total).filter((v) => v > 0).sort((a, b) => a - b);
  if (totals.length >= ONE_OFF_MIN_TICKETS) {
    const pct = (p) => totals[Math.min(totals.length - 1, Math.floor(p * totals.length))];
    const threshold = Math.max(ONE_OFF_MEDIAN_MULTIPLE * pct(0.5), ONE_OFF_P99_MULTIPLE * pct(0.99));
    tickets.forEach((tk) => { if (tk.total > threshold) tk.rows.forEach((r) => oneOff.add(r)); });
  }
  return oneOff;
}

function computeSummary(rows) {
  const totalSales = rows.reduce((s, r) => s + rowRevenue(r), 0);
  const orderKeys = new Set();
  rows.forEach((r) => {
    orderKeys.add(r.orderId || `${r.date}|${r.time}|${r.orderType || ""}|${Math.random()}`);
  });
  // Without a real order id, approximate "orders" as distinct (date+time) groups when time exists,
  // otherwise fall back to row count (each row treated as one order line).
  let orderCount;
  if (rows.some((r) => r.orderId)) {
    orderCount = new Set(rows.filter((r) => r.orderId).map((r) => r.orderId)).size
      + rows.filter((r) => !r.orderId).length;
  } else if (rows.some((r) => r.time)) {
    orderCount = new Set(rows.map((r) => `${r.date}|${r.time}`)).size;
  } else {
    orderCount = rows.length;
  }
  const avgOrder = orderCount ? totalSales / orderCount : 0;
  return { totalSales, orderCount, avgOrder };
}

function salesByHour(rows) {
  const buckets = new Array(24).fill(0);
  rows.forEach((r) => {
    const h = rowHour(r);
    if (h !== null) buckets[h] += rowRevenue(r);
  });
  return buckets;
}

// occurrences (optional, from weekdayOccurrences): average over every
// calendar Monday/Tuesday/... in the range, including ones with no sales.
// Without it, the average is over days that had at least one sale.
function salesByDow(rows, occurrences) {
  const totals = new Array(7).fill(0);
  const counts = new Array(7).fill(0); // number of days averaged over for that dow
  const seenDates = new Array(7).fill(null).map(() => new Set());
  rows.forEach((r) => {
    const dow = rowDayOfWeek(r);
    totals[dow] += rowRevenue(r);
    seenDates[dow].add(r.date);
  });
  for (let i = 0; i < 7; i++) counts[i] = (occurrences ? occurrences[i] : seenDates[i].size) || 1;
  const averages = totals.map((t, i) => t / counts[i]);
  return { totals, averages, dayCounts: counts };
}

// Groups rows into rolling 7-day windows counted backward from the most
// recent date in the data, so the most recent bucket is always a full week
// instead of a partial calendar week that would make week-over-week
// comparisons misleading (e.g. "1 day" vs "7 days").
function salesByWeek(rows) {
  const range = dateRangeOf(rows);
  if (!range) return [];
  const [my, mm, md] = range.max.split("-").map(Number);
  const maxDate = new Date(my, mm - 1, md);
  const totals = new Map();
  rows.forEach((r) => {
    const [y, m, d] = r.date.split("-").map(Number);
    const daysAgo = Math.round((maxDate - new Date(y, m - 1, d)) / 86400000);
    const bucket = Math.floor(daysAgo / 7);
    totals.set(bucket, (totals.get(bucket) || 0) + rowRevenue(r));
  });
  const buckets = Array.from(totals.keys()).sort((a, b) => b - a); // oldest bucket index first
  return buckets.map((bucket) => {
    const end = new Date(maxDate);
    end.setDate(end.getDate() - bucket * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    return [label, totals.get(bucket)];
  });
}

// Per item name. Square receipts are split into their items first (see
// js/square-items.js); other files already have one row per item.
function topItems(rows, n) {
  const map = new Map();
  itemRowsFor(rows).forEach((it) => {
    const cur = map.get(it.name) || { item: it.name, quantity: 0, revenue: 0 };
    cur.quantity += it.qty;
    cur.revenue += it.lineTotal;
    map.set(it.name, cur);
  });
  const all = Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
  return { top: all.slice(0, n), all, rare: all.filter((x) => x.quantity <= 3) };
}

function orderTypeSplit(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const key = r.orderType || null;
    if (!key) return;
    map.set(key, (map.get(key) || 0) + rowRevenue(r));
  });
  return Array.from(map.entries()).map(([type, revenue]) => ({ type, revenue }));
}

function heatmapData(rows) {
  // grid[dow][hour] = revenue
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  rows.forEach((r) => {
    const h = rowHour(r);
    if (h === null) return;
    const dow = rowDayOfWeek(r);
    grid[dow][h] += rowRevenue(r);
  });
  return grid;
}

function findGaps(rows, minGapDays) {
  if (!rows.length) return [];
  const dates = Array.from(new Set(rows.map((r) => r.date))).sort();
  const gaps = [];
  for (let i = 1; i < dates.length; i++) {
    const [y1, m1, d1] = dates[i - 1].split("-").map(Number);
    const [y2, m2, d2] = dates[i].split("-").map(Number);
    const diffDays = Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
    if (diffDays > minGapDays) {
      const startGap = new Date(y1, m1 - 1, d1);
      startGap.setDate(startGap.getDate() + 1);
      const endGap = new Date(y2, m2 - 1, d2);
      endGap.setDate(endGap.getDate() - 1);
      gaps.push({
        start: `${startGap.getFullYear()}-${String(startGap.getMonth() + 1).padStart(2, "0")}-${String(startGap.getDate()).padStart(2, "0")}`,
        end: `${endGap.getFullYear()}-${String(endGap.getMonth() + 1).padStart(2, "0")}-${String(endGap.getDate()).padStart(2, "0")}`,
      });
    }
  }
  return gaps;
}
