// Founder dashboard (#/founder). Admin only: the page asks
// /api/admin/usage, which re-checks the admin role on the server for every
// request -- hiding the nav link is only a convenience. Shows counts of
// anonymous usage steps (js/usage.js), never sales data or saved reports.
// English only for now (the founder is the only reader).

const Founder = {
  mode: "demo", // "demo" (made-up) | "live"
  days: 28,
  data: null,
  error: null, // { status }
  loading: false,
  loadedAt: null,
};

const FOUNDER_NOTE_KEY = "tally.founderNote";

const FOUNDER_REASONS = {
  unsupported_type: "File type not supported",
  read_error: "File couldn't be read",
  empty_file: "File was empty",
  missing_columns: "Date or price column not chosen",
  no_item_column: "No item column",
  bad_date: "Dates not recognized",
  bad_price: "Prices not recognized",
  no_valid_rows: "No usable rows",
  error: "Unexpected error",
  denied: "Owner cancelled on Square's page",
  state: "Sign-in link expired or mismatched",
  config: "Square not set up on the site",
  session_ended: "Square session had ended",
  failed: "Sync request failed",
};
const FOUNDER_STEPS = {
  upload_failed: "Upload",
  square_connect_failed: "Square connect",
  square_sync_failed: "Square sync",
};
const FUNNEL_LABELS = {
  visited: "Opened Tally",
  tried_own_data: "Tried their own data (chose a file or pressed Connect Square)",
  own_data_in: "Own data got in (file read OK or Square connected)",
  report_on_own_data: "Saw a report on their own data",
};

function pct(r) {
  return r === null ? "--" : `${Math.round(r * 100)}%`;
}

function founderNote() {
  try {
    return JSON.parse(localStorage.getItem(FOUNDER_NOTE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveFounderNote(note) {
  try {
    localStorage.setItem(FOUNDER_NOTE_KEY, JSON.stringify(note));
    return true;
  } catch {
    return false;
  }
}

function founderExcludedFlag() {
  try {
    return localStorage.getItem(USAGE_EXCLUDED_KEY); // "1" | "0" | null (never decided)
  } catch {
    return null;
  }
}

// Tells the server (admin only) to count or not count THIS browser, and
// remembers the choice here. Excluding also drops this browser's past steps
// from every number; nothing is deleted, so it can be switched back.
Founder.setExcluded = async function (excluded) {
  try {
    const browserId = await usageBrowserId();
    const res = await fetch("/api/admin/exclude-browser", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browserId, excluded }),
    });
    if (res.status !== 200) return false;
    try {
      localStorage.setItem(USAGE_EXCLUDED_KEY, excluded ? "1" : "0");
    } catch {
      // storage blocked: the server-side exclusion still holds for this id
    }
    return true;
  } catch {
    return false;
  }
};

Founder.load = async function () {
  Founder.loading = true;
  Founder.error = null;
  App.renderFounder();
  // The founder's own browser shouldn't count as a user: the first time the
  // dashboard is opened here, exclude it (the server refuses non-admins).
  if (founderExcludedFlag() === null) await Founder.setExcluded(true);
  try {
    const res = await fetch(`/api/admin/usage?mode=${Founder.mode}&days=${Founder.days}`, { credentials: "same-origin" });
    if (res.status !== 200) {
      Founder.data = null;
      Founder.error = { status: res.status };
    } else {
      Founder.data = await res.json();
      Founder.loadedAt = new Date();
    }
  } catch {
    Founder.data = null;
    Founder.error = { status: 0 };
  }
  Founder.loading = false;
  if (location.hash === "#/founder") App.renderFounder();
};

function founderCard({ title, figure, sub, definition, source, blind, ask }) {
  return `
    <div class="card founder-card">
      <h2>${esc(title)}</h2>
      <p class="founder-figure">${figure}</p>
      ${sub ? `<p class="founder-sub">${sub}</p>` : ""}
      <dl class="founder-defs">
        <dt>Definition</dt><dd>${esc(definition)}</dd>
        <dt>Source</dt><dd>${esc(source)}</dd>
        <dt>Doesn't tell you</dt><dd>${esc(blind)}</dd>
        <dt>Ask a real owner</dt><dd>${esc(ask)}</dd>
      </dl>
    </div>`;
}

// "3 of 9 browsers (33%)" -- counts always next to the rate.
function ofFigure(num, den, unit = "browsers") {
  return `<strong>${num}</strong> of ${den} ${unit} <span class="founder-rate">(${pct(den ? num / den : null)})</span>`;
}

function renderFounderBody(d) {
  const live = d.mode === "live";
  const notCollecting = live && !d.collecting;
  const empty = live && d.collecting && d.eventsInWindow === 0;
  const src = live ? "Anonymous step events from this site (js/usage.js)" : "MADE-UP demo events (lib/usage/demo.js)";

  if (notCollecting) {
    return `<div class="card founder-state" role="status"><h2>Not instrumented on this site</h2>
      <p>Live counting is <strong>off</strong> here (USAGE_EVENTS isn't "on"), so nothing has been collected. This is not the same as zero use. Turning it on needs a separate approval (see DASHBOARD_WORKPLAN.md).</p></div>`;
  }
  if (empty) {
    return `<div class="card founder-state" role="status"><h2>No data yet</h2>
      <p>Counting is on${d.firstEventAt ? ` since ${esc(new Date(d.firstEventAt * 1000).toLocaleString())}` : ""}, but no steps were recorded in the last ${d.window.days} days. Zero observed: share the link with an owner and check back.</p></div>`;
  }

  const f = d.firstReport;
  const c = d.cameBack;
  const tr = d.trust;
  const maxFunnel = Math.max(1, ...d.funnel.map((s) => s.browsers));

  const cards = [
    founderCard({
      title: "1. First report on their own data",
      figure: ofFigure(f.reachedOwn, f.visitors),
      sub: "browsers that opened Tally and then saw a report built from their own file or Square sales",
      definition: `Numerator: browsers with a "report viewed" event on own data. Denominator: browsers with a "visit" event. Window: last ${d.window.days} days.`,
      source: src,
      blind: "Whether they needed help, understood the report, or trusted it. Browsers aren't people.",
      ask: "What did you expect to see after uploading, and was anything confusing on the way?",
    }),
    founderCard({
      title: "2. Came back with new data",
      figure: ofFigure(c.cameBack, c.withOwnData),
      sub: "browsers that added own data on two or more different days",
      definition: `Numerator: browsers with "new data added" (own file or Square) on 2+ different UTC days. Denominator: browsers that added own data at all. Window: last ${d.window.days} days.`,
      source: src,
      blind: "Why someone didn't return. A café may only need this monthly, so a short window undercounts.",
      ask: "When would you next want to look at your numbers, and what would remind you?",
    }),
    founderCard({
      title: "3. Trust: did they hand over real data?",
      figure: `<strong>${tr.sampleOnly}</strong> looked at a sample only · <strong>${tr.connected}</strong> of ${tr.connectStarted} Square connects finished <span class="founder-rate">(${pct(tr.connectRate)})</span>`,
      sub: `${tr.accountsWithSavedReports} account${tr.accountsWithSavedReports === 1 ? "" : "s"} saved at least one report (all time)`,
      definition: `"Sample only": browsers that loaded a sample but never chose their own file or pressed Connect Square. Square: browsers that pressed Connect vs. came back connected. Window: last ${d.window.days} days.`,
      source: src + "; saved-report accounts counted from the database (no report contents read)",
      blind: "Whether a sample-only visitor distrusted Tally or simply didn't have a file at hand.",
      ask: "What would you need to know before connecting your Square account to a new tool?",
    }),
  ];

  const funnel = d.funnel.map((s) => `
    <li>
      <span class="founder-funnel-label">${esc(FUNNEL_LABELS[s.step] || s.step)}</span>
      <span class="founder-funnel-bar" aria-hidden="true"><span style="width:${Math.round((s.browsers / maxFunnel) * 100)}%"></span></span>
      <span class="founder-funnel-count">${s.browsers}</span>
    </li>`).join("");

  const failures = d.failures.length
    ? `<table class="founder-table"><thead><tr><th scope="col">Step</th><th scope="col">Reason</th><th scope="col">Times</th><th scope="col">Browsers</th></tr></thead><tbody>
        ${d.failures.map((x) => `<tr><td>${esc(FOUNDER_STEPS[x.event] || x.event)}</td><td>${esc(FOUNDER_REASONS[x.reason] || x.reason || "--")}</td><td>${x.count}</td><td>${x.browsers}</td></tr>`).join("")}
      </tbody></table>`
    : `<p>Zero failures observed in this window.</p>`;

  const recent = d.recentFailures.length
    ? `<table class="founder-table"><thead><tr><th scope="col">When</th><th scope="col">Step</th><th scope="col">Reason</th></tr></thead><tbody>
        ${d.recentFailures.map((x) => `<tr><td>${esc(new Date(x.at * 1000).toLocaleString())}</td><td>${esc(FOUNDER_STEPS[x.event] || x.event)}</td><td>${esc(FOUNDER_REASONS[x.reason] || x.reason || "--")}</td></tr>`).join("")}
      </tbody></table>`
    : `<p>No failed uploads or syncs recorded.</p>`;

  return `
    <div class="founder-grid">${cards[0]}${cards[1]}${cards[2]}</div>

    <div class="card founder-card">
      <h2>4. Where people stop</h2>
      <p class="founder-sub">Browsers reaching each step, last ${d.window.days} days. Steps aren't strictly in order: someone can fail and retry.</p>
      <ol class="founder-funnel">${funnel}</ol>
      <h3>Why own data didn't get in</h3>
      ${failures}
      <dl class="founder-defs">
        <dt>Source</dt><dd>${esc(src)}</dd>
        <dt>Doesn't tell you</dt><dd>Who left before trying because of the landing page or distrust: they only show up as "Opened Tally".</dd>
        <dt>Ask a real owner</dt><dd>Where did you hesitate, and what would have made the next step obvious?</dd>
      </dl>
    </div>

    <div class="card founder-card">
      <h2>5. Recent failures (last 20, any date)</h2>
      <p class="founder-sub">Someone tried and got nothing. Fixed reason codes only; no file contents.</p>
      ${recent}
    </div>`;
}

function renderExperimentNote() {
  const n = founderNote();
  const field = (key, label) => `
    <label class="founder-note-field"><span>${esc(label)}</span>
      <textarea id="founderNote-${key}" rows="2">${esc(n[key] || "")}</textarea></label>`;
  return `
    <div class="card founder-card">
      <h2>Next experiment (your words)</h2>
      <p class="founder-sub">Saved in this browser only. Tally doesn't send or store this anywhere else.</p>
      ${field("issue", "Observed issue")}
      ${field("evidence", "Evidence (which card, which number)")}
      ${field("change", "The change I'll try")}
      ${field("success", "What would count as improvement")}
      <div class="data-actions"><button type="button" class="btn btn-secondary" id="founderNoteSave">Save note</button>
      <span id="founderNoteStatus" class="founder-sub" role="status"></span></div>
    </div>`;
}

App.renderFounder = function () {
  const root = document.getElementById("view-root");
  const d = Founder.data;
  const isDemo = Founder.mode === "demo";
  let body;
  if (Founder.loading && !d) {
    body = `<p role="status">Loading…</p>`;
  } else if (Founder.error) {
    const s = Founder.error.status;
    body = `<div class="card founder-state" role="alert">${
      s === 401 ? "<h2>Sign in first</h2><p>Connect Square with the admin account (Home page → Connect Square), then come back.</p>"
      : s === 403 ? "<h2>Admins only</h2><p>This account isn't an admin. Roles are set by the owner with scripts/set-role.mjs.</p>"
      : "<h2>Couldn't load the dashboard</h2><p>This is a loading problem, not zero usage. Try again in a minute.</p>"
    }</div>`;
  } else if (d) {
    body = renderFounderBody(d);
  } else {
    body = "";
  }

  root.innerHTML = `
    <h1>Founder dashboard</h1>
    <div class="founder-mode ${isDemo ? "founder-mode-demo" : "founder-mode-live"}" role="note">
      <strong>${isDemo ? "DEMO: made-up data." : "LIVE: real usage on this site."}</strong>
      ${isDemo ? "These numbers are invented to show how the page works. They are not traction." : "Counts of anonymous steps only, by browser (not by person). A handful of testers can't show significance or product-market fit."}
    </div>
    <div class="founder-controls">
      <div role="group" aria-label="Data">
        <button type="button" class="btn btn-sm ${isDemo ? "btn-primary" : "btn-ghost"}" data-founder-mode="demo" aria-pressed="${isDemo}">Demo data</button>
        <button type="button" class="btn btn-sm ${!isDemo ? "btn-primary" : "btn-ghost"}" data-founder-mode="live" aria-pressed="${!isDemo}">Live data</button>
      </div>
      <div role="group" aria-label="Window">
        ${[7, 28].map((n) => `<button type="button" class="btn btn-sm ${Founder.days === n ? "btn-primary" : "btn-ghost"}" data-founder-days="${n}" aria-pressed="${Founder.days === n}">Last ${n} days</button>`).join("")}
      </div>
      <span class="founder-sub">${Founder.loadedAt && d ? `Loaded ${esc(Founder.loadedAt.toLocaleTimeString())}${d.mode === "live" && d.firstEventAt ? ` · counting since ${esc(new Date(d.firstEventAt * 1000).toLocaleDateString())}` : ""}` : ""}</span>
      <button type="button" class="btn btn-sm btn-ghost" id="founderRefresh">Refresh</button>
    </div>
    ${d ? `<p class="founder-sub founder-own" role="status">
      ${founderExcludedFlag() === "1"
        ? "<strong>This browser isn't counted.</strong> Your own visits here, past and future, are left out of the Live numbers."
        : "<strong>This browser is being counted</strong> like any visitor's."}
      <button type="button" class="btn btn-sm btn-ghost" id="founderExcludeToggle">${founderExcludedFlag() === "1" ? "Count this browser" : "Don't count this browser"}</button>
      ${d.mode === "live" && d.excludedBrowsers ? ` · ${d.excludedBrowsers} browser${d.excludedBrowsers === 1 ? "" : "s"} excluded in total` : ""}
    </p>` : ""}
    ${body}
    ${renderExperimentNote()}`;

  root.querySelectorAll("[data-founder-mode]").forEach((b) => b.addEventListener("click", () => {
    Founder.mode = b.dataset.founderMode;
    Founder.data = null;
    Founder.load();
  }));
  root.querySelectorAll("[data-founder-days]").forEach((b) => b.addEventListener("click", () => {
    Founder.days = Number(b.dataset.founderDays);
    Founder.load();
  }));
  document.getElementById("founderRefresh").addEventListener("click", Founder.load);
  const excludeToggle = document.getElementById("founderExcludeToggle");
  if (excludeToggle) excludeToggle.addEventListener("click", async () => {
    excludeToggle.disabled = true;
    await Founder.setExcluded(founderExcludedFlag() !== "1");
    Founder.load(); // numbers change when this browser is added or removed
  });
  document.getElementById("founderNoteSave").addEventListener("click", () => {
    const note = {};
    ["issue", "evidence", "change", "success"].forEach((k) => { note[k] = document.getElementById(`founderNote-${k}`).value; });
    document.getElementById("founderNoteStatus").textContent = saveFounderNote(note) ? "Saved in this browser." : "Couldn't save (browser storage blocked).";
  });

  if (!d && !Founder.loading && !Founder.error) Founder.load();
};
