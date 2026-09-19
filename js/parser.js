// Turns a raw CSV (parsed by Papa Parse into an array of objects) into clean
// sales rows: { date: "YYYY-MM-DD", time: "HH:MM"|null, item, quantity, price,
// orderType|null, orderId|null }.

const FIELD_KEYWORDS = {
  date: ["date", "orderdate", "saledate", "transactiondate", "businessdate", "day"],
  datetime: ["datetime", "timestamp", "orderdatetime", "dateandtime", "date/time", "createdat"],
  time: ["time", "ordertime", "saletime", "checkintime"],
  item: ["item", "product", "menuitem", "itemname", "description", "productname", "name"],
  quantity: ["qty", "quantity", "count", "units", "itemqty"],
  price: ["price", "amount", "total", "saleprice", "unitprice", "linetotal", "revenue", "netsales", "grosssales", "subtotal"],
  orderType: ["ordertype", "type", "servicetype", "channel", "diningoption", "fulfillment"],
  orderId: ["orderid", "order#", "ordernumber", "receiptid", "transactionid", "checknumber", "orderno", "receiptno"],
};

function normalizeHeader(h) {
  return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Returns { guesses: {field: originalHeaderOrNull}, hasDatetimeColumn: bool }
function guessColumns(headers) {
  const normalized = headers.map(normalizeHeader);
  const guesses = { date: null, time: null, item: null, quantity: null, price: null, orderType: null, orderId: null };
  let datetimeCol = null;

  headers.forEach((h, i) => {
    const n = normalized[i];
    if (!datetimeCol && FIELD_KEYWORDS.datetime.some((k) => n === k || n.includes(k))) {
      datetimeCol = h;
    }
  });

  function findFirst(field) {
    for (let i = 0; i < headers.length; i++) {
      const n = normalized[i];
      if (FIELD_KEYWORDS[field].some((k) => n === k)) return headers[i];
    }
    for (let i = 0; i < headers.length; i++) {
      const n = normalized[i];
      if (FIELD_KEYWORDS[field].some((k) => n.includes(k))) return headers[i];
    }
    return null;
  }

  if (datetimeCol) {
    guesses.date = datetimeCol;
    guesses.time = null; // combined column, time comes from the same field
  } else {
    guesses.date = findFirst("date");
    guesses.time = findFirst("time");
  }
  guesses.item = findFirst("item");
  guesses.quantity = findFirst("quantity");
  guesses.price = findFirst("price");
  guesses.orderType = findFirst("orderType");
  guesses.orderId = findFirst("orderId");

  return { guesses, hasDatetimeColumn: !!datetimeCol };
}

function formatSignature(headers) {
  return headers.map(normalizeHeader).sort().join("|");
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Parses a date-only or combined date+time string. Returns { date: "YYYY-MM-DD"|null, time: "HH:MM"|null }
function parseDateString(raw) {
  if (!raw) return { date: null, time: null };
  const s = String(raw).trim();
  if (!s) return { date: null, time: null };

  let datePart = s;
  let timePart = null;

  // Split combined "2026-08-03T14:30" or "08/03/2026 2:30 PM" style values.
  const tMatch = s.match(/^(.*?)[T\s]+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp][Mm])?)\s*$/);
  if (tMatch) {
    datePart = tMatch[1].trim();
    timePart = tMatch[2].trim();
  }

  let y, mo, d;

  let m = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // YYYY-MM-DD
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }

  if (!y) {
    m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // MM/DD/YYYY or M/D/YY
    if (m) {
      mo = +m[1]; d = +m[2]; y = +m[3];
      if (y < 100) y += 2000;
    }
  }

  if (!y) {
    m = datePart.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/); // "August 3, 2026" / "Aug 3 2026"
    if (m) {
      const monKey = m[1].slice(0, 3).toLowerCase();
      if (MONTHS[monKey]) { mo = MONTHS[monKey]; d = +m[2]; y = +m[3]; }
    }
  }

  if (!y || !mo || !d || mo > 12 || d > 31) return { date: null, time: null };

  const dateStr = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  let timeStr = null;
  if (timePart) timeStr = parseTimeString(timePart);

  return { date: dateStr, time: timeStr };
}

function parseTimeString(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  const ampm = m[3] ? m[3].toLowerCase() : null;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parsePrice(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return raw;
  const cleaned = String(raw).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseQuantity(raw) {
  if (raw === null || raw === undefined || raw === "") return 1;
  const n = parseInt(String(raw).replace(/[^0-9.-]/g, ""), 10);
  return isNaN(n) || n <= 0 ? 1 : n;
}

// mapping: { date, time, item, quantity, price, orderType, orderId } -> original header names or null
function buildRows(dataRows, mapping) {
  const rows = [];
  let badCount = 0;
  for (const raw of dataRows) {
    const dateRawVal = mapping.date ? raw[mapping.date] : null;
    const timeRawVal = mapping.time ? raw[mapping.time] : null;
    const { date, time: timeFromDate } = parseDateString(dateRawVal);
    const time = timeFromDate || parseTimeString(timeRawVal);
    const item = mapping.item ? String(raw[mapping.item] || "").trim() : "";
    const price = mapping.price ? parsePrice(raw[mapping.price]) : null;
    const quantity = mapping.quantity ? parseQuantity(raw[mapping.quantity]) : 1;
    const orderType = mapping.orderType ? String(raw[mapping.orderType] || "").trim() : null;
    const orderId = mapping.orderId ? String(raw[mapping.orderId] || "").trim() : null;

    if (!date || price === null || !item) {
      badCount++;
      continue;
    }
    rows.push({ date, time: time || null, item, quantity, price, orderType: orderType || null, orderId: orderId || null });
  }
  return { rows, badCount };
}

function fingerprintRow(row) {
  return [row.date, row.time || "", row.item, row.quantity, row.price.toFixed(2), row.orderId || ""].join("|");
}
