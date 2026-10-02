// Turns raw usage events into the five founder-dashboard signals. Pure: no
// database, no clock -- the same function runs on live rows and on the
// made-up demo rows, so both are counted by exactly the same rules.
//
// Counting unit is BROWSERS (random browser ids), not people: one person on
// two devices counts twice, and deleting data on a device starts a new id.
// Rates are null when the denominator is 0 (shown as "--", never 0%).

const DAY = 86400;

const rate = (num, den) => (den ? num / den : null);

function browsersWith(events, test) {
  const set = new Set();
  for (const e of events) if (test(e)) set.add(e.browser_id);
  return set;
}

export function summarize(data, { days, nowSec, mode, collecting }) {
  const since = nowSec - days * DAY;
  const events = data.events.filter((e) => e.at >= since && e.at <= nowSec);

  const visitors = browsersWith(events, (e) => e.event === "visit");
  // Own data actually in: an own file read OK, or Square connected. A sample
  // file never counts as the owner's own data.
  const ownDataIn = browsersWith(events, (e) => (e.event === "upload_ok" && e.source === "own") || e.event === "square_connected");
  // Anyone whose own data got in, or whose Square connect came back at all,
  // started -- even if the "started" event itself was missed (e.g. they
  // reached Square's page without pressing Tally's button).
  const connectStarted = browsersWith(events, (e) => ["square_connect_started", "square_connected", "square_connect_failed"].includes(e.event));
  const started = new Set([...browsersWith(events, (e) => e.event === "upload_started"), ...connectStarted, ...ownDataIn]);
  const reportOnOwn = browsersWith(events, (e) => e.event === "report_viewed" && e.source === "own");
  const sampleLoaded = browsersWith(events, (e) => e.event === "sample_loaded");
  const sampleOnly = [...sampleLoaded].filter((b) => !started.has(b)).length;

  // Came back: own data added on two or more different (UTC) days.
  const addDays = new Map();
  for (const e of events) {
    if (e.event !== "data_added" || (e.source !== "own" && e.source !== "square")) continue;
    if (!addDays.has(e.browser_id)) addDays.set(e.browser_id, new Set());
    addDays.get(e.browser_id).add(new Date(e.at * 1000).toISOString().slice(0, 10));
  }
  const cameBack = [...addDays.values()].filter((d) => d.size >= 2).length;

  const connected = browsersWith(events, (e) => e.event === "square_connected");

  const failureMap = new Map();
  for (const e of events) {
    if (!e.event.endsWith("_failed")) continue;
    const key = `${e.event}|${e.reason || ""}`;
    if (!failureMap.has(key)) failureMap.set(key, { event: e.event, reason: e.reason || null, count: 0, browsers: new Set() });
    const f = failureMap.get(key);
    f.count++;
    f.browsers.add(e.browser_id);
  }
  const failures = [...failureMap.values()]
    .map((f) => ({ event: f.event, reason: f.reason, count: f.count, browsers: f.browsers.size }))
    .sort((a, b) => b.count - a.count || a.event.localeCompare(b.event));

  return {
    mode,
    collecting,
    window: { days, start: since, end: nowSec },
    firstEventAt: data.firstEventAt,
    eventsInWindow: events.length,
    firstReport: { visitors: visitors.size, reachedOwn: reportOnOwn.size, rate: rate(reportOnOwn.size, visitors.size) },
    funnel: [
      { step: "visited", browsers: visitors.size },
      { step: "tried_own_data", browsers: started.size },
      { step: "own_data_in", browsers: ownDataIn.size },
      { step: "report_on_own_data", browsers: reportOnOwn.size },
    ],
    failures,
    cameBack: { withOwnData: addDays.size, cameBack, rate: rate(cameBack, addDays.size) },
    trust: {
      sampleOnly,
      sampleLoaded: sampleLoaded.size,
      connectStarted: connectStarted.size,
      connected: connected.size,
      connectRate: rate(connected.size, connectStarted.size),
      accountsWithSavedReports: data.accountsWithSavedReports,
    },
    recentFailures: data.recentFailures.map((f) => ({ at: f.at, event: f.event, reason: f.reason || null })),
  };
}
