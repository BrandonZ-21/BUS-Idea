// "Your Tally account" card (Home and My Data pages). A Square sign-in is the
// account. Saving is opt-in: sales stay in this browser (IndexedDB) as
// always; "Save this report" sends only a summary -- totals, weekday/hour
// averages, top 10 items and the insight sentences -- to /api/reports so the
// owner can see it again from any browser. Talks only to this site's own
// /api/account and /api/reports endpoints. Hidden when not signed in.

const Account = {
  me: null, // last /api/account/me reply, or { unavailable: true }
  mePromise: null,
  reports: null, // list from GET /api/reports, or null while loading
  opened: null, // { id, savedAt, report } being viewed
  busy: false,
  note: null, // { error, text }
};

const ACCOUNT_MAX_TEXT = 300;
const ACCOUNT_MAX_NAME = 80;
const accountRound2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const accountClip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

async function accountRequest(path, method, body) {
  const res = await fetch(path, {
    method: method || "GET",
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = (res.headers.get("Content-Type") || "").includes("application/json");
  return { status: res.status, data: isJson ? await res.json() : null };
}

Account.load = function () {
  if (!Account.mePromise) {
    Account.mePromise = accountRequest("/api/account/me")
      .then(({ status, data }) => { Account.me = status === 200 && data ? data : { unavailable: true }; })
      .catch(() => { Account.me = { unavailable: true }; })
      .finally(() => { Account.mePromise = null; });
  }
  return Account.mePromise;
};

// Forget everything cached (after connect, sign-out or disconnect).
Account.reset = function () {
  Account.me = null;
  Account.reports = null;
  Account.opened = null;
  Account.note = null;
};

// Builds the summary that "Save this report" sends, from the rows the
// dashboard is showing (current date range, closed days and one-off
// payments left out the same way). Nothing row-level goes into it.
function buildReportSummary(rows) {
  const range = dateRangeOf(rows);
  const summary = computeSummary(rows);
  const occurrences = weekdayOccurrences(range, closedDates());
  const days = occurrences.reduce((s, c) => s + c, 0) || 1;
  const { averages } = salesByDow(rows, occurrences);
  const hasTime = rows.some((r) => r.time);
  const sources = new Set(rows.map((r) => (r.source === "square" ? "square" : "csv")));
  return {
    v: 1,
    source: sources.size > 1 ? "mixed" : [...sources][0],
    periodStart: range.min,
    periodEnd: range.max,
    totals: { sales: accountRound2(summary.totalSales), orders: summary.orderCount, avgOrder: accountRound2(summary.avgOrder) },
    byWeekday: averages.map(accountRound2),
    byHour: hasTime ? salesByHour(rows).map((v) => accountRound2(v / days)) : null,
    topItems: topItems(rows, 10).top
      .map((it) => ({ name: accountClip(it.item, ACCOUNT_MAX_NAME), quantity: accountRound2(it.quantity), revenue: accountRound2(it.revenue) }))
      .filter((it) => it.name),
    insights: generateInsights(rows)
      .map((ins) => ({ headline: accountClip(ins.headline, ACCOUNT_MAX_TEXT), action: accountClip(ins.action, ACCOUNT_MAX_TEXT) }))
      .filter((ins) => ins.headline)
      .slice(0, 8),
  };
}

Account.mount = function () {
  const el = document.getElementById("accountCard");
  if (!el) return;
  const me = Account.me;
  if (!me) {
    Account.load().then(Account.mount);
    return;
  }
  el.hidden = !me.signedIn;
  if (!me.signedIn) return;
  if (Account.reports === null) {
    Account.loadReports();
    el.innerHTML = `<h2>${esc(t("accountTitle"))}</h2><p class="match-note" role="status">${esc(t("accountLoading"))}</p>`;
    return;
  }

  const who = me.businessName ? t("accountSignedInAs", { name: me.businessName }) : t("accountSignedIn");
  const adminBadge = me.role === "admin" ? ` <span class="square-badge">${esc(t("accountAdminBadge"))}</span>` : "";
  const canSave = App.allRows.length > 0;
  const note = Account.note
    ? `<p class="square-status${Account.note.error ? " square-status-error" : ""}" role="status">${esc(Account.note.text)}</p>`
    : "";
  const list = Account.reports.length
    ? `<ul class="saved-report-list">${Account.reports.map((r) => `
        <li>
          <span><strong>${esc(r.periodStart)} – ${esc(r.periodEnd)}</strong>
            · ${esc(formatMoney(r.totalSales))} · ${esc(t("accountSavedOn", { when: new Date(r.savedAt).toLocaleDateString() }))}</span>
          <span class="saved-report-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-open-report="${esc(r.id)}">${esc(t("accountOpen"))}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-delete-report="${esc(r.id)}">${esc(t("accountDelete"))}</button>
          </span>
        </li>`).join("")}</ul>`
    : `<p class="match-note">${esc(t("accountNoReports"))}</p>`;

  el.innerHTML = `
    <h2>${esc(t("accountTitle"))}${adminBadge}</h2>
    <p><strong>${esc(who)}</strong></p>
    <p class="match-note">${esc(t("accountSaveExplain"))}</p>
    ${note}
    <div class="data-actions">
      <button type="button" class="btn btn-primary" id="accountSaveBtn" ${canSave && !Account.busy ? "" : "disabled"}>${esc(t("accountSaveBtn"))}</button>
    </div>
    ${canSave ? "" : `<p class="match-note">${esc(t("accountSaveNeedsData"))}</p>`}
    <h3>${esc(t("accountSavedTitle"))}</h3>
    ${list}
    ${Account.opened ? renderSavedReport(Account.opened) : ""}
    <div class="data-actions" style="margin-top:16px;">
      <button type="button" class="btn btn-secondary" id="accountSignOutBtn" ${Account.busy ? "disabled" : ""}>${esc(t("accountSignOut"))}</button>
      ${Account.reports.length ? `<button type="button" class="btn btn-danger" id="accountDeleteAllBtn" ${Account.busy ? "disabled" : ""}>${esc(t("accountDeleteAll"))}</button>` : ""}
    </div>
    <details class="match-note" style="margin-top:12px;">
      <summary>${esc(t("accountDetails"))}</summary>
      <p>${esc(t("accountIdLabel"))} <code>${esc(me.merchantId)}</code></p>
      <p>${esc(t("accountPrivacyLine"))} <a href="/privacy.html">${esc(t("privacyLinkText"))}</a></p>
    </details>`;

  const saveBtn = document.getElementById("accountSaveBtn");
  if (saveBtn) saveBtn.addEventListener("click", Account.save);
  document.getElementById("accountSignOutBtn").addEventListener("click", Account.signOut);
  const delAll = document.getElementById("accountDeleteAllBtn");
  if (delAll) {
    delAll.addEventListener("click", () => showModal({
      title: t("accountDeleteAllTitle"),
      body: t("accountDeleteAllBody"),
      confirmLabel: t("accountDeleteAllYes"),
      cancelLabel: t("dataDeleteConfirmCancel"),
      danger: true,
      onConfirm: Account.deleteAll,
    }));
  }
  el.querySelectorAll("[data-open-report]").forEach((b) => b.addEventListener("click", () => Account.open(b.dataset.openReport)));
  el.querySelectorAll("[data-delete-report]").forEach((b) => b.addEventListener("click", () => Account.remove(b.dataset.deleteReport)));
  const closeBtn = document.getElementById("accountCloseReportBtn");
  if (closeBtn) closeBtn.addEventListener("click", () => { Account.opened = null; Account.mount(); });
};

function renderSavedReport({ savedAt, report: r }) {
  const days = r.byWeekday.map((v, i) => `<tr><th scope="row">${esc(dayLong(i))}</th><td>${esc(formatMoney(v))}</td></tr>`).join("");
  const items = r.topItems.map((it) => `<tr><th scope="row">${esc(it.name)}</th><td>${esc(String(it.quantity))}</td><td>${esc(formatMoney(it.revenue))}</td></tr>`).join("");
  const insights = r.insights.map((ins) => `<li><strong>${esc(ins.headline)}</strong>${ins.action ? `<br>${esc(ins.action)}` : ""}</li>`).join("");
  return `
    <section class="saved-report" aria-labelledby="savedReportTitle">
      <h3 id="savedReportTitle">${esc(t("accountReportTitle", { start: r.periodStart, end: r.periodEnd }))}</h3>
      <p class="match-note">${esc(t("accountSavedOn", { when: new Date(savedAt).toLocaleString() }))}</p>
      <p>${esc(t("cardTotalSales"))}: <strong>${esc(formatMoney(r.totals.sales))}</strong> ·
         ${esc(t("cardOrders"))}: <strong>${esc(r.totals.orders.toLocaleString())}</strong> ·
         ${esc(t("cardAvgOrder"))}: <strong>${esc(formatMoney2(r.totals.avgOrder))}</strong></p>
      <h4>${esc(t("accountReportByDay"))}</h4>
      <table class="saved-report-table"><tbody>${days}</tbody></table>
      ${items ? `<h4>${esc(t("accountReportTopItems"))}</h4>
      <table class="saved-report-table"><thead><tr><th scope="col">${esc(t("accountReportItem"))}</th><th scope="col">${esc(t("accountReportQty"))}</th><th scope="col">${esc(t("accountReportSales"))}</th></tr></thead><tbody>${items}</tbody></table>` : ""}
      ${insights ? `<h4>${esc(t("accountReportInsights"))}</h4><ul>${insights}</ul>` : ""}
      <button type="button" class="btn btn-ghost btn-sm" id="accountCloseReportBtn">${esc(t("accountCloseReport"))}</button>
    </section>`;
}

// A 401 anywhere means the session ended (signed out elsewhere, expired,
// disconnected): drop back to the signed-out view.
function accountSessionEnded() {
  Account.reset();
  Account.me = { signedIn: false };
  SquareSync.status = null;
  showError(t("accountSessionEnded"));
  dispatchRoute();
}

Account.loadReports = async function () {
  try {
    const { status, data } = await accountRequest("/api/reports");
    if (status === 401) return accountSessionEnded();
    Account.reports = status === 200 && data ? data.reports : [];
    if (status !== 200) Account.note = { error: true, text: t("accountLoadFailed") };
  } catch {
    Account.reports = [];
    Account.note = { error: true, text: t("accountLoadFailed") };
  }
  Account.mount();
};

Account.save = async function () {
  if (Account.busy || !App.allRows.length) return;
  const rows = getFilteredRows();
  if (!rows.length) return;
  Account.busy = true;
  Account.note = null;
  Account.mount();
  try {
    const { status } = await accountRequest("/api/reports", "POST", buildReportSummary(rows));
    if (status === 401) return accountSessionEnded();
    const errorKey = { 201: null, 409: "accountLimitReached", 413: "accountTooLarge" }[status];
    Account.note = errorKey === null ? { error: false, text: t("accountSaved") } : { error: true, text: t(errorKey || "accountSaveFailed") };
    if (status === 201) {
      Account.reports = null; // reload the list
      Usage.track("report_saved");
    }
  } catch {
    Account.note = { error: true, text: t("accountSaveFailed") };
  } finally {
    Account.busy = false;
  }
  Account.mount();
};

Account.open = async function (id) {
  try {
    const { status, data } = await accountRequest(`/api/reports/${encodeURIComponent(id)}`);
    if (status === 401) return accountSessionEnded();
    if (status !== 200 || !data) throw new Error();
    Account.opened = data;
  } catch {
    Account.note = { error: true, text: t("accountLoadFailed") };
  }
  Account.mount();
  const panel = document.getElementById("savedReportTitle");
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
};

Account.remove = async function (id) {
  try {
    const { status } = await accountRequest(`/api/reports/${encodeURIComponent(id)}`, "DELETE");
    if (status === 401) return accountSessionEnded();
    if (status !== 200 && status !== 404) throw new Error();
    if (Account.opened && Account.opened.id === id) Account.opened = null;
    Account.note = { error: false, text: t("accountDeleted") };
    Account.reports = null;
  } catch {
    Account.note = { error: true, text: t("accountDeleteFailed") };
  }
  Account.mount();
};

Account.deleteAll = async function () {
  try {
    const { status } = await accountRequest("/api/reports", "DELETE");
    if (status === 401) return accountSessionEnded();
    if (status !== 200) throw new Error();
    Account.opened = null;
    Account.note = { error: false, text: t("accountDeletedAll") };
    Account.reports = null;
  } catch {
    Account.note = { error: true, text: t("accountDeleteFailed") };
  }
  Account.mount();
};

Account.signOut = async function () {
  Account.busy = true;
  Account.mount();
  try {
    await accountRequest("/api/account/signout", "POST", {});
  } catch {
    // The cookie may still be cleared; the status reload below shows the truth.
  }
  Account.busy = false;
  Account.reset();
  SquareSync.status = null;
  showMergeBanner(t("accountSignedOut"));
  dispatchRoute();
};
