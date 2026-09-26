// Returning-customer analytics. Everything here operates ONLY on
// already-hashed customer IDs (row.customerHash) -- there is no raw phone
// number, email, or name anywhere in this file, and nothing here makes a
// network request. This is aggregate counting only: no individual customer
// is ever identified, listed, or contactable from this data.

// At least this many distinct hashed customers before we trust any
// percentage enough to show it, rather than a misleading result from a
// handful of rows.
const CUSTOMER_MIN_COUNT = 5;

function daysBetweenDates(d1, d2) {
  const [y1, m1, day1] = d1.split("-").map(Number);
  const [y2, m2, day2] = d2.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, day2) - new Date(y1, m1 - 1, day1)) / 86400000);
}

// rows -> Map<hash, sorted unique visit dates ("YYYY-MM-DD")>
function computeCustomerVisits(rows) {
  const byHash = new Map();
  rows.forEach((r) => {
    if (!r.customerHash) return;
    if (!byHash.has(r.customerHash)) byHash.set(r.customerHash, new Set());
    byHash.get(r.customerHash).add(r.date);
  });
  const result = new Map();
  byHash.forEach((dateSet, hash) => result.set(hash, Array.from(dateSet).sort()));
  return result;
}

// For each period (bucketFn maps a date to a period label), counts distinct
// customers whose FIRST-EVER visit falls in that period ("new") versus
// customers who visited in that period but had already visited earlier
// ("returning"). Each customer counts at most once per period.
function newVsReturningByPeriod(visitsByHash, bucketFn) {
  const buckets = new Map();
  visitsByHash.forEach((dates) => {
    const firstPeriod = bucketFn(dates[0]);
    const periodsVisited = new Set(dates.map(bucketFn));
    periodsVisited.forEach((label) => {
      if (!buckets.has(label)) buckets.set(label, { newCount: 0, returningCount: 0 });
      const b = buckets.get(label);
      if (label === firstPeriod) b.newCount++;
      else b.returningCount++;
    });
  });
  return buckets;
}

// % of customers who, given a full `windowDays` chance to return (their
// first visit was at least that many days before the most recent date in
// the data), had at least one more visit within that many days of their
// first visit.
function computeRepeatRate(visitsByHash, maxDate, windowDays) {
  let eligible = 0, returned = 0;
  visitsByHash.forEach((dates) => {
    const first = dates[0];
    if (daysBetweenDates(first, maxDate) < windowDays) return; // hasn't had the full window yet
    eligible++;
    const hasReturn = dates.slice(1).some((d) => daysBetweenDates(first, d) <= windowDays);
    if (hasReturn) returned++;
  });
  const pct = eligible > 0 ? Math.round((returned / eligible) * 100) : null;
  return { eligible, returned, pct };
}

// Average visits per repeat customer (2+ distinct visit dates), and the
// average number of days between consecutive visits across all such
// customers.
function computeVisitStats(visitsByHash) {
  let repeatCustomers = 0, totalVisits = 0, totalGapDays = 0, gapCount = 0;
  visitsByHash.forEach((dates) => {
    if (dates.length < 2) return;
    repeatCustomers++;
    totalVisits += dates.length;
    for (let i = 1; i < dates.length; i++) {
      totalGapDays += daysBetweenDates(dates[i - 1], dates[i]);
      gapCount++;
    }
  });
  return {
    repeatCustomers,
    avgVisitsPerRepeat: repeatCustomers > 0 ? totalVisits / repeatCustomers : null,
    avgGapDays: gapCount > 0 ? totalGapDays / gapCount : null,
  };
}

// Count only -- never a list -- of customers whose most recent visit was
// at least `thresholdDays` before the most recent date in the whole
// dataset, framed as "may be worth a win-back promo."
function computeWinBackCount(visitsByHash, maxDate, thresholdDays) {
  let count = 0;
  visitsByHash.forEach((dates) => {
    const last = dates[dates.length - 1];
    if (daysBetweenDates(last, maxDate) >= thresholdDays) count++;
  });
  return count;
}
