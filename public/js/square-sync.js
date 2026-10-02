// "Connect Square" card, shown on the Home and My Data pages. It only talks
// to this site's own /api/square/* endpoints -- the Square sign-in key stays
// on the server, encrypted. Synced sales go through the same merge/de-dupe
// as an uploaded file and are saved only in this browser (IndexedDB).
// Without that backend (opening index.html directly, or scripts/serve.ps1)
// the card simply stays hidden.

const SquareSync = {
  status: null, // last /api/square/status reply, or { unavailable: true }
  statusPromise: null,
  busy: false,
  progress: null, // text shown while working
  note: null, // { error, text } -- result of the last action
};

const SQUARE_ERROR_KEYS = {
  denied: "squareErrorDenied",
  state: "squareErrorState",
  config: "squareNotConfigured",
};

class SquareSyncError extends Error {}

async function squareRequest(path, method, body) {
  const res = await fetch(path, {
    method: method || "GET",
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = (res.headers.get("Content-Type") || "").includes("application/json");
  return { status: res.status, data: isJson ? await res.json() : null };
}

SquareSync.loadStatus = function () {
  if (!SquareSync.statusPromise) {
    SquareSync.statusPromise = squareRequest("/api/square/status")
      .then(({ data }) => { SquareSync.status = data || { unavailable: true }; })
      .catch(() => { SquareSync.status = { unavailable: true }; })
      .finally(() => { SquareSync.statusPromise = null; });
  }
  return SquareSync.statusPromise;
};

// Draws the card into #squareCard on whichever page is showing.
SquareSync.mount = function () {
  const el = document.getElementById("squareCard");
  if (!el) return;
  const s = SquareSync.status;
  if (!s) {
    SquareSync.loadStatus().then(SquareSync.mount);
    return;
  }
  el.hidden = !!s.unavailable;
  if (s.unavailable) return;

  const badge = s.environment !== "production" ?` <span class="square-badge">${esc(t("squareSandboxBadge"))}</span>` : "";
  const status = SquareSync.progress
    ? `<p class="square-status" role="status">${esc(SquareSync.progress)}</p>`
    : SquareSync.note
      ? `<p class="square-status${SquareSync.note.error ? " square-status-error" : ""}" role="status">${esc(SquareSync.note.text)}</p>`
      : "";
  let body;
  if (!s.configured) {
    body = `<p class="match-note">${esc(t("squareNotConfigured"))}</p>`;
  } else if (!s.connected) {
    body = `
      <p>${esc(t("squareCardIntro"))}</p>
      ${status}
      <div class="data-actions">
        <a class="btn btn-primary" href="/api/square/connect">${esc(t("squareConnectBtn"))}</a>
      </div>
      <p class="match-note">${esc(t("squareFirstSyncNote"))}</p>
      <p class="match-note">${esc(t("squareCardPrivacy"))}</p>`;
  } else {
    const name = s.businessName ? t("squareConnectedTo", { name: s.businessName }) : t("squareConnectedNoName");
    const synced = s.lastSyncedAt ? t("squareLastSynced", { when: new Date(s.lastSyncedAt).toLocaleString() }) : t("squareNeverSynced");
    body = `
      <p><strong>${esc(name)}</strong></p>
      <p class="match-note">${esc(synced)}</p>
      ${status}
      <div class="data-actions">
        <button type="button" class="btn btn-primary" id="squareSyncBtn" ${SquareSync.busy ? "disabled" : ""}>${esc(t("squareSyncBtn"))}</button>
        <button type="button" class="btn btn-ghost" id="squareDisconnectBtn" ${SquareSync.busy ? "disabled" : ""}>${esc(t("squareDisconnectBtn"))}</button>
      </div>
      <p class="match-note">${esc(t("squareCardPrivacy"))}</p>`;
  }
  el.innerHTML = `<h2>${esc(t("squareCardTitle"))}${badge}</h2>${body}`;

  const syncBtn = document.getElementById("squareSyncBtn");
  if (syncBtn) syncBtn.addEventListener("click", () => SquareSync.sync());
  const disconnectBtn = document.getElementById("squareDisconnectBtn");
  if (disconnectBtn) disconnectBtn.addEventListener("click", () => SquareSync.confirmDisconnect());
};

// Server rows -> the app's sales rows. Item names get the same masking as an
// uploaded file *before* merging, so a later re-sync fingerprints identically.
function squareRowToSalesRow(r) {
  return {
    date: String(r.date),
    time: r.time ? String(r.time) : null,
    item: maskPersonalInfo(r.item) || "Payment",
    variation: r.variation ? String(r.variation) : null,
    quantity: Number(r.quantity) || 1,
    price: Number(r.price) || 0,
    orderType: r.orderType || null,
    orderId: r.orderId || null,
    kind: r.kind === "custom" ? "custom" : "product",
    source: "square",
  };
}

SquareSync.sync = async function () {
  if (SquareSync.busy) return;
  SquareSync.busy = true;
  SquareSync.note = null;
  SquareSync.progress = t("squareSyncStarting");
  SquareSync.mount();
  const hadData = App.allRows.length > 0;
  try {
    // Nothing from Square saved here yet (new device, or after "delete all"):
    // ask for the full 90 days rather than "since last sync".
    let body = App.allRows.some((r) => r.source === "square") ? {} : { full: true };
    const rows = [];
    for (let page = 0; page < 1000; page++) {
      const { status, data } = await squareRequest("/api/square/sync", "POST", body);
      if (status === 401) {
        SquareSync.status = Object.assign({}, SquareSync.status, { connected: false });
        Account.reset();
        throw new SquareSyncError(t("squareSessionEnded"));
      }
      if (status !== 200 || !data || !Array.isArray(data.rows)) throw new SquareSyncError(t("squareSyncFailed"));
      data.rows.forEach((r) => rows.push(squareRowToSalesRow(r)));
      SquareSync.progress = t("squareSyncing", { count: rows.length.toLocaleString() });
      SquareSync.mount();
      if (data.done) break;
      body = data.next;
    }
    if (rows.length) await mergeNewRows(rows, { allDuplicateKey: "squareSyncUpToDate" });
    else showMergeBanner(t("squareSyncUpToDate"));
    SquareSync.note = { error: false, text: t("squareSyncDone") };
    await SquareSync.loadStatus();
  } catch (err) {
    SquareSync.note = { error: true, text: err instanceof SquareSyncError ? err.message : t("squareSyncFailed") };
  } finally {
    SquareSync.busy = false;
    SquareSync.progress = null;
  }
  // First data ever -> open the dashboard; otherwise redraw the current page.
  if (!hadData && App.allRows.length) location.hash = "#/dashboard";
  else dispatchRoute();
};

SquareSync.confirmDisconnect = function () {
  showModal({
    title: t("squareDisconnectConfirmTitle"),
    body: t("squareDisconnectConfirmBody"),
    confirmLabel: t("squareDisconnectConfirmYes"),
    cancelLabel: t("dataDeleteConfirmCancel"),
    danger: true,
    onConfirm: SquareSync.disconnect,
  });
};

SquareSync.disconnect = async function () {
  SquareSync.busy = true;
  SquareSync.note = null;
  SquareSync.mount();
  try {
    const { status, data } = await squareRequest("/api/square/disconnect", "POST", {});
    if (status !== 200 || !data) throw new SquareSyncError(t("squareDisconnectFailed"));
    SquareSync.note = { error: false, text: t(data.revokedAtSquare === false ? "squareDisconnectedLocalOnly" : "squareDisconnected") };
  } catch (err) {
    SquareSync.note = { error: true, text: err instanceof SquareSyncError ? err.message : t("squareDisconnectFailed") };
  }
  SquareSync.busy = false;
  await SquareSync.loadStatus();
  SquareSync.mount();
  // The account and its saved reports went with the connection.
  Account.reset();
  Account.mount();
};

// Called once at startup. Handles the return from Square
// (/?square=connected or /?square=error&reason=...), then tidies the URL.
SquareSync.init = async function () {
  const params = new URLSearchParams(location.search);
  const result = params.get("square");
  if (result) history.replaceState(null, "", location.pathname + location.hash);
  await SquareSync.loadStatus();
  SquareSync.mount();
  if (result === "connected" && SquareSync.status.connected) {
    showMergeBanner(t("squareConnectedBanner"));
    SquareSync.sync();
  } else if (result === "error") {
    showError(t(SQUARE_ERROR_KEYS[params.get("reason")] || "squareErrorGeneric"));
  }
};
