// Founder page panels for the advice upgrade (English only, admin only):
//   1. Advice feedback: "shown" and "useful yes/no" counts per recommendation type
//   2. Outside data health: each source, last good fetch, status, failures; the instant off switch
//   3. Free-tier health: ESTIMATED use of each free Cloudflare limit, warning at 70%
//   4. Monthly review: Ideas library placeholders/stale entries, hand-typed local dates
// Data: /api/admin/health (functions/api/admin/health.js) + the usage summary.

Founder.health = null; // /api/admin/health reply, or { error }

Founder.loadHealth = async function () {
  try {
    const res = await fetch("/api/admin/health", { credentials: "same-origin" });
    Founder.health = res.status === 200 ? await res.json() : { error: res.status };
  } catch {
    Founder.health = { error: 0 };
  }
};

Founder.setOutsideSwitch = async function (on) {
  try {
    const res = await fetch("/api/admin/outside-switch", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }),
    });
    return res.status === 200;
  } catch {
    return false;
  }
};

const FOUNDER_REC_NAMES = Object.assign({}, INSIGHT_STRINGS.en.names);
const FOUNDER_GAUGES = {
  requests: ["Requests to Tally's server code (per day)", "Workers + Pages Functions, shared. Static files are free and not counted."],
  d1Writes: ["Database rows written (per day)", "Mostly anonymous usage steps."],
  d1Reads: ["Database rows read (per day)", "Mostly the per-browser daily cap check on each step."],
  d1Storage: ["Database size", "Free plan: 500 MB per database. Estimated from the number of usage rows."],
  cronTriggers: ["Cron Triggers used", "Free plan: 5 per account. Tally uses 1 (the outside-data job)."],
};

function founderAgo(sec) {
  if (!sec) return "never";
  const mins = Math.round((Date.now() / 1000 - sec) / 60);
  if (mins < 90) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

function founderBytes(n) {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

function renderFounderAdvice(d) {
  const recs = (d && d.recommendations) || [];
  const rows = recs.map((r) => `<tr><td>${esc(FOUNDER_REC_NAMES[r.id] || r.id)}</td><td>${r.shown}</td><td>${r.browsers}</td><td>${r.yes}</td><td>${r.no}</td></tr>`).join("");
  return `<div class="card founder-card">
    <h2>Advice cards: shown and "useful?"</h2>
    <p class="founder-sub">"Shown" is counted once per card type per browser per day. Answers are the owner's own taps. No card text or numbers are ever sent.</p>
    ${recs.length ? `<table class="founder-table"><thead><tr><th scope="col">Card</th><th scope="col">Shown</th><th scope="col">Browsers</th><th scope="col">Useful: yes</th><th scope="col">No</th></tr></thead><tbody>${rows}</tbody></table>`
      : "<p>Nothing recorded in this window yet.</p>"}
    <dl class="founder-defs"><dt>Doesn't tell you</dt><dd>Why a card was or wasn't useful, or whether the owner acted on it. A few taps are not evidence that advice works.</dd>
    <dt>Ask a real owner</dt><dd>Which card did you actually try, and what happened?</dd></dl>
  </div>`;
}

function renderFounderOutside(h) {
  if (!h) return `<div class="card founder-card"><h2>Outside data health</h2><p role="status">Loading…</p></div>`;
  if (h.error) return `<div class="card founder-card"><h2>Outside data health</h2><p>Couldn't load (${esc(String(h.error))}). This page needs the server (wrangler pages dev or the live site).</p></div>`;
  const o = h.outside;
  if (!o.ready) return `<div class="card founder-card"><h2>Outside data health</h2><p>Migration 0007 isn't applied on this database yet, so outside data is off.</p></div>`;
  const statusText = { fresh: "Fresh", failing_but_fresh: "Fresh (last fetch failed; showing the last good value)", stale: "STALE: hidden from owners", failed: "FAILED: never fetched successfully; hidden", never: "Not fetched yet" };
  const srcRows = o.sources.map((s) => `<tr>
      <td><a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a></td>
      <td>${esc(statusText[s.status] || s.status)}</td>
      <td>${esc(s.asOf || "--")}${s.storedValue && s.storedValue.national ? ` (U.S. ${esc(String(s.storedValue.national.pct12))}%${s.storedValue.boston ? `, Boston ${esc(String(s.storedValue.boston.pct12))}% for ${esc(s.storedValue.boston.month)}` : ""})` : ""}</td>
      <td>${esc(founderAgo(s.lastSuccessAt))}</td>
      <td>${s.failCount ? `${s.failCount} in a row (${esc(s.lastError || "")}); next try ${esc(s.nextRetryAt ? new Date(s.nextRetryAt * 1000).toLocaleString() : "--")}` : "none"}</td></tr>`).join("");
  const runRows = o.runs.slice(0, 8).map((r) => `<tr><td>${esc(new Date(r.at * 1000).toLocaleString())}</td><td>${r.skipped ? "skipped (switched off)" : r.ok ? "ok" : "FAILED"}</td><td>${r.outbound_requests}</td><td>${esc(r.note || "")}</td></tr>`).join("");
  const lastRunOld = !o.lastRunAt || Date.now() / 1000 - o.lastRunAt > 8 * 3600;
  return `<div class="card founder-card">
    <h2>Outside data health</h2>
    <p><strong>Outside data is ${o.switchOn ? "ON" : "OFF"}.</strong> ${o.deployVar === "off" ? "(Turned off by the OUTSIDE_DATA setting in wrangler.jsonc.)" : ""}
      <button type="button" class="btn btn-sm ${o.switchOn ? "btn-danger" : "btn-secondary"}" id="founderOutsideSwitch" data-on="${o.switchOn ? "0" : "1"}">${o.switchOn ? "Turn outside data off" : "Turn outside data on"}</button></p>
    <p class="founder-sub">Off = BLS price cards disappear for owners within about an hour; nothing else changes. Weather tips are fetched by owners' own browsers from Open-Meteo, so they are switched off in public/js/advice-config.js (outsideData: false) and need a push.</p>
    <table class="founder-table"><thead><tr><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Latest value</th><th scope="col">Last good fetch</th><th scope="col">Failures</th></tr></thead><tbody>${srcRows}</tbody></table>
    <h3>Scheduled job ${lastRunOld ? `<span class="founder-warn">: no run in the last 8 hours. Check the Worker "tally-outside-data" in the Cloudflare dashboard.</span>` : ""}</h3>
    ${runRows ? `<table class="founder-table"><thead><tr><th scope="col">When</th><th scope="col">Result</th><th scope="col">Outside requests</th><th scope="col">Notes</th></tr></thead><tbody>${runRows}</tbody></table>` : "<p>No runs recorded yet. The Worker may not be deployed.</p>"}
    <dl class="founder-defs"><dt>Not monitored here</dt><dd>Open-Meteo (each owner's browser asks it directly, at most once an hour) and the hand-typed Brandeis dates (see Monthly review).</dd></dl>
  </div>`;
}

function renderFounderFreeTier(h) {
  if (!h || h.error || !h.freeTier) return "";
  const g = h.freeTier.gauges.map((x) => {
    const [label, note] = FOUNDER_GAUGES[x.label] || [x.label, ""];
    const pctText = `${(x.share * 100).toFixed(x.share < 0.01 ? 2 : 0)}%`;
    const used = x.label === "d1Storage" ? `${founderBytes(x.used)} of ${founderBytes(x.limit)}` : `${x.used.toLocaleString()} of ${x.limit.toLocaleString()}`;
    return `<li>
      <span class="founder-funnel-label">${esc(label)}${x.warn ? ' <strong class="founder-warn">over 70%</strong>' : ""}</span>
      <span class="founder-funnel-bar" aria-hidden="true"><span style="width:${Math.min(100, Math.max(1, Math.round(x.share * 100)))}%"></span></span>
      <span class="founder-funnel-count">${esc(used)} (${esc(pctText)})</span>
      <span class="founder-sub" style="display:block;">${esc(note)}</span></li>`;
  }).join("");
  const c = h.freeTier.counts;
  const anyWarn = h.freeTier.gauges.some((x) => x.warn);
  return `<div class="card founder-card">
    <h2>Free-tier health (today, UTC)</h2>
    ${anyWarn ? `<p class="founder-warn" role="alert"><strong>Something is over 70% of a free limit.</strong> Nothing is billed (the free plan just stops serving until midnight UTC), but owners could see errors. See MAINTENANCE.md, "If a limit gets close".</p>` : `<p>Everything is under 70% of the free limits.</p>`}
    <ol class="founder-funnel">${g}</ol>
    <p class="founder-sub">ESTIMATES from Tally's own counts: ${c.eventsToday.toLocaleString()} usage steps from ${c.browsersToday} browsers, ${c.visits} visits, ${c.syncs} Square syncs, ${c.cronRunsToday} cron runs so far today. Requests from people who turned counting off aren't seen, so real use can be a bit higher. For exact numbers, open the Cloudflare dashboard (Workers &amp; Pages → Overview, and D1 → counter-db → Metrics); both are free to view.</p>
  </div>`;
}

function renderFounderReview() {
  const today = toDateStrLocal(new Date());
  const ideas = ideasStatus(today);
  const reviewed = LOCAL_CALENDARS.brandeis.reviewedAt;
  const datesAge = adviceDaysBetween(reviewed, today);
  const lastDate = localCalendarEntries("brandeis").slice(-1)[0];
  const datesStale = datesAge > ADVICE_CONFIG.staleDays.localDatesReview || (lastDate && lastDate.end < shiftDate(today, 120));
  const item = (x) => `<li><code>${esc(x.id)}</code>: ${esc(x.title.en)}${x.lastReviewed ? ` (last reviewed ${esc(x.lastReviewed)})` : ""}</li>`;
  return `<div class="card founder-card">
    <h2>Monthly review (about 20 minutes, see MAINTENANCE.md)</h2>
    <h3>Ideas library (public/data/ideas.js)</h3>
    <p>${ideas.usable.length} shown to owners · ${ideas.placeholders.length} placeholders (hidden until you add a real source) · ${ideas.stale.length} older than 12 months (hidden).</p>
    ${ideas.placeholders.length ? `<p class="founder-sub">Placeholders:</p><ul>${ideas.placeholders.map(item).join("")}</ul>` : ""}
    ${ideas.stale.length ? `<p class="founder-warn">Stale, re-check the source:</p><ul>${ideas.stale.map(item).join("")}</ul>` : ""}
    <h3>Brandeis dates (public/js/local-calendar.js)</h3>
    <p>${datesStale ? '<strong class="founder-warn">Needs a check.</strong> ' : ""}Last checked ${esc(reviewed)} (${datesAge} days ago). Dates run until ${esc(lastDate ? lastDate.end : "--")}.
      Re-check against <a href="${esc(LOCAL_CALENDARS.brandeis.sourceUrl)}" target="_blank" rel="noopener noreferrer">the Registrar's calendar</a>, add next year's dates when they're published, then update <code>reviewedAt</code>.</p>
  </div>`;
}

function renderFounderHealth(d) {
  return `<h2 class="founder-section-title">Advice and outside data</h2>
    ${renderFounderAdvice(d)}
    ${renderFounderOutside(Founder.health)}
    ${renderFounderFreeTier(Founder.health)}
    ${renderFounderReview()}`;
}

function wireFounderHealth() {
  const btn = document.getElementById("founderOutsideSwitch");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const ok = await Founder.setOutsideSwitch(btn.dataset.on === "1");
    btn.textContent = ok ? "Saved" : "Couldn't save, try again";
    await Founder.loadHealth();
    if (location.hash === "#/founder") App.renderFounder();
  });
}
