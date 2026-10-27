// Outside data: which sources, how often, and when a value is too old to show.
// Used by the scheduled Worker (workers/outside-data/) and the Pages
// Functions (functions/api/outside.js, functions/api/admin/health.js).
// The browser has the same staleness numbers in public/js/advice-config.js.

export const DAY_SEC = 86400;

export const SOURCES = {
  bls_cpi: {
    name: "U.S. Bureau of Labor Statistics, Consumer Price Index (CPI-U): food away from home",
    link: "https://www.bls.gov/cpi/",
    // From the BLS API Terms of Service (checked 2026-10-27): cite BLS, note the
    // retrieval date, and say BLS can't vouch for derived analyses.
    license: "Source: U.S. Bureau of Labor Statistics. BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.",
    // Series IDs checked against api.bls.gov on 2026-10-27:
    //   CUUR0000SEFV  CPI-U, Food away from home, U.S. city average, not seasonally adjusted, monthly
    //   CUURS11ASEFV  same, Boston-Cambridge-Newton MA-NH, published every other month (odd months)
    series: { national: "CUUR0000SEFV", boston: "CUURS11ASEFV" },
    refreshEverySec: DAY_SEC, // monthly data: once a day is plenty (1 of 25 allowed queries/day without a key)
    // Hide from owners when the latest month is older than this (days after that month ended).
    staleDays: { national: 75, boston: 110 },
  },
};

// Backoff after failures in a row: 6 h, 12 h, then once a day.
export function backoffSec(failCount) {
  return [6, 12, 24][Math.min(Math.max(failCount, 1), 3) - 1] * 3600;
}

export const MAX_RUNS_KEPT = 200;
export const FETCH_TIMEOUT_MS = 10000;

// Free-plan limits used by the Founder page's "Free-tier health" panel.
// Checked 2026-10-27 against developers.cloudflare.com (see FREE_TIER_NOTES.md).
export const FREE_LIMITS = {
  requestsPerDay: 100000, // Workers + Pages Functions, shared; static files don't count
  d1RowsReadPerDay: 5000000,
  d1RowsWrittenPerDay: 100000,
  d1DatabaseBytes: 500 * 1024 * 1024, // per database on the free plan
  cronTriggersPerAccount: 5,
  cronTriggersUsedByTally: 1,
  warnAtShare: 0.7,
};
