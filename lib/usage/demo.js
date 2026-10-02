// MADE-UP usage events for the dashboard's Demo mode. Generated in memory on
// each request and never written to the database, so demo numbers can never
// mix into real traction. Deterministic: the same `nowSec` always gives the
// same events (tests rely on that).

const DAY = 86400;

// [browser, daysAgo, hour, event, reason, source]
const SCRIPT = [
  // d1: own CSV, report, came back 6 days later with new data
  ["d1", 20, 9, "visit"], ["d1", 20, 9, "upload_started", null, "own"], ["d1", 20, 9, "upload_ok", null, "own"],
  ["d1", 20, 9, "data_added", null, "own"], ["d1", 20, 9, "report_viewed", null, "own"], ["d1", 20, 10, "report_saved"],
  ["d1", 14, 8, "visit"], ["d1", 14, 8, "upload_started", null, "own"], ["d1", 14, 8, "upload_ok", null, "own"],
  ["d1", 14, 8, "data_added", null, "own"], ["d1", 14, 8, "report_viewed", null, "own"],
  // d2: wrong file twice, then gave up
  ["d2", 18, 14, "visit"], ["d2", 18, 14, "upload_started", null, "own"], ["d2", 18, 14, "upload_failed", "bad_date", "own"],
  ["d2", 18, 14, "upload_started", null, "own"], ["d2", 18, 15, "upload_failed", "missing_columns", "own"],
  // d3: looked at the sample only
  ["d3", 15, 11, "visit"], ["d3", 15, 11, "sample_loaded", null, "sample"], ["d3", 15, 11, "report_viewed", null, "sample"],
  // d4: Square connect, cancelled at Square
  ["d4", 12, 16, "visit"], ["d4", 12, 16, "square_connect_started"], ["d4", 12, 16, "square_connect_failed", "denied"],
  // d5: Square connected and synced, report, synced again 3 days later
  ["d5", 10, 7, "visit"], ["d5", 10, 7, "square_connect_started"], ["d5", 10, 7, "square_connected"],
  ["d5", 10, 7, "square_sync_ok"], ["d5", 10, 7, "data_added", null, "square"], ["d5", 10, 7, "report_viewed", null, "own"],
  ["d5", 7, 7, "visit"], ["d5", 7, 7, "square_sync_ok"], ["d5", 7, 7, "data_added", null, "square"], ["d5", 7, 7, "report_viewed", null, "own"],
  // d6: sample, then own file, report
  ["d6", 5, 13, "visit"], ["d6", 5, 13, "sample_loaded", null, "sample"], ["d6", 5, 13, "report_viewed", null, "sample"],
  ["d6", 5, 13, "upload_started", null, "own"], ["d6", 5, 13, "upload_ok", null, "own"],
  ["d6", 5, 13, "data_added", null, "own"], ["d6", 5, 14, "report_viewed", null, "own"],
  // d7, d8: visited and left
  ["d7", 4, 10, "visit"], ["d8", 2, 19, "visit"],
  // d9: unsupported file type
  ["d9", 1, 12, "visit"], ["d9", 1, 12, "upload_started", null, "own"], ["d9", 1, 12, "upload_failed", "unsupported_type", "own"],
];

export function demoData(nowSec) {
  const base = Math.floor(nowSec / DAY) * DAY; // start of today (UTC)
  const events = SCRIPT.map(([b, daysAgo, hour, event, reason = null, source = null], i) => ({
    at: base - daysAgo * DAY + hour * 3600 + i, // +i keeps order stable
    browser_id: `demo-browser-${b}`,
    event,
    reason,
    source,
  }));
  const failures = events.filter((e) => e.event.endsWith("_failed")).sort((a, b) => b.at - a.at).slice(0, 20);
  return {
    events,
    recentFailures: failures.map(({ at, event, reason }) => ({ at, event, reason })),
    firstEventAt: events.reduce((m, e) => Math.min(m, e.at), Infinity),
    accountsWithSavedReports: 1,
  };
}
