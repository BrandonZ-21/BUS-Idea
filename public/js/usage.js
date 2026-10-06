// Anonymous usage steps for the founder dashboard ("upload started",
// "file not recognized: bad date", "report viewed"...). Sends ONLY an event
// name from a fixed list, an optional failure code and a random browser id
// -- never sales data, item names, amounts or file contents.
//
// - The browser id is random (crypto), kept in this device's settings, and
//   replaced when "Delete all my data" is used. It is not a fingerprint.
// - Nothing is sent when the browser asks not to be tracked (Global Privacy
//   Control or Do Not Track), or when the site isn't collecting (the server
//   answers { collecting: false } and this page load stops sending).
// - Failures to send are ignored: counting must never break the app.

const Usage = {
  off: false,
  idPromise: null,
  once: new Set(),
};

function usageOptedOut() {
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1";
}

// "1" once the admin's Founder page has marked this browser as "don't count"
// (js/founder.js), so the founder's own visits stay out of the numbers; "0"
// if the admin chose to be counted here after all. Kept in localStorage so
// it survives "Delete all my data". The server also refuses excluded ids.
const USAGE_EXCLUDED_KEY = "tally.usageExcluded";

function usageExcludedHere() {
  try {
    return localStorage.getItem(USAGE_EXCLUDED_KEY) === "1";
  } catch {
    return false;
  }
}

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
    const res = await fetch("/api/events", {
      method: "POST",
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browserId, event, reason: opts.reason || null, source: opts.source || null }),
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

// After "Delete all my data" the settings store is empty; forget the cached id.
Usage.reset = function () {
  Usage.idPromise = null;
  Usage.once.clear();
};
