// Anonymous usage steps for the founder dashboard ("opened Tally", "viewed
// the Items page", "clicked heroSampleBtn", "file not recognized: bad date",
// "still here after 2 minutes"...). Sends ONLY fixed event names, fixed
// codes, names the CODE gives to pages and buttons, and a random browser id
// -- never sales data, item names, amounts, file contents or anything typed.
//
// On the first step of a page load ("visit") it also sends where the visitor
// came from (the linking site's host name only, plus a ?ref= / utm_source tag
// if the link had one) and a rough device type. The server adds a two-letter
// country from Cloudflare; the IP address itself is never stored.
//
// - The browser id is random (crypto), kept in this device's settings, and
//   replaced when "Delete all my data" is used. It is not a fingerprint.
// - Nothing is sent when the browser asks not to be tracked (Global Privacy
//   Control or Do Not Track), when this device has been marked "don't count"
//   (the admin's own devices, or anyone who opens ?notrack=1), or when the site
//   isn't collecting (the server answers { collecting: false }).
// - Failures to send are ignored: counting must never break the app.

const Usage = {
  off: false,
  idPromise: null,
  once: new Set(),
  lastPage: null,
  visitContext: null, // { refHost, refTag, device }, read once at page load
};

function usageOptedOut() {
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1";
}

// "1" once this device is marked "don't count": by the admin's Founder page
// (js/founder.js), automatically when the admin is signed in, or by opening
// any Tally link with ?notrack=1. "0" if the admin chose to be counted here
// after all. Kept in localStorage so it survives "Delete all my data". The
// server also refuses ids it has been told to exclude.
const USAGE_EXCLUDED_KEY = "tally.usageExcluded";

function usageExcludedHere() {
  try {
    return localStorage.getItem(USAGE_EXCLUDED_KEY) === "1";
  } catch {
    return false;
  }
}

function usageDevice() {
  const w = Math.min(window.innerWidth || 0, (screen && screen.width) || Infinity);
  if (w && w < 768) return "mobile";
  if (w && w < 1100) return "tablet";
  return "desktop";
}

// Reads ?ref= / utm_source and ?notrack= once, then removes them from the
// address bar so a reload or a copied link doesn't repeat them.
(function readLandingParams() {
  let url;
  try {
    url = new URL(location.href);
  } catch {
    return;
  }
  const params = url.searchParams;
  const notrack = params.get("notrack");
  if (notrack === "1" || notrack === "0") {
    try {
      localStorage.setItem(USAGE_EXCLUDED_KEY, notrack);
    } catch {
      // storage blocked: nothing to remember
    }
  }
  const tag = String(params.get("ref") || params.get("utm_source") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  let refHost = null;
  try {
    if (document.referrer) {
      const r = new URL(document.referrer);
      const host = r.hostname.toLowerCase();
      if (host && host !== location.hostname && /^[a-z0-9][a-z0-9.-]{0,99}$/.test(host)) refHost = host;
    }
  } catch {
    // unreadable referrer: treat as direct
  }
  Usage.visitContext = { refHost, refTag: tag || null, device: usageDevice() };

  const strip = ["ref", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "notrack"];
  if (strip.some((k) => params.has(k))) {
    strip.forEach((k) => params.delete(k));
    const qs = params.toString();
    try {
      history.replaceState(history.state, "", url.pathname + (qs ? `?${qs}` : "") + url.hash);
    } catch {
      // leave the address bar as it is
    }
  }
})();

function usageBrowserId() {
  if (!Usage.idPromise) {
    Usage.idPromise = DB.getSetting("usageBrowserId").then(async (id) => {
      if (id) return id;
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const fresh = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      await DB.setSetting("usageBrowserId", fresh);
      return fresh;
    });
  }
  return Usage.idPromise;
}

// Usage.track("upload_failed", { reason: "bad_date", source: "own" })
Usage.track = async function (event, opts = {}) {
  if (Usage.off || usageOptedOut() || usageExcludedHere() || location.protocol === "file:") return;
  try {
    const browserId = await usageBrowserId();
    const body = { browserId, event, reason: opts.reason || null, source: opts.source || null };
    if (opts.detail) body.detail = opts.detail;
    if (opts.refHost) body.refHost = opts.refHost;
    if (opts.refTag) body.refTag = opts.refTag;
    if (opts.device) body.device = opts.device;
    const res = await fetch("/api/events", {
      method: "POST",
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if ((res.headers.get("Content-Type") || "").includes("application/json")) {
      const data = await res.json();
      if (data.collecting === false) Usage.off = true;
    } else {
      Usage.off = true; // no backend here (e.g. scripts/serve.ps1)
    }
  } catch {
    // offline, blocked, no backend -- ignore
  }
};

// Only the first time per page load (e.g. "report_viewed" on every redraw).
Usage.trackOnce = function (event, opts = {}) {
  const key = `${event}|${opts.source || ""}`;
  if (Usage.once.has(key)) return;
  Usage.once.add(key);
  Usage.track(event, opts);
};

// "#/items" -> "items"; "" -> "dashboard". Only the app's own page names.
function usagePageName(route) {
  const name = String(route || "").replace(/^#\/?/, "") || "dashboard";
  return /^[a-z-]{1,20}$/.test(name) ? name : null;
}

// The first step of each page load: where they came from and on which page they landed.
Usage.trackVisit = function () {
  const ctx = Usage.visitContext || { device: usageDevice() };
  Usage.track("visit", { detail: usagePageName(location.hash), refHost: ctx.refHost, refTag: ctx.refTag, device: ctx.device });
  Usage.startEngagement();
};

// Each page the router shows (js/router.js). The same page twice in a row counts once.
Usage.pageView = function (route) {
  const page = usagePageName(route);
  if (!page || page === Usage.lastPage) return;
  Usage.lastPage = page;
  Usage.track("page_view", { detail: page });
};

// ---------- Clicks ----------
// A click is named by the code, never by what's on screen or in the data:
// the element's data-track, else its id, else "nav:<page>" for in-app links,
// "page:<path>" for this site's other pages, "link:<host>" for outside links,
// else its first specific class name. Clicks on the Founder page aren't sent.

const USAGE_GENERIC_CLASSES = /^(btn|btn-[a-z]+|link-button|active|card|nav-link)$/;

function usageClickTarget(el) {
  if (el.dataset && el.dataset.track) return el.dataset.track;
  if (el.id) return el.id;
  if (el.tagName === "A") {
    const href = el.getAttribute("href") || "";
    if (href.startsWith("#/")) return `nav:${href.slice(2)}`;
    try {
      const u = new URL(href, location.href);
      if (u.origin === location.origin) return `page:${u.pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, ".") || "home"}`;
      if (/^https?:$/.test(u.protocol)) return `link:${u.hostname}`;
    } catch {
      // fall through to the class name
    }
  }
  for (const c of el.classList || []) if (!USAGE_GENERIC_CLASSES.test(c)) return c;
  return `unnamed-${el.tagName.toLowerCase()}`;
}

document.addEventListener("click", (e) => {
  if (location.hash === "#/founder") return;
  const el = e.target && e.target.closest ? e.target.closest('button, a, summary, [role="button"], input[type="checkbox"], input[type="radio"], input[type="file"], tr[data-item]') : null;
  if (!el) return;
  const target = usageClickTarget(el);
  if (/^[A-Za-z][A-Za-z0-9:._-]{0,47}$/.test(target)) Usage.track("click", { detail: target });
}, true);

// ---------- Time on page ----------
// "Still here" after 30 s, 2, 5 and 10 minutes of the tab being visible, once
// each per page load. Tells a quick bounce from someone who actually read.

const USAGE_ENGAGED = [[30, "30s"], [120, "2m"], [300, "5m"], [600, "10m"]];

Usage.startEngagement = function () {
  if (Usage.engagementTimer) return;
  let visibleSec = 0;
  let next = 0;
  Usage.engagementTimer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    visibleSec += 5;
    while (next < USAGE_ENGAGED.length && visibleSec >= USAGE_ENGAGED[next][0]) {
      Usage.track("engaged", { reason: USAGE_ENGAGED[next][1] });
      next++;
    }
    if (next >= USAGE_ENGAGED.length) {
      clearInterval(Usage.engagementTimer);
    }
  }, 5000);
};

// After "Delete all my data" the settings store is empty; forget the cached id.
Usage.reset = function () {
  Usage.idPromise = null;
  Usage.once.clear();
};
