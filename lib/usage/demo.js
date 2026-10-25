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

// Where each made-up browser came from, on its visits: [refTag, refHost, country, device]
const VISIT_META = {
  d1: [null, "google.com", "US", "desktop"],
  d2: ["email", null, "US", "desktop"],
  d3: [null, "com.reddit.frontpage", "CA", "mobile"],
  d4: ["dm", "instagram.com", "US", "mobile"],
  d5: ["email", null, "US", "tablet"],
  d6: ["reddit", "www.reddit.com", "GB", "desktop"],
  d7: [null, "www.reddit.com", "US", "mobile"],
  d8: [null, null, "US", "mobile"],
  d9: [null, null, "IN", "desktop"],
};

// Pages, clicks and time-on-page steps: [browser, daysAgo, hour, minute, event, reason, detail]
const EXTRA = [
  ["d1", 20, 9, 1, "page_view", null, "home"], ["d1", 20, 9, 3, "page_view", null, "dashboard"], ["d1", 20, 9, 4, "engaged", "30s"],
  ["d1", 20, 9, 6, "click", null, "nav:items"], ["d1", 20, 9, 6, "page_view", null, "items"], ["d1", 20, 9, 8, "engaged", "2m"], ["d1", 20, 9, 12, "engaged", "5m"],
  ["d2", 18, 14, 1, "page_view", null, "home"], ["d2", 18, 14, 2, "click", null, "heroGetStartedBtn"], ["d2", 18, 14, 4, "engaged", "30s"], ["d2", 18, 14, 6, "engaged", "2m"],
  ["d3", 15, 11, 1, "page_view", null, "home"], ["d3", 15, 11, 2, "click", null, "heroSampleBtn"], ["d3", 15, 11, 3, "page_view", null, "dashboard"], ["d3", 15, 11, 4, "engaged", "30s"],
  ["d4", 12, 16, 1, "page_view", null, "home"], ["d4", 12, 16, 2, "click", null, "page:api.square.connect"],
  ["d5", 10, 7, 2, "page_view", null, "dashboard"], ["d5", 10, 7, 3, "click", null, "nav:heatmap"], ["d5", 10, 7, 3, "page_view", null, "heatmap"],
  ["d5", 10, 7, 4, "engaged", "30s"], ["d5", 10, 7, 6, "engaged", "2m"], ["d5", 10, 7, 9, "engaged", "5m"], ["d5", 10, 7, 14, "engaged", "10m"],
  ["d6", 5, 13, 1, "page_view", null, "home"], ["d6", 5, 13, 1, "click", null, "heroSampleBtn"], ["d6", 5, 13, 2, "page_view", null, "dashboard"],
  ["d6", 5, 13, 3, "click", null, "langToggleBtn"], ["d6", 5, 13, 4, "engaged", "30s"], ["d6", 5, 13, 7, "engaged", "2m"],
  ["d7", 4, 10, 1, "page_view", null, "home"],
  ["d8", 2, 19, 1, "page_view", null, "home"], ["d8", 2, 19, 2, "click", null, "footerPrivacyLink"],
  ["d9", 1, 12, 1, "page_view", null, "home"], ["d9", 1, 12, 2, "click", null, "heroGetStartedBtn"], ["d9", 1, 12, 3, "engaged", "30s"],
];

export function demoData(nowSec) {
  const base = Math.floor(nowSec / DAY) * DAY; // start of today (UTC)
  const scripted = SCRIPT.map(([b, daysAgo, hour, event, reason = null, source = null], i) => {
    const [refTag, refHost, country, device] = event === "visit" ? VISIT_META[b] : [null, null, null, null];
    return {
      at: base - daysAgo * DAY + hour * 3600 + i, // +i keeps order stable
      browser_id: `demo-browser-${b}`,
      event,
      reason,
      source,
      detail: event === "visit" ? "home" : null,
      ref_host: refHost,
      ref_tag: refTag,
      country,
      device,
    };
  });
  const extra = EXTRA.map(([b, daysAgo, hour, minute, event, reason, detail]) => ({
    at: base - daysAgo * DAY + hour * 3600 + minute * 60 + 30,
    browser_id: `demo-browser-${b}`,
    event,
    reason,
    source: null,
    detail,
    ref_host: null,
    ref_tag: null,
    country: null,
    device: null,
  }));
  const events = [...scripted, ...extra].sort((a, b) => a.at - b.at);
  const failures = events.filter((e) => e.event.endsWith("_failed")).sort((a, b) => b.at - a.at).slice(0, 20);
  return {
    events,
    recentFailures: failures.map(({ at, event, reason }) => ({ at, event, reason })),
    firstEventAt: events.reduce((m, e) => Math.min(m, e.at), Infinity),
    accountsWithSavedReports: 1,
    // d1 and d5 pretend they were also seen before the window, so "new" isn't everyone.
    firstSeen: Object.fromEntries([...new Set(events.map((e) => e.browser_id))].map((b) => [
      b, ["demo-browser-d1", "demo-browser-d5"].includes(b) ? base - 60 * DAY : events.find((e) => e.browser_id === b).at,
    ])),
  };
}
