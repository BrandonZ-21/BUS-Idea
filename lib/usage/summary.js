// Turns raw usage events into the founder-dashboard numbers: the five original
// signals plus visitors, sources, own-data-vs-sample, pages, clicks, time on
// page and recent visit journeys. Pure: no
// database, no clock -- the same function runs on live rows and on the
// made-up demo rows, so both are counted by exactly the same rules.
//
// Counting unit is BROWSERS (random browser ids), not people: one person on
// two devices counts twice, and deleting data on a device starts a new id.
// Rates are null when the denominator is 0 (shown as "--", never 0%).

const DAY = 86400;
const SESSION_GAP = 30 * 60; // a new visit starts after 30 minutes with no steps
const MAX_SESSIONS = 30;
const MAX_STEPS = 60;
const ENGAGED = ["30s", "2m", "5m", "10m"];

const rate = (num, den) => (den ? num / den : null);
const dayOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);

// "www.reddit.com" -> "reddit.com"; Android app referrers -> a readable name.
const APP_SOURCES = {
  "com.reddit.frontpage": "reddit.com (app)",
  "com.google.android.gm": "gmail (app)",
  "com.instagram.android": "instagram.com (app)",
  "com.facebook.katana": "facebook.com (app)",
  "com.linkedin.android": "linkedin.com (app)",
  "com.google.android.googlequicksearchbox": "google.com (app)",
};
export function friendlySource(refTag, refHost) {
  if (refTag) return `link tag: ${refTag}`;
  if (!refHost) return "direct / unknown";
  if (APP_SOURCES[refHost]) return APP_SOURCES[refHost];
  let h = refHost.replace(/^(www|m|old|new|out|l|lm|mobile)\./, "");
  if (h === "t.co") h = "x.com";
  if (/(^|\.)google\.[a-z.]+$/.test(h)) h = "google";
  if (h === "mail.google.com") h = "gmail";
  return h;
}

function countBy(map, key, browser) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(browser);
}
const sortedCounts = (map, keyName) =>
  [...map].map(([k, set]) => ({ [keyName]: k, browsers: set.size })).sort((a, b) => b.browsers - a.browsers || String(a[keyName]).localeCompare(String(b[keyName])));

// The richer views: who visits, where from, what they did, how long they stayed.
function summarizeDetail(events, firstSeen, { since, nowSec, days }) {
  const byBrowser = new Map();
  for (const e of events) {
    if (!byBrowser.has(e.browser_id)) byBrowser.set(e.browser_id, []);
    byBrowser.get(e.browser_id).push(e);
  }
  for (const list of byBrowser.values()) list.sort((a, b) => a.at - b.at);

  // Visitor numbers: stable "Visitor 1, 2, 3…" in order of first sighting.
  const order = [...byBrowser.keys()].sort((a, b) => (firstSeen?.[a] ?? byBrowser.get(a)[0].at) - (firstSeen?.[b] ?? byBrowser.get(b)[0].at) || a.localeCompare(b));
  const visitorNo = new Map(order.map((b, i) => [b, i + 1]));

  // Visitors, new vs. returning, and per day.
  const visitDays = new Map();
  for (const e of events) if (e.event === "visit") countBy(visitDays, e.browser_id, dayOf(e.at));
  const visitors = visitDays.size;
  const returning = [...visitDays.values()].filter((d) => d.size >= 2).length;
  const newInWindow = firstSeen ? [...visitDays.keys()].filter((b) => (firstSeen[b] ?? 0) >= since).length : null;
  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayOf(nowSec - i * DAY);
    let n = 0;
    for (const d of visitDays.values()) if (d.has(day)) n++;
    daily.push({ day, browsers: n });
  }

  // Per-browser facts: first-touch source, country, device, what data they used, how long they stayed.
  const sourceMap = new Map();
  const countryMap = new Map();
  const deviceMap = new Map();
  const sourceRows = new Map(); // source -> { browsers, triedOwn, ownIn, sampleOnly }
  const choice = { square: 0, ownFile: 0, triedFailed: 0, sampleOnly: 0, lookedOnly: 0 };
  const engagedCounts = { under30s: 0, "30s": 0, "2m": 0, "5m": 0, "10m": 0 };
  for (const [b, list] of byBrowser) {
    const firstVisit = list.find((e) => e.event === "visit");
    if (!firstVisit) continue; // only browsers that opened Tally in this window
    const src = friendlySource(firstVisit.ref_tag, firstVisit.ref_host);
    countBy(sourceMap, src, b);
    countBy(countryMap, firstVisit.country || "unknown", b);
    countBy(deviceMap, firstVisit.device || "unknown", b);

    const has = (test) => list.some(test);
    const square = has((e) => e.event === "square_connected");
    const ownFile = has((e) => e.event === "upload_ok" && e.source === "own");
    const tried = has((e) => (e.event === "upload_started" && e.source !== "sample") || e.event === "square_connect_started" || e.event.endsWith("_failed"));
    const sample = has((e) => e.event === "sample_loaded");
    const kind = square ? "square" : ownFile ? "ownFile" : tried ? "triedFailed" : sample ? "sampleOnly" : "lookedOnly";
    choice[kind]++;
    if (!sourceRows.has(src)) sourceRows.set(src, { source: src, browsers: 0, triedOwn: 0, ownIn: 0, sampleOnly: 0 });
    const row = sourceRows.get(src);
    row.browsers++;
    if (square || ownFile || tried) row.triedOwn++;
    if (square || ownFile) row.ownIn++;
    if (kind === "sampleOnly") row.sampleOnly++;

    let best = -1;
    for (const e of list) if (e.event === "engaged") best = Math.max(best, ENGAGED.indexOf(e.reason));
    engagedCounts[best < 0 ? "under30s" : ENGAGED[best]]++;
  }

  // Pages and clicks.
  const pages = new Map();
  const clicks = new Map();
  for (const e of events) {
    const page = e.event === "page_view" ? e.detail : null;
    if (page) {
      if (!pages.has(page)) pages.set(page, { page, views: 0, browsers: new Set() });
      pages.get(page).views++;
      pages.get(page).browsers.add(e.browser_id);
    }
    if (e.event === "click" && e.detail) {
      if (!clicks.has(e.detail)) clicks.set(e.detail, { target: e.detail, count: 0, browsers: new Set() });
      clicks.get(e.detail).count++;
      clicks.get(e.detail).browsers.add(e.browser_id);
    }
  }
  const flat = (m) => [...m.values()].map((x) => ({ ...x, browsers: x.browsers.size }));

  // Visits (sessions): a browser's steps split where 30+ minutes pass with nothing.
  const sessions = [];
  for (const [b, list] of byBrowser) {
    let cur = null;
    for (const e of list) {
      if (!cur || e.at - cur.end > SESSION_GAP) {
        cur = { visitor: visitorNo.get(b), browserId: b, start: e.at, end: e.at, source: null, country: null, device: null, engaged: null, steps: [], moreSteps: 0 };
        sessions.push(cur);
      }
      cur.end = e.at;
      if (e.event === "visit" && cur.source === null) {
        cur.source = friendlySource(e.ref_tag, e.ref_host);
        cur.country = e.country || null;
        cur.device = e.device || null;
      }
      if (e.event === "engaged" && ENGAGED.indexOf(e.reason) > ENGAGED.indexOf(cur.engaged)) cur.engaged = e.reason;
      if (cur.steps.length < MAX_STEPS) cur.steps.push({ at: e.at, event: e.event, reason: e.reason || null, source: e.source || null, detail: e.detail || null });
      else cur.moreSteps++;
    }
  }
  sessions.sort((a, b) => b.start - a.start);

  return {
    visitors: { browsers: visitors, newInWindow, returning, sessions: sessions.length },
    daily,
    sources: [...sourceRows.values()].sort((a, b) => b.browsers - a.browsers || a.source.localeCompare(b.source)),
    countries: sortedCounts(countryMap, "country"),
    devices: sortedCounts(deviceMap, "device"),
    dataChoice: choice,
    engagement: engagedCounts,
    pages: flat(pages).sort((a, b) => b.views - a.views || a.page.localeCompare(b.page)),
    clicks: flat(clicks).sort((a, b) => b.count - a.count || a.target.localeCompare(b.target)).slice(0, 30),
    sessions: sessions.slice(0, MAX_SESSIONS),
  };
}

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

  const extra = summarizeDetail(events, data.firstSeen || null, { since, nowSec, days });

  // Advice cards: how often each type was shown, and the "useful?" answers.
  const recMap = new Map();
  const rec = (id) => {
    if (!recMap.has(id)) recMap.set(id, { id, shown: 0, shownBrowsers: new Set(), yes: 0, no: 0 });
    return recMap.get(id);
  };
  for (const e of events) {
    if (e.event === "rec_shown" && e.detail) { const r = rec(e.detail); r.shown++; r.shownBrowsers.add(e.browser_id); }
    if (e.event === "rec_useful" && e.detail) { const r = rec(e.detail); if (e.reason === "yes") r.yes++; else if (e.reason === "no") r.no++; }
  }
  const recommendations = [...recMap.values()]
    .map((r) => ({ id: r.id, shown: r.shown, browsers: r.shownBrowsers.size, yes: r.yes, no: r.no }))
    .sort((a, b) => b.shown - a.shown || a.id.localeCompare(b.id));

  return {
    ...extra,
    mode,
    collecting,
    window: { days, start: since, end: nowSec },
    firstEventAt: data.firstEventAt,
    eventsInWindow: events.length,
    excludedBrowsers: data.excludedBrowsers || 0, // the admin's own devices, left out of every number
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
    recommendations,
  };
}
