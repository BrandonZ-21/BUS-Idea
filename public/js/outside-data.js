// Outside data that Tally's server collects on a schedule (see
// workers/outside-data/ and functions/api/outside.js). Today that is one
// thing: the national (and Boston-area) restaurant price index from the U.S.
// Bureau of Labor Statistics. Nothing about the owner is sent to get it: the
// request to /api/outside carries no sales, no location, no account.
//
// Fail-safe by design: any problem (switched off, offline, no backend, stale
// or failed source) just means `OutsideData.data` stays null and the cards
// that use it don't appear. Owners never see an error from this file.
//
// The answer is kept in this browser for 12 hours, so opening the app
// doesn't ask the server again each time.

const OutsideData = {
  data: null, // { bls: { national, boston, retrievedAt, link, ... } } -- fresh sources only
  disabled: false, // true when the server's instant switch is off
  loaded: false,
};

const OUTSIDE_CACHE_KEY = "tally.outsideData";
const OUTSIDE_CACHE_MS = 12 * 60 * 60 * 1000;

OutsideData.load = async function () {
  if (typeof ADVICE_CONFIG !== "undefined" && ADVICE_CONFIG.outsideData === false) {
    OutsideData.disabled = true;
    OutsideData.loaded = true;
    return false;
  }
  const before = JSON.stringify(OutsideData.data);
  try {
    const cached = JSON.parse(localStorage.getItem(OUTSIDE_CACHE_KEY) || "null");
    if (cached && Date.now() - cached.at < OUTSIDE_CACHE_MS) {
      OutsideData.apply(cached.body);
      OutsideData.loaded = true;
      return JSON.stringify(OutsideData.data) !== before;
    }
  } catch {
    // storage blocked or bad JSON: ask the server
  }
  try {
    const res = await fetch("/api/outside", { credentials: "omit" });
    if (res.status !== 200 || !(res.headers.get("Content-Type") || "").includes("application/json")) throw new Error("no outside data");
    const body = await res.json();
    OutsideData.apply(body);
    try { localStorage.setItem(OUTSIDE_CACHE_KEY, JSON.stringify({ at: Date.now(), body })); } catch { /* fine */ }
  } catch {
    OutsideData.data = null; // e.g. scripts/serve.ps1 (no backend) or offline
  }
  OutsideData.loaded = true;
  return JSON.stringify(OutsideData.data) !== before;
};

// Accepts only the shape Tally's own server sends; anything else is ignored.
OutsideData.apply = function (body) {
  OutsideData.disabled = !!(body && body.enabled === false);
  const bls = body && body.sources && body.sources.bls_cpi;
  const ok = (s) => s && typeof s.month === "string" && /^\d{4}-\d{2}$/.test(s.month) && typeof s.pct12 === "number" && Number.isFinite(s.pct12);
  if (OutsideData.disabled || !bls || !bls.value || !ok(bls.value.national)) {
    OutsideData.data = null;
    return;
  }
  OutsideData.data = {
    bls: {
      national: bls.value.national,
      boston: ok(bls.value.boston) ? bls.value.boston : null,
      retrievedAt: String(bls.lastSuccessAt || ""),
      link: /^https:\/\/(www\.|data\.)?bls\.gov\//.test(bls.link || "") ? bls.link : "https://www.bls.gov/cpi/",
    },
  };
};

// Forget the cached answer (used by "Delete all my data").
OutsideData.reset = function () {
  try { localStorage.removeItem(OUTSIDE_CACHE_KEY); } catch { /* fine */ }
  OutsideData.data = null;
  OutsideData.loaded = false;
};
