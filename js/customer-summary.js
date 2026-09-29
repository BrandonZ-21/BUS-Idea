// Some registers can only export an already-aggregated "new vs returning
// customers by month" report, not a per-transaction file with a customer ID
// column. That's a genuinely different shape of data -- a monthly summary
// has no date/item/price per row, so it can never be turned into sales rows
// no matter how flexible the main parser gets. This file lets that kind of
// report be imported directly, on its own terms, straight into the
// Customers page's "New vs Returning" chart -- no hashing needed, because a
// report like this never contains a raw identifier in the first place, only
// counts.
//
// Everything here is pure calculation (no DOM, no network), same pattern as
// js/parser.js and js/customers.js.

const SUMMARY_FIELD_KEYWORDS = {
  // Deliberately doesn't include a bare "date" -- that would false-match an
  // ordinary per-order file's Date column, which is exactly the kind of
  // file this importer should NOT silently accept.
  month: ["month", "period", "yearmonth", "monthyear"],
  newCustomers: ["newcustomer", "newcustomers", "new"],
  returningCustomers: ["returningcustomer", "returningcustomers", "returning", "repeatcustomer", "repeatcustomers"],
  totalOrders: ["totalorders", "orders", "totalsales", "ordercount"],
};

// Reuses normalizeHeader from js/parser.js (same "lowercase, strip
// non-alphanumeric" rule), which must be loaded first.
function guessCustomerSummaryColumns(headers) {
  const normalized = headers.map(normalizeHeader);
  const guesses = { month: null, newCustomers: null, returningCustomers: null, totalOrders: null };
  function findFirst(field) {
    for (let i = 0; i < headers.length; i++) {
      if (SUMMARY_FIELD_KEYWORDS[field].some((k) => normalized[i] === k)) return headers[i];
    }
    for (let i = 0; i < headers.length; i++) {
      if (SUMMARY_FIELD_KEYWORDS[field].some((k) => normalized[i].includes(k))) return headers[i];
    }
    return null;
  }
  Object.keys(guesses).forEach((field) => { guesses[field] = findFirst(field); });
  return guesses;
}

const SUMMARY_MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Parses a month-granularity value into "YYYY-MM". Accepts "2021-01",
// "2021-1", "01/2021", "1/2021", "January 2021", "Jan 2021", or a full date
// ("2021-01-15") by just taking its year/month. Returns null if it can't
// confidently tell what month this is.
function parseMonthString(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/); // "2021-01" or "2021-01-15"
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})\/(\d{4})$/); // "01/2021"
  if (m) return `${m[2]}-${String(+m[1]).padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // "01/15/2021" -- a full date, take y/m
  if (m) return `${m[3]}-${String(+m[1]).padStart(2, "0")}`;

  m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/); // "January 2021" / "Jan 2021"
  if (m) {
    const key = m[1].slice(0, 3).toLowerCase();
    if (SUMMARY_MONTHS[key]) return `${m[2]}-${String(SUMMARY_MONTHS[key]).padStart(2, "0")}`;
  }

  return null;
}

function parseCount(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = parseInt(String(raw).replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

// mapping: { month, newCustomers, returningCustomers, totalOrders } -> original header names or null
function buildCustomerSummaryRows(dataRows, mapping) {
  const byMonth = new Map(); // last row for a given month wins, same as a DB "put"
  let badCount = 0;
  for (const raw of dataRows) {
    const month = mapping.month ? parseMonthString(raw[mapping.month]) : null;
    const newCount = mapping.newCustomers ? parseCount(raw[mapping.newCustomers]) : null;
    const returningCount = mapping.returningCustomers ? parseCount(raw[mapping.returningCustomers]) : null;
    const totalOrders = mapping.totalOrders ? parseCount(raw[mapping.totalOrders]) : null;
    if (!month || (newCount === null && returningCount === null)) {
      badCount++;
      continue;
    }
    byMonth.set(month, { month, newCount: newCount || 0, returningCount: returningCount || 0, totalOrders });
  }
  return { rows: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)), badCount };
}
