// Main application logic: state, upload flow, column matching, merging,
// dashboard + detail page rendering. Nothing in this file ever sends the
// owner's data anywhere -- all parsing, storage (IndexedDB) and calculation
// happen locally in the browser.

const App = {
  lang: "en",
  allRows: [],
  rangeMode: "all",
  excludeOneOffs: true, // hide payment links + unusually large tickets everywhere (see getFilteredRows)
  oneOffRows: new Set(), // computed by findOneOffRows on every reload
  itemsGroup: "item", // Items page: "item" | "variation" | "channel"
  itemsChannel: "", // Items page channel filter ("" = all)
  itemsExpanded: null, // Items page: the item whose flavors/variations are shown
  pendingParse: null, // { headers, dataRows, guesses, signature, remembered }
  matchReturnHash: "#/dashboard",
  itemsSort: "quantity",
  itemsSearch: "",
  hoursScope: "all",
  hoursChartType: "bar", // "bar" | "line" -- chart-type toggle on the Hours detail page
  daysChartType: "bar", // "bar" | "line" -- chart-type toggle on the Days detail page
  orderTypesChartType: "doughnut", // "doughnut" | "bar" -- chart-type toggle on the Order Types detail page

  // Dashboard cross-filtering: click a bar on "Sales by Hour of Day" or
  // "Sales by Day of Week" to filter the REST of the dashboard (KPI cards,
  // other charts, insights) to that hour/day -- both can be active at once.
  // Each chart still shows all its own bars (never collapses to one), so you
  // can keep clicking to change or combine filters; a chip near the top
  // shows what's active and clears it.
  dashboardFilterDow: null, // 0-6 or null
  dashboardFilterHour: null, // 0-23 or null
  ignoreHolidays: true,
  holidaysMap: new Map(), // "YYYY-MM-DD" -> { key, nameKey } (computed US holidays)
  customHolidaysMap: new Map(), // "YYYY-MM-DD" -> { date, name } (owner-entered: Chinese New Year, etc.)
  dayNotesMap: new Map(), // "YYYY-MM-DD" -> { date, text, tags }
  notesFilter: "all", // "all" | "noted"
  editingNoteDate: null,

  // Weather (opt-in; off by default). Nothing here is fetched or sent
  // anywhere until weatherEnabled is turned on in Settings.
  weatherEnabled: false,
  weatherLocation: null, // { name, admin1, country, latitude, longitude, timezone }
  weatherUnits: { temp: "F", precip: "in" },
  weatherMap: new Map(), // "YYYY-MM-DD" -> weather record
  weatherGeocodeCandidates: null, // pending list shown for the owner to confirm
  weatherLastError: null,
  weatherLoading: false,

  askHistory: [], // [{question, answer}] -- session only, not saved to disk

  showSunsetOnTrend: false, // toggle on the trend chart; remembered across visits
  customerIdColumnName: null, // the header name last used for hashed customer tracking, shown on the privacy disclosure only
  customerSummaryRows: [], // optional, already-aggregated monthly new/returning report -- a separate data source from hashed per-transaction rows, see js/customer-summary.js
  hasSeenIntro: false, // whether the first-visit explainer overlay has ever been dismissed
  pendingSource: null, // "own" | "sample" -- where the file being matched came from (founder-dashboard counting only)
  dataSource: null, // "own" once the owner's own file/Square data is saved here, "sample" if only samples, null if unknown
};

function closedDates() {
  const set = new Set();
  App.dayNotesMap.forEach((note, date) => {
    if (note.tags && note.tags.includes("closed")) set.add(date);
  });
  return set;
}

// Looks up a holiday on a date from either source and returns a uniform
// { name, custom } shape, so every caller can just read `.name` without
// caring whether it's a computed US holiday or one the owner entered by
// hand (Chinese New Year, Diwali, Eid, or anything else not on the standard
// US calendar). A custom entry on the same date takes priority.
function holidayAt(dateStr) {
  const custom = App.customHolidaysMap.get(dateStr);
  if (custom) return { name: custom.name, custom: true };
  const national = App.holidaysMap.get(dateStr);
  if (national) return { name: t(national.nameKey), key: national.key, custom: false };
  return null;
}

function noteAt(dateStr) {
  return App.dayNotesMap.get(dateStr) || null;
}

// A marketing/promo note can span a date range (start date + endDate), not
// just the single day it's stored under. This finds any promo whose range
// covers a given date, excluding its own start date (already covered by
// noteAt) so it isn't listed twice on that day.
function promoNotesActiveOn(dateStr) {
  const results = [];
  App.dayNotesMap.forEach((n) => {
    if (n.tags && n.tags.includes("promo") && n.endDate && n.date !== dateStr && dateStr >= n.date && dateStr <= n.endDate) {
      results.push(n);
    }
  });
  return results;
}

const KNOWN_NOTE_TAGS = ["rainy", "festival", "shortStaffed", "closed", "promo"];
const PROMO_CHANNELS = ["social", "flyer", "email", "discountCode", "other"];
function tagLabel(tag) {
  if (KNOWN_NOTE_TAGS.includes(tag)) {
    return t("notesTag" + tag.charAt(0).toUpperCase() + tag.slice(1));
  }
  return tag; // a custom "other" tag the owner typed in
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = String(s == null ? "" : s);
  return d.innerHTML;
}

function t(key, vars) {
  const dict = TRANSLATIONS[App.lang] || TRANSLATIONS.en;
  let str = dict[key] !== undefined ? dict[key] : (TRANSLATIONS.en[key] || key);
  if (vars) {
    Object.keys(vars).forEach((k) => {
      str = str.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
    });
  }
  return str;
}

function dayShort(i) { return t(DOW_KEYS[i]); }
function dayLong(i) { return t(DOW_LONG_KEYS[i]); }

function orderTypeLabel(raw) {
  const n = String(raw || "").toLowerCase();
  if (n.includes("dine")) return t("orderTypeDineIn");
  if (n.includes("take") || n.includes("pickup") || n.includes("pick-up")) return t("orderTypeTakeout");
  if (n.includes("deliver")) return t("orderTypeDelivery");
  return raw || t("orderTypeOther");
}

function showView(name) {
  ["view-match", "view-root"].forEach((id) => {
    document.getElementById(id).hidden = id !== name;
  });
}

// With no saved data, nothing except #/home has anything to show, so the
// nav bar leaves out the links to pages that need data rather than showing
// a bunch of links that would just say "upload data first" (see renderNav).
App.showAppShell = function () {
  showView("view-root");
  renderNav();
};

App.updateActiveNav = function (route) {
  document.querySelectorAll("#mainNav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === route || (route === "#/dashboard" && a.getAttribute("href") === "#/dashboard"));
  });
  const brand = document.getElementById("brandName");
  if (brand) brand.classList.toggle("active", route === "#/home");
};

function renderNav() {
  // These pages all need saved sales on this device.
  const items = App.allRows.length ? [
    ["#/dashboard", "navDashboard"],
    ["#/items", "navItems"],
    ["#/ask", "navAsk"],
    ["#/notes", "navNotes"],
    ["#/customers", "navCustomers"],
    ["#/grow", "navGrow"],
    ["#/data", "navData"],
  ] : [];
  // The founder dashboard shows site-wide counts, so an admin gets its link
  // with or without sales here. Convenience only -- the server refuses the
  // dashboard's data to non-admins.
  if (Account.me && Account.me.role === "admin") items.push(["#/founder", "navFounder"]);
  document.getElementById("mainNav").innerHTML = items
    .map(([href, key]) => `<a href="${href}">${esc(t(key))}</a>`)
    .join("");
}

function applyStaticText() {
  document.title = t("appName");
  document.getElementById("brandName").textContent = t("appName");
  document.getElementById("privateBadgeText").textContent = t("privateBadge");
  document.getElementById("footerPrivacyText").textContent = t("privacyNote");
  document.getElementById("footerPrivacyLink").textContent = t("privacyLinkText");
  document.getElementById("langToggleBtn").textContent = t("langToggle");
  document.getElementById("footerNote").textContent = t("insightsDisclaimer");
  renderNav();
}

async function setLang(lang) {
  App.lang = lang;
  await DB.setSetting("lang", lang);
  applyStaticText();
  if (App.pendingParse) {
    renderMatchScreen();
  } else {
    dispatchRoute();
  }
}

function showError(msg) {
  const el = document.getElementById("errorBanner");
  el.innerHTML = `<span>${esc(msg)}</span><button type="button" class="btn btn-ghost" id="dismissErrorBtn">${esc(t("dismiss"))}</button>`;
  el.hidden = false;
  document.getElementById("dismissErrorBtn").addEventListener("click", () => { el.hidden = true; });
}
function clearError() { document.getElementById("errorBanner").hidden = true; }

function showMergeBanner(msg) {
  const el = document.getElementById("mergeBanner");
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 8000);
}

// ---------- Modal ----------
function showModal({ title, body, confirmLabel, cancelLabel, onConfirm, danger }) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <h2 id="modalTitle">${esc(title)}</h2>
        <p>${esc(body)}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="modalCancelBtn">${esc(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" id="modalConfirmBtn">${esc(confirmLabel)}</button>
        </div>
      </div>
    </div>`;
  const close = () => { root.innerHTML = ""; };
  document.getElementById("modalCancelBtn").addEventListener("click", close);
  document.getElementById("modalOverlay").addEventListener("click", (e) => { if (e.target.id === "modalOverlay") close(); });
  document.getElementById("modalConfirmBtn").addEventListener("click", () => { close(); onConfirm(); });
  document.getElementById("modalConfirmBtn").focus();
}

// ---------- Home / landing page (#/home) ----------
// Half marketing page, half functional dropzone -- reachable at any time,
// whether or not you have data saved, via the "Tally" wordmark in the
// header or the #/home route directly. All still fully local (no analytics,
// no images/fonts from a third party beyond the Google Fonts stylesheet
// already loaded in index.html).
const LANDING_FEATURES = [
  { icon: "💬", titleKey: "landingFeatureDashboardTitle", bodyKey: "landingFeatureDashboardBody" },
  { icon: "🌦️", titleKey: "landingFeatureWeatherTitle", bodyKey: "landingFeatureWeatherBody" },
  { icon: "🔁", titleKey: "landingFeatureCustomersTitle", bodyKey: "landingFeatureCustomersBody" },
  { icon: "📈", titleKey: "landingFeatureGrowTitle", bodyKey: "landingFeatureGrowBody" },
  { icon: "🔒", titleKey: "landingFeaturePrivacyTitle", bodyKey: "landingFeaturePrivacyBody" },
  { icon: "🌐", titleKey: "landingFeatureBilingualTitle", bodyKey: "landingFeatureBilingualBody" },
];
const LANDING_STEPS = [
  { titleKey: "landingStep1Title", bodyKey: "landingStep1Body" },
  { titleKey: "landingStep2Title", bodyKey: "landingStep2Body" },
  { titleKey: "landingStep3Title", bodyKey: "landingStep3Body" },
];

App.renderHome = function () {
  const el = document.getElementById("view-root");
  el.innerHTML = `
    <section class="landing-hero">
      <h1>${esc(t("landingHeadline"))}</h1>
      <p class="landing-subhead">${esc(t("landingSubhead"))}</p>
      <div class="landing-hero-actions">
        <button type="button" class="btn btn-primary btn-lg" id="heroGetStartedBtn">${esc(t("landingHeroCta"))}</button>
        <button type="button" class="btn btn-secondary btn-lg" id="heroSampleBtn">${esc(t("landingHeroSecondary"))}</button>
      </div>
      <p class="landing-privacy-line">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 0 1 6 0v3z"/></svg>
        ${esc(t("privacyNote"))}
      </p>
      <button type="button" class="link-button" id="introReopenBtn">${esc(t("introLearnMoreLink"))}</button>
    </section>

    <section class="landing-features">
      <h2 class="landing-section-title">${esc(t("landingFeaturesTitle"))}</h2>
      <div class="landing-feature-grid">
        ${LANDING_FEATURES.map((f) => `
          <div class="landing-feature-card">
            <span class="landing-feature-icon" aria-hidden="true">${f.icon}</span>
            <h3>${esc(t(f.titleKey))}</h3>
            <p>${esc(t(f.bodyKey))}</p>
          </div>
        `).join("")}
      </div>
    </section>

    <section class="landing-how">
      <h2 class="landing-section-title">${esc(t("landingHowTitle"))}</h2>
      <div class="landing-steps">
        ${LANDING_STEPS.map((s) => `
          <div class="landing-step">
            <h3>${esc(t(s.titleKey))}</h3>
            <p>${esc(t(s.bodyKey))}</p>
          </div>
        `).join("")}
      </div>
    </section>

    <section class="landing-upload" id="landingUploadSection">
      <h2 class="landing-section-title">${esc(t("landingUploadTitle"))}</h2>
      <div class="dropzone" id="dropzone">
        <p><strong>${esc(t("uploadDrop"))}</strong></p>
        <p>${esc(t("uploadOr"))}</p>
        <div class="upload-actions">
          <button type="button" class="btn btn-primary" id="chooseFileBtn">${esc(t("uploadChoose"))}</button>
          <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" id="fileInput" class="visually-hidden" aria-label="${esc(t("uploadChoose"))}" />
        </div>
        <p class="upload-help">${esc(t("uploadHelp"))}</p>
      </div>
      <div class="upload-secondary">
        <button type="button" class="btn btn-secondary" id="sampleBtn">${esc(t("uploadSample"))}</button>
        <button type="button" class="btn btn-secondary" id="sample2Btn">${esc(t("uploadSample2"))}</button>
      </div>
      <div class="card square-card" id="squareCard" hidden></div>
      <div class="card square-card" id="accountCard" hidden></div>
    </section>
  `;
  wireUploadWidget(el);
  SquareSync.mount();
  Account.mount();

  const scrollToUpload = () => document.getElementById("landingUploadSection").scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("heroGetStartedBtn").addEventListener("click", scrollToUpload);
  document.getElementById("heroSampleBtn").addEventListener("click", () => loadSampleFile("sample-data.csv"));
  document.getElementById("introReopenBtn").addEventListener("click", showIntroOverlay);

  // Shown automatically exactly once, the very first time anyone opens the
  // app before uploading anything -- never again after that (tracked in
  // IndexedDB settings, not just this tab), and never blocks reaching the
  // dropzone or dashboard either way.
  if (!App.hasSeenIntro && App.allRows.length === 0) {
    App.hasSeenIntro = true;
    DB.setSetting("hasSeenIntro", true);
    showIntroOverlay();
  }
};

// A short, dismissible "what is this" overlay: 3 modest, non-salesy points.
// Reachable again anytime via the link on the home page, regardless of
// whether it's already been seen.
function showIntroOverlay() {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" id="introOverlay">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="introOverlayTitle">
        <h2 id="introOverlayTitle">${esc(t("introTitle"))}</h2>
        <ul class="intro-points">
          <li>${esc(t("introPoint1"))}</li>
          <li>${esc(t("introPoint2"))}</li>
          <li>${esc(t("introPoint3"))}</li>
        </ul>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" id="introDismissBtn">${esc(t("introDismiss"))}</button>
        </div>
      </div>
    </div>`;
  const close = () => { root.innerHTML = ""; };
  document.getElementById("introOverlay").addEventListener("click", (e) => { if (e.target.id === "introOverlay") close(); });
  document.getElementById("introDismissBtn").addEventListener("click", close);
  document.getElementById("introDismissBtn").focus();
}

// True when the thing being dragged is a file (not selected text or a link).
function dragHasFiles(e) {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
}

// A file dropped anywhere outside an upload box would make the browser leave
// the app and open the file itself. Swallow that once, page-wide; the upload
// boxes handle their own drops in wireUploadWidget.
window.addEventListener("dragover", (e) => { if (dragHasFiles(e)) e.preventDefault(); });
window.addEventListener("drop", (e) => { if (dragHasFiles(e)) e.preventDefault(); });

function wireUploadWidget(scopeEl) {
  // By class, not id: the Home page's box is #dropzone, My Data's is #dropzoneData.
  const dz = scopeEl.querySelector(".dropzone");
  const input = scopeEl.querySelector("#fileInput");
  const chooseBtn = scopeEl.querySelector("#chooseFileBtn");
  const sampleBtn = scopeEl.querySelector("#sampleBtn");
  const sample2Btn = scopeEl.querySelector("#sample2Btn");

  if (chooseBtn) chooseBtn.addEventListener("click", () => input.click());
  if (input) input.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });
  if (dz) {
    // Dropping a file does exactly what choosing one does: handleFile().
    const over = (e) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      dz.classList.add("dragover");
    };
    dz.addEventListener("dragenter", over);
    dz.addEventListener("dragover", over);
    // dragleave also fires when moving onto the text/button inside the box;
    // only un-highlight when the pointer has really left it.
    dz.addEventListener("dragleave", (e) => { if (!dz.contains(e.relatedTarget)) dz.classList.remove("dragover"); });
    dz.addEventListener("drop", (e) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      dz.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }
  if (sampleBtn) sampleBtn.addEventListener("click", () => loadSampleFile("sample-data.csv"));
  if (sample2Btn) sample2Btn.addEventListener("click", () => loadSampleFile("sample-data-2.csv"));
}

function fileExt(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "";
}

const EXCEL_EXTENSIONS = ["xlsx", "xls", "xlsm"];
const TEXT_EXTENSIONS = ["csv", "tsv", "txt"];

// Shows an upload error and, for the owner's own file (not the samples),
// counts it for the founder dashboard -- only the fixed reason code, never
// anything from the file. See js/usage.js.
function uploadFailed(reason, message) {
  showError(message);
  if (App.pendingSource === "own") Usage.track("upload_failed", { reason, source: "own" });
}

function handleFile(file) {
  clearError();
  App.pendingSource = "own";
  Usage.track("upload_started", { source: "own" });
  const ext = fileExt(file.name);
  if (EXCEL_EXTENSIONS.includes(ext)) {
    parseExcelFile(file);
  } else if (TEXT_EXTENSIONS.includes(ext) || !ext) {
    parseTextFile(file);
  } else {
    uploadFailed("unsupported_type", t("errorFileType"));
  }
}

function parseTextFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: onParsed,
    error: () => uploadFailed("read_error", t("errorParse")),
  });
}

function parseExcelFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
      const fields = rows.length ? Object.keys(rows[0]) : [];
      onParsed({ data: rows, meta: { fields } });
    } catch (err) {
      uploadFailed("read_error", t("errorParse"));
    }
  };
  reader.onerror = () => uploadFailed("read_error", t("errorParse"));
  reader.readAsArrayBuffer(file);
}

function loadSampleFile(path) {
  clearError();
  App.pendingSource = "sample";
  Usage.track("sample_loaded", { source: "sample" });
  fetch(path)
    .then((r) => {
      if (!r.ok) throw new Error("fetch failed");
      return r.text();
    })
    .then((text) => {
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      onParsed(result);
    })
    .catch(() => showError(t("errorParse")));
}

function onParsed(results) {
  if (!results || results.errors && results.errors.length && (!results.data || !results.data.length)) {
    uploadFailed("read_error", t("errorParse"));
    return;
  }
  if (!results.data || !results.data.length) { uploadFailed("empty_file", t("errorEmpty")); return; }
  const parsedHeaders = results.meta && results.meta.fields ? results.meta.fields : Object.keys(results.data[0]);
  if (!parsedHeaders.length) { uploadFailed("read_error", t("errorParse")); return; }
  // Card digits, staff names (and, for Square, customer columns) are removed
  // here, before the column-matching screen or anything else can see them.
  const { headers, dataRows: data, square } = stripSensitiveColumns(parsedHeaders, results.data);

  const { guesses } = guessColumns(headers);
  const signature = formatSignature(headers);

  DB.getSetting("format:" + signature).then((remembered) => {
    App.pendingParse = {
      headers,
      dataRows: data,
      guesses: remembered || guesses,
      signature,
      remembered: !!remembered,
      square,
    };
    renderMatchScreen();
  });
}

// ---------- Column matching ----------
const MATCH_FIELDS = [
  ["date", "matchDate", true],
  ["time", "matchTime", false],
  ["item", "matchItem", true],
  ["quantity", "matchQuantity", false],
  ["price", "matchPrice", true],
  ["orderType", "matchOrderType", false],
  ["orderId", "matchOrderId", false],
  ["customerId", "matchCustomerId", false],
];

function renderMatchScreen() {
  const p = App.pendingParse;
  if (!p) return;
  showView("view-match");
  const el = document.getElementById("view-match");
  const options = (selected) => {
    let html = `<option value="">${esc(t("matchNone"))}</option>`;
    p.headers.forEach((h) => {
      html += `<option value="${esc(h)}" ${h === selected ? "selected" : ""}>${esc(h)}</option>`;
    });
    return html;
  };
  const looksLikeNotPerOrder = !p.guesses.date && !p.guesses.item && !p.guesses.price;
  el.innerHTML = `
    <h1>${esc(t("matchTitle"))}</h1>
    <p>${esc(t("matchIntro"))}</p>
    ${looksLikeNotPerOrder ? `<div class="thin-data-banner">${esc(t("matchNotPerOrderWarning"))}</div>` : ""}
    ${p.remembered ? `<div class="match-remembered-note">${esc(t("matchRemembered"))}</div>` : ""}
    ${p.square ? `<div class="match-remembered-note">${esc(t("matchSquareDetected"))}</div>` : ""}
    <form id="matchForm">
      <div class="match-grid">
        ${MATCH_FIELDS.map(([field, labelKey]) => `
          <div class="match-field">
            <label for="match-${field}">${esc(t(labelKey))}</label>
            <select id="match-${field}" name="${field}">${options(p.guesses[field])}</select>
            ${field === "quantity" ? `<p class="match-note">${esc(t("matchQuantityNote"))}</p>` : ""}
            ${field === "date" ? `<p class="match-note">${esc(t("matchCombinedHint"))}</p>` : ""}
            ${field === "customerId" ? `<p class="match-note">${esc(t("matchCustomerIdExplain"))}</p>` : ""}
          </div>
        `).join("")}
      </div>
      <button type="submit" class="btn btn-primary">${esc(t("matchConfirm"))}</button>
    </form>
  `;
  document.getElementById("matchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    confirmMatch();
  });
}

// The salt that customer-identifier values are hashed with. Generated once
// with the browser's cryptographic RNG, stored only in this device's
// IndexedDB settings, and never sent anywhere -- it exists purely so the
// same phone/email hashes the same way across uploads (letting repeat
// visits be recognized) without ever storing the phone/email itself.
async function getOrCreateCustomerSalt() {
  let salt = await DB.getSetting("customerHashSalt");
  if (!salt) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    await DB.setSetting("customerHashSalt", salt);
  }
  return salt;
}

// When every row failed to parse, a generic "check your columns" message
// isn't very actionable. This looks at the actual mapped values to say
// specifically what went wrong -- most often a date column whose values
// aren't a full day (e.g. "2021-01", a month only).
// Returns { reason, message }: the reason is a fixed code for the founder
// dashboard, the message is what the owner sees.
function explainWhyNoValidRows(dataRows, mapping) {
  if (!mapping.item) return { reason: "no_item_column", message: t("errorNoValidRowsNoItemColumn") };
  const sampleDateRaw = mapping.date ? dataRows.map((r) => r[mapping.date]).find((v) => v) : null;
  if (sampleDateRaw) {
    const { date } = parseDateString(sampleDateRaw);
    if (!date) return { reason: "bad_date", message: t("errorNoValidRowsBadDateSample", { sample: String(sampleDateRaw) }) };
  }
  const samplePriceRaw = mapping.price ? dataRows.map((r) => r[mapping.price]).find((v) => v !== "" && v !== null && v !== undefined) : null;
  if (samplePriceRaw !== null && samplePriceRaw !== undefined) {
    if (parsePrice(samplePriceRaw) === null) return { reason: "bad_price", message: t("errorNoValidRowsBadPriceSample", { sample: String(samplePriceRaw) }) };
  }
  return { reason: "no_valid_rows", message: t("errorNoValidRows") };
}

async function confirmMatch() {
  const p = App.pendingParse;
  const mapping = {};
  MATCH_FIELDS.forEach(([field]) => {
    const val = document.getElementById("match-" + field).value;
    mapping[field] = val || null;
  });
  if (!mapping.date || !mapping.price) {
    uploadFailed("missing_columns", t("errorMissingRequired"));
    return;
  }
  try {
    const customerSalt = mapping.customerId ? await getOrCreateCustomerSalt() : null;
    const { rows, badCount } = await buildRows(p.dataRows, mapping, customerSalt, { square: p.square });
    if (!rows.length) {
      const why = explainWhyNoValidRows(p.dataRows, mapping);
      uploadFailed(why.reason, why.message);
      return;
    }
    await DB.setSetting("format:" + p.signature, mapping);
    if (mapping.customerId) {
      await DB.setSetting("customerIdColumnName", mapping.customerId);
      App.customerIdColumnName = mapping.customerId;
    }
    App.pendingParse = null;
    const source = App.pendingSource === "sample" ? "sample" : "own";
    const added = await mergeNewRows(rows);
    Usage.track("upload_ok", { source });
    await noteDataSource(source, added);
    clearError();
    location.hash = App.matchReturnHash;
    App.matchReturnHash = "#/dashboard";
    await refreshAllRows();
    dispatchRoute();
    // If weather is already on, make sure it covers the newly-added
    // dates too -- not just whatever range existed the last time the
    // page loaded or the location was set.
    if (App.weatherEnabled && App.weatherLocation) refreshWeatherIfNeeded();
  } catch (err) {
    uploadFailed("error", t("errorGeneric"));
  }
}

// Remembers whether this device holds the owner's own data or only a sample
// (so "report viewed" can be counted as own vs sample), and counts new own
// data for the "came back with new data" signal. Kept in this device's
// settings; "Delete all my data" clears it.
async function noteDataSource(source, added) {
  if (source !== "sample") App.dataSource = "own";
  else if (App.dataSource !== "own") App.dataSource = "sample";
  await DB.setSetting("dataSource", App.dataSource);
  if (added > 0 && source !== "sample") Usage.track("data_added", { source });
}

// ---------- Merge / dedupe ----------
// opts.allDuplicateKey: message when nothing was new (default talks about a file).
async function mergeNewRows(newRows, opts = {}) {
  const existing = App.allRows.length ? App.allRows : await DB.getAllRows();
  const savedByFp = new Map();
  existing.forEach((r) => {
    const fp = r.fingerprint || fingerprintRow(r);
    if (!savedByFp.has(fp)) savedByFp.set(fp, []);
    savedByFp.get(fp).push(r);
  });
  const importCounts = new Map();
  const toInsert = [];
  const toUpgrade = [];
  newRows.forEach((row) => {
    const fp = fingerprintRow(row);
    const occ = importCounts.get(fp) || 0;
    const saved = savedByFp.get(fp) || [];
    if (occ >= saved.length) {
      toInsert.push(Object.assign({}, row, { fingerprint: fp, importedAt: Date.now() }));
    } else if (saved[occ].kind === undefined) {
      // Saved before rows had a kind -- re-uploading the same file fills it in.
      toUpgrade.push(Object.assign(saved[occ], { kind: row.kind, packed: row.packed }, row.customerHash ? { customerHash: row.customerHash } : {}));
    } else if (row.customerHash && !saved[occ].customerHash) {
      // Saved before its (scrambled) customer code was known -- e.g. a Square
      // sync from before customer counting -- so fill it in, never duplicate.
      toUpgrade.push(Object.assign(saved[occ], { customerHash: row.customerHash }));
    }
    importCounts.set(fp, occ + 1);
  });
  const added = toInsert.length;
  const skipped = newRows.length - added;
  if (toUpgrade.length) await DB.putRows(toUpgrade);
  if (added > 0) {
    await DB.addRows(toInsert);
    await DB.setSetting("lastUpload", Date.now());
  }
  if (added === 0) {
    showMergeBanner(t(opts.allDuplicateKey || "mergeAllDuplicate"));
  } else if (skipped === 0) {
    showMergeBanner(t("mergeSummaryNoSkip", { added }));
  } else {
    showMergeBanner(t("mergeSummary", { added, skipped }));
  }
  await refreshAllRows();
  return added;
}

async function refreshAllRows() {
  App.allRows = await DB.getAllRows();
  await scrubSavedRows(App.allRows);
  indexItems(App.allRows);
  App.oneOffRows = findOneOffRows(App.allRows);
  App.holidaysMap = holidaysForRows(App.allRows);
  await refreshDayNotes();
  await refreshCustomHolidays();
}

// Rows saved before names were masked at upload (e.g. a payment link's
// "Traveler Name: ...") get masked in place, once, so the saved copy keeps
// the "Private to you" promise too. The fingerprint is recomputed so a later
// re-upload of the same file still recognizes them as duplicates.
async function scrubSavedRows(rows) {
  const changed = rows.filter((r) => {
    const masked = maskPersonalInfo(r.item) || "Payment";
    if (masked === r.item) return false;
    r.item = masked;
    r.fingerprint = fingerprintRow(r);
    return true;
  });
  if (changed.length) await DB.putRows(changed);
}

async function refreshDayNotes() {
  const notes = await DB.getAllDayNotes();
  App.dayNotesMap = new Map(notes.map((n) => [n.date, n]));
}

async function refreshCustomHolidays() {
  const holidays = await DB.getAllCustomHolidays();
  App.customHolidaysMap = new Map(holidays.map((h) => [h.date, h]));
}

async function refreshWeatherMap() {
  const records = await DB.getAllWeather();
  App.weatherMap = new Map(records.map((r) => [r.date, r]));
}

function weatherAt(dateStr) {
  return App.weatherMap.get(dateStr) || null;
}

// ---------- Date range filter ----------
// Applies the date-range selector AND drops rows on dates tagged "closed" in
// Day Notes, since a closed day shouldn't count toward any average.
// With "Exclude one-off payments" on (the default), payment links and
// unusually large tickets (see findOneOffRows) are left out too, so every
// KPI, chart, insight and detail page reflects normal day-to-day selling.
function getFilteredRows() {
  const ranged = filterByRange(App.allRows, App.rangeMode);
  const closed = closedDates();
  return ranged.filter((r) => !closed.has(r.date) && !(App.excludeOneOffs && App.oneOffRows.has(r)));
}

// One-off payments inside the selected range (whether or not they're hidden).
function oneOffRowsInRange() {
  return filterByRange(App.allRows, App.rangeMode).filter((r) => App.oneOffRows.has(r));
}

// Calendar days in the selected range per weekday (closed days skipped) --
// the denominator for "average sales per Saturday" style charts.
function rangeWeekdayOccurrences() {
  return weekdayOccurrences(rangeBounds(App.allRows, App.rangeMode), closedDates());
}

function maturityWeeks(rows) {
  return weeksCovered(rows);
}

function maturityLabel(weeks) {
  const w = Math.max(1, Math.round(weeks));
  return w === 1 ? t("basedOnWeek1") : t("basedOnWeeks", { weeks: w });
}

function renderRangeSelector() {
  const oneOffs = oneOffRowsInRange();
  const oneOffTotal = oneOffs.reduce((s, r) => s + rowRevenue(r), 0);
  return `
    <div class="date-range-row">
      <label for="rangeSelect">${esc(t("rangeLabel"))}</label>
      <select id="rangeSelect">
        <option value="4weeks" ${App.rangeMode === "4weeks" ? "selected" : ""}>${esc(t("range4weeks"))}</option>
        <option value="8weeks" ${App.rangeMode === "8weeks" ? "selected" : ""}>${esc(t("range8weeks"))}</option>
        <option value="year" ${App.rangeMode === "year" ? "selected" : ""}>${esc(t("rangeThisYear"))}</option>
        <option value="all" ${App.rangeMode === "all" ? "selected" : ""}>${esc(t("rangeAll"))}</option>
      </select>
      <label class="one-off-toggle">
        <input type="checkbox" id="excludeOneOffsToggle" ${App.excludeOneOffs ? "checked" : ""} />
        ${esc(t("excludeOneOffsLabel"))}
      </label>
    </div>
    ${oneOffs.length ? `<p class="chart-meta">${esc(t(App.excludeOneOffs ? "excludeOneOffsHiddenNote" : "excludeOneOffsShownNote", { count: oneOffs.length, amount: formatMoney(oneOffTotal) }))}</p>` : ""}`;
}

function wireRangeSelector(onChange) {
  const sel = document.getElementById("rangeSelect");
  if (sel) sel.addEventListener("change", (e) => {
    App.rangeMode = e.target.value;
    onChange();
  });
  const toggle = document.getElementById("excludeOneOffsToggle");
  if (toggle) toggle.addEventListener("change", async (e) => {
    App.excludeOneOffs = e.target.checked;
    await DB.setSetting("excludeOneOffs", App.excludeOneOffs);
    onChange();
  });
}

// ---------- Holiday / note markers on the weekly trend chart ----------
function dateStrPlusDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// weekStartStr: "YYYY-MM-DD" (the first of the 7 days in that trend-chart bucket).
// Returns short labels like "Labor Day (9/7)" or "rainy (8/30)" for any
// holiday or day-note that falls in that week.
function eventsInWeek(weekStartStr) {
  const events = [];
  for (let i = 0; i < 7; i++) {
    const ds = dateStrPlusDays(weekStartStr, i);
    const shortDate = `${parseInt(ds.slice(5, 7), 10)}/${parseInt(ds.slice(8, 10), 10)}`;
    const h = holidayAt(ds);
    if (h) events.push(`${h.name} (${shortDate})`);
    const n = noteAt(ds);
    if (n && (n.text || (n.tags && n.tags.length))) {
      const label = n.text || (n.tags || []).map(tagLabel).join(", ");
      events.push(`${label} (${shortDate})`);
    }
    promoNotesActiveOn(ds).forEach((p) => {
      events.push(`${p.text || t("notesTagPromo")} (${shortDate})`);
    });
    // Only notable weather (rain/snow, not routine dry/light-rain days) gets
    // a marker here, so the trend chart doesn't get cluttered every week.
    if (App.weatherEnabled) {
      const w = weatherAt(ds);
      if (w) {
        const cat = precipCategory(w.precipSum, w.snowSum);
        if (cat === "rain" || cat === "snow") {
          events.push(`${weatherCategoryLabel(cat)} (${shortDate})`);
        }
      }
    }
  }
  return events;
}

function trendMarkerOpts(byWeek) {
  const markerIndexes = [];
  byWeek.forEach((w, i) => { if (eventsInWeek(w[0]).length) markerIndexes.push(i); });

  // Optional sunset overlay: a week's average sunset time, and an indigo
  // ring around weeks where the sun sets before 5pm on average. Purely
  // local math -- works whenever a location is on file.
  const showSunset = App.showSunsetOnTrend && App.weatherLocation;
  const secondaryMarkerIndexes = [];
  const avgSunsetByWeek = [];
  if (showSunset) {
    byWeek.forEach((w, i) => {
      let sum = 0, count = 0;
      for (let d = 0; d < 7; d++) {
        const ds = dateStrPlusDays(w[0], d);
        const info = daylightFor(ds, App.weatherLocation);
        if (info) { sum += info.sunsetMin; count++; }
      }
      const avg = count ? sum / count : null;
      avgSunsetByWeek.push(avg);
      if (avg !== null && avg < EARLY_SUNSET_MINUTES) secondaryMarkerIndexes.push(i);
    });
  }

  return {
    markerIndexes,
    secondaryMarkerIndexes,
    markerLabelFn: (i) => {
      const lines = eventsInWeek(byWeek[i][0]);
      if (showSunset && avgSunsetByWeek[i] !== null && avgSunsetByWeek[i] !== undefined) {
        lines.push(t("trendSunsetTooltip", { time: formatClockMinutes(avgSunsetByWeek[i]) }));
      }
      return lines;
    },
  };
}

// ---------- Weather (opt-in) ----------
function weatherCategoryLabel(cat) {
  if (!cat) return "";
  const key = "weatherCategory" + cat.charAt(0).toUpperCase() + cat.slice(1);
  return t(key);
}

// Same as weatherCategoryLabel, but appends the actual temperature cutoff
// ("Warm" / "(≤86°F)") in the owner's chosen display unit -- so the
// temperature chart's bars mean something concrete instead of a subjective
// label the owner has to guess the meaning of. Returned as a 2-element array
// rather than one string: Chart.js renders an array tick label as two
// stacked lines, which reads far better than a long single-line label like
// "Warm (≤86°F)" squeezed under a narrow bar.
function weatherCategoryLabelWithRange(cat) {
  const name = weatherCategoryLabel(cat);
  const range = tempBandRangeLabel(cat, App.weatherUnits.temp);
  return range ? [name, `(${range})`] : name;
}

// "Rain" reads fine as a noun/chart label but awkward as "Rain days sell...".
// This gives the adjective form used in sentences like that.
function weatherCategoryAdjective(cat) {
  const key = "weatherCategoryAdj" + cat.charAt(0).toUpperCase() + cat.slice(1);
  return t(key);
}

// Small "Today: 58°F, light rain" line on the dashboard. Shown only when the
// owner has turned weather on; silently omitted (not a blocking error) if
// today's weather simply hasn't been fetched yet or isn't cached.
function renderWeatherLine() {
  if (!App.weatherEnabled) {
    // A quiet, dismissable-feeling nudge (not a nagging banner) so owners
    // who haven't found Settings yet know weather charts/insights exist.
    return `<p class="chart-meta" style="margin-bottom:14px;"><a href="#/data">${esc(t("weatherNudge"))}</a></p>`;
  }
  const today = toDateStrLocal(new Date());
  const rec = weatherAt(today);
  if (!rec) {
    return App.weatherLastError
      ? `<p class="chart-meta" style="margin-bottom:14px;">${esc(App.weatherLastError)}</p>`
      : "";
  }
  const temp = formatTemp(rec.tempMax, App.weatherUnits.temp);
  const condition = weatherCategoryLabel(precipCategory(rec.precipSum, rec.snowSum));
  return `<p class="chart-meta" style="margin-bottom:14px;">${esc(t("weatherTodayLine", { temp, condition }))}
    &middot; <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" style="font-size:0.85em;">${esc(t("weatherAttribution"))} Open-Meteo</a></p>`;
}

// Average daily sales grouped by weather condition / temperature band, for
// the dashboard's weather charts. Only categories that actually have at
// least one day in the current range are included, so a restaurant that
// never saw snow just won't get a "Snow" bar.
function salesByWeatherGroup(rows, categoryOrder, categorizeFn, labelFn) {
  const dailyTotals = computeDailyTotals(rows);
  const sums = {}, counts = {};
  dailyTotals.forEach((revenue, date) => {
    const w = weatherAt(date);
    if (!w) return;
    const cat = categorizeFn(w);
    if (cat == null) return;
    sums[cat] = (sums[cat] || 0) + revenue;
    counts[cat] = (counts[cat] || 0) + 1;
  });
  const labels = [], avgs = [], dayCounts = [];
  categoryOrder.forEach((cat) => {
    if (counts[cat] > 0) {
      labels.push((labelFn || weatherCategoryLabel)(cat));
      avgs.push(sums[cat] / counts[cat]);
      dayCounts.push(counts[cat]);
    }
  });
  return { labels, avgs, dayCounts };
}

function salesByPrecipCategory(rows) {
  return salesByWeatherGroup(rows, ["dry", "lightRain", "rain", "snow"], (w) => precipCategory(w.precipSum, w.snowSum));
}

function salesByTempBand(rows) {
  return salesByWeatherGroup(rows, ["cold", "cool", "mild", "warm", "hot"], (w) => tempCategory(w.tempMax), weatherCategoryLabelWithRange);
}

// Lists any US holidays that fall within the currently selected date range,
// so holidays are visible right on the dashboard, not just in Day Notes or
// the trend chart's markers.
function renderHolidayLine(rows) {
  const range = dateRangeOf(rows);
  if (!range) return "";
  const holidaysInRange = [];
  const seenDates = new Set();
  [App.holidaysMap, App.customHolidaysMap].forEach((map) => {
    map.forEach((_, date) => {
      if (date >= range.min && date <= range.max && !seenDates.has(date)) {
        seenDates.add(date);
        holidaysInRange.push({ date, name: holidayAt(date).name });
      }
    });
  });
  if (!holidaysInRange.length) return "";
  holidaysInRange.sort((a, b) => (a.date < b.date ? -1 : 1));
  const shown = holidaysInRange.slice(0, 4).map((h) => `${h.name} (${h.date.slice(5)})`).join(", ");
  const extra = holidaysInRange.length > 4 ? ` +${holidaysInRange.length - 4}` : "";
  return `<p class="chart-meta" style="margin-bottom:14px;">${esc(t("dashboardHolidaysInRange", { list: shown + extra }))}</p>`;
}

function renderWeatherLocationSection() {
  if (App.weatherGeocodeCandidates) {
    return `
      <p><strong>${esc(t("settingLocationConfirmTitle"))}</strong></p>
      <div id="geocodeCandidates">
        ${App.weatherGeocodeCandidates.map((c, i) => `
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:400;">
            <input type="radio" name="geocodeCandidate" value="${i}" ${i === 0 ? "checked" : ""} />
            ${esc([c.name, c.admin1, c.country].filter(Boolean).join(", "))} (${c.latitude}, ${c.longitude})
          </label>
        `).join("")}
      </div>
      <div class="data-actions">
        <button type="button" class="btn btn-primary" id="confirmGeocodeBtn">${esc(t("settingLocationConfirmBtn"))}</button>
        <button type="button" class="btn btn-ghost" id="cancelGeocodeBtn">${esc(t("notesCancel"))}</button>
      </div>
    `;
  }

  const loc = App.weatherLocation;
  const locationLine = loc
    ? `<p>${esc(t("settingCurrentLocation", { name: [loc.name, loc.admin1, loc.country].filter(Boolean).join(", "), lat: loc.latitude, lon: loc.longitude }))}</p>
       <button type="button" class="btn btn-ghost" id="changeLocationBtn" style="margin-bottom:14px;">${esc(t("settingLocationChange"))}</button>`
    : `<p class="match-note">${esc(t("settingNoLocationYet"))}</p>
       <div class="match-field" style="max-width:320px;">
         <label for="weatherLocationInput">${esc(t("settingLocationLabel"))}</label>
         <div style="display:flex;gap:8px;">
           <input type="text" id="weatherLocationInput" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);" />
           <button type="button" class="btn btn-secondary" id="findLocationBtn">${esc(t("settingLocationFind"))}</button>
         </div>
       </div>
       <button type="button" class="btn btn-ghost" id="useMyLocationBtn" style="margin-top:10px;">${esc(t("settingUseMyLocation"))}</button>`;

  const unitsRow = `
    <div class="match-field" style="max-width:320px;margin-top:10px;">
      <label for="weatherUnitsSelect">${esc(t("settingUnitsLabel"))}</label>
      <select id="weatherUnitsSelect">
        <option value="imperial" ${App.weatherUnits.temp === "F" ? "selected" : ""}>${esc(t("settingUnitsImperial"))}</option>
        <option value="metric" ${App.weatherUnits.temp === "C" ? "selected" : ""}>${esc(t("settingUnitsMetric"))}</option>
      </select>
    </div>`;

  return locationLine + unitsRow;
}

// Shared by both the geocoded-city path and the "use my location" path:
// saves the location, invalidates any cache from a previous location, and
// kicks off an automatic fetch -- from here on nothing needs to be entered
// manually again; every future visit refreshes itself.
async function applyWeatherLocation(loc) {
  App.weatherLocation = loc;
  App.weatherGeocodeCandidates = null;
  await DB.setSetting("weatherLocation", loc);
  await DB.clearWeather();
  await refreshWeatherMap();
  App.renderData();
  refreshWeatherIfNeeded();
}

function wireWeatherLocationSection() {
  const useMyLocationBtn = document.getElementById("useMyLocationBtn");
  if (useMyLocationBtn) {
    useMyLocationBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        App.weatherLastError = t("settingLocationError");
        App.renderData();
        return;
      }
      useMyLocationBtn.disabled = true;
      useMyLocationBtn.textContent = t("settingLocationSearching");
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const loc = {
            name: t("settingUseMyLocation"),
            admin1: "",
            country: "",
            latitude: Math.round(pos.coords.latitude * 100) / 100,
            longitude: Math.round(pos.coords.longitude * 100) / 100,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "auto",
          };
          App.weatherLastError = null;
          await applyWeatherLocation(loc);
        },
        () => {
          App.weatherLastError = t("settingLocationError");
          App.renderData();
        },
        { timeout: 8000 }
      );
    });
  }

  const findBtn = document.getElementById("findLocationBtn");
  if (findBtn) {
    findBtn.addEventListener("click", async () => {
      const input = document.getElementById("weatherLocationInput");
      const query = input.value.trim();
      if (!query) return;
      findBtn.disabled = true;
      findBtn.textContent = t("settingLocationSearching");
      try {
        const candidates = await geocodeLocation(query);
        if (!candidates.length) {
          App.weatherLastError = t("settingLocationNoResults");
        } else {
          App.weatherGeocodeCandidates = candidates;
          App.weatherLastError = null;
        }
      } catch (err) {
        App.weatherLastError = t("settingLocationError");
      }
      App.renderData();
    });
  }

  const changeBtn = document.getElementById("changeLocationBtn");
  if (changeBtn) {
    changeBtn.addEventListener("click", () => {
      App.weatherLocation = null;
      App.renderData();
    });
  }

  const confirmBtn = document.getElementById("confirmGeocodeBtn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      const idx = parseInt(document.querySelector('input[name="geocodeCandidate"]:checked').value, 10);
      await applyWeatherLocation(App.weatherGeocodeCandidates[idx]);
    });
  }

  const cancelBtn = document.getElementById("cancelGeocodeBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      App.weatherGeocodeCandidates = null;
      App.renderData();
    });
  }

  const unitsSelect = document.getElementById("weatherUnitsSelect");
  if (unitsSelect) {
    unitsSelect.addEventListener("change", async (e) => {
      App.weatherUnits = e.target.value === "imperial" ? { temp: "F", precip: "in" } : { temp: "C", precip: "mm" };
      await DB.setSetting("weatherUnits", App.weatherUnits);
    });
  }
}

// Fetches only what's missing: historical actuals for the sales-data date
// range (older than the archive's ~5-day lag), and one batched call for the
// recent lag days + next-week forecast. The forecast/recent portion is
// throttled to at most once per hour since it's the only part that changes
// over time -- once-fetched historical days never need re-fetching.
async function refreshWeatherIfNeeded() {
  if (!App.weatherEnabled || !App.weatherLocation) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    App.weatherLastError = t("weatherOffline");
    return;
  }

  const loc = App.weatherLocation;
  const today = toDateStrLocal(new Date());
  const LAG_DAYS = 10; // covers the archive's ~5-day lag with margin
  const FORECAST_DAYS = 7;

  App.weatherLoading = true;
  try {
    // Historical backfill: only the portion of the sales-data range that's
    // older than the recent/forecast window below, and only if any date in
    // it is still missing from the cache.
    const range = dateRangeOf(App.allRows);
    if (range) {
      const lagCutoff = dateStrPlusDays(today, -LAG_DAYS);
      if (range.min < lagCutoff) {
        const histEnd = range.max < lagCutoff ? range.max : lagCutoff;
        const neededDates = [];
        for (let d = range.min; d <= histEnd; d = dateStrPlusDays(d, 1)) neededDates.push(d);
        const missingDates = neededDates.filter((d) => !App.weatherMap.has(d));
        if (missingDates.length) {
          // Fetch just the span that bounds the missing dates (still one
          // batched call), not the whole history every time -- this matters
          // once new sales data can extend the range on every upload.
          const records = await fetchHistoricalWeather(loc.latitude, loc.longitude, missingDates[0], missingDates[missingDates.length - 1], loc.timezone);
          await DB.putWeatherDays(records);
        }
      }
    }

    // Recent lag days + next-week forecast, throttled to once/hour.
    const lastFetch = await DB.getSetting("weatherLastForecastFetch");
    const dueForRefresh = !lastFetch || (Date.now() - lastFetch) > 60 * 60 * 1000;
    if (dueForRefresh) {
      const records = await fetchRecentAndForecast(loc.latitude, loc.longitude, loc.timezone, LAG_DAYS, FORECAST_DAYS);
      await DB.putWeatherDays(records);
      await DB.setSetting("weatherLastForecastFetch", Date.now());
    }

    App.weatherLastError = null;
    await refreshWeatherMap();
  } catch (err) {
    App.weatherLastError = t("weatherUnavailable");
  }
  App.weatherLoading = false;
  // Re-render whichever view is currently showing, now that weather may
  // have arrived (or a friendly error should now be visible).
  if (location.hash === "#/data" || (!location.hash && false)) App.renderData();
  else dispatchRoute();
}

function busiestHourOf(hourTotals) {
  return hourTotals.indexOf(Math.max(...hourTotals));
}

// Average across only the nonzero entries -- used for a chart's "average"
// reference line, so closed hours/days don't drag a baseline down to
// somewhere meaningless.
function avgOfActive(arr) {
  const active = arr.filter((v) => v > 0);
  return active.length ? active.reduce((s, v) => s + v, 0) / active.length : 0;
}

// Shared thresholds for "does this outside factor actually matter" style
// comparisons (weather, daylight, and any future factor): both groups need
// at least this many days before we trust the comparison, and the two
// averages need to differ by at least this percent before it's worth
// mentioning as an insight rather than noise.
const FACTOR_MIN_DAYS = 5;
const FACTOR_MIN_PCT_DIFF = 8;

// ---------- Insights ----------
function generateInsights(rows) {
  const insights = [];
  if (!rows.length) return insights;
  const summary = computeSummary(rows);
  // "Normal day" baselines (best/slowest day, week-over-week) exclude
  // holidays when the "ignore holidays" setting is on, per Settings, so one
  // freak holiday doesn't get mistaken for a real weekly pattern. Charts
  // elsewhere still show every day's real numbers -- this only affects
  // which days count as "typical" for these comparisons.
  const baselineRows = App.ignoreHolidays ? rows.filter((r) => !holidayAt(r.date)) : rows;
  const { totals: dowTotals, averages: dowAverages } = salesByDow(baselineRows);
  const hasTime = rows.some((r) => r.time);
  const hasOrderType = rows.some((r) => r.orderType);
  const weeks = maturityWeeks(rows);

  // 1. Best vs slowest day
  let bestIdx = 0, worstIdx = 0;
  dowAverages.forEach((v, i) => {
    if (v > dowAverages[bestIdx]) bestIdx = i;
    if (v < dowAverages[worstIdx]) worstIdx = i;
  });
  if (dowAverages[worstIdx] >= 0 && bestIdx !== worstIdx && dowAverages[worstIdx] > 0) {
    const pct = Math.round(((dowAverages[bestIdx] - dowAverages[worstIdx]) / dowAverages[worstIdx]) * 100);
    if (pct > 0) {
      const { dayCounts } = salesByDow(baselineRows);
      insights.push({
        type: "bestVsSlowest",
        headline: t("insightBestVsSlowestHeadline", { bestDay: dayLong(bestIdx), slowestDay: dayLong(worstIdx) }),
        action: t("insightBestVsSlowestAction", { bestDay: dayLong(bestIdx), slowestDay: dayLong(worstIdx), pct }),
        stats: [
          t("statAvgPerDay", { day: dayLong(bestIdx), amount: formatMoney(dowAverages[bestIdx]), count: dayCounts[bestIdx] }),
          t("statAvgPerDay", { day: dayLong(worstIdx), amount: formatMoney(dowAverages[worstIdx]), count: dayCounts[worstIdx] }),
          t("statDifference", { amount: formatMoney(dowAverages[bestIdx] - dowAverages[worstIdx]), pct }),
        ],
        why: t("whyBestVsSlowest"),
        steps: [
          t("stepBestVsSlowest1", { bestDay: dayLong(bestIdx) }),
          t("stepBestVsSlowest2", { slowestDay: dayLong(worstIdx) }),
          t("stepBestVsSlowest3", { slowestDay: dayLong(worstIdx) }),
        ],
        sparkline: { kind: "bar", labels: Array.from({ length: 7 }, (_, i) => dayShort(i)), data: dowAverages, highlightIndexes: [bestIdx, worstIdx] },
      });
    }
  }

  // 1b. Holiday impact -- compares each holiday actually present in the data
  // to a "typical" same-weekday baseline (holidays always excluded from
  // that baseline, regardless of the ignore-holidays setting, since the
  // whole point is comparing a holiday to a normal day).
  {
    const nonHolidayRows = rows.filter((r) => !holidayAt(r.date));
    const nonHolidayByDow = salesByDow(nonHolidayRows);
    const dailyTotals = computeDailyTotals(rows);
    let bestHoliday = null;
    dailyTotals.forEach((revenue, date) => {
      const h = holidayAt(date);
      if (!h) return;
      const dow = rowDayOfWeek({ date });
      const typical = nonHolidayByDow.averages[dow];
      const daysUsed = nonHolidayByDow.dayCounts[dow];
      if (typical > 0 && daysUsed >= 2) {
        const pct = Math.round(((revenue - typical) / typical) * 100);
        if (Math.abs(pct) >= 15 && (!bestHoliday || Math.abs(pct) > Math.abs(bestHoliday.pct))) {
          bestHoliday = { date, name: h.name, pct, dow, revenue, typical, daysUsed };
        }
      }
    });
    if (bestHoliday) {
      const dir = bestHoliday.pct >= 0 ? "up" : "down";
      insights.push({
        type: "holidayImpact",
        headline: t("insightHolidayImpactHeadline", { name: bestHoliday.name, pct: Math.abs(bestHoliday.pct), direction: t(dir), day: dayLong(bestHoliday.dow) }),
        action: t("insightHolidayImpactAction", { name: bestHoliday.name }),
        stats: [
          t("statOnDate", { label: bestHoliday.name, date: bestHoliday.date, amount: formatMoney(bestHoliday.revenue) }),
          t("statAvgPerDay", { day: dayLong(bestHoliday.dow), amount: formatMoney(bestHoliday.typical), count: bestHoliday.daysUsed }),
          t("statDifference", { amount: formatMoney(Math.abs(bestHoliday.revenue - bestHoliday.typical)), pct: Math.abs(bestHoliday.pct) }),
        ],
        why: t("whyHolidayImpact"),
        steps: [
          t("stepHolidayImpact1", { name: bestHoliday.name }),
          t("stepHolidayImpact2"),
        ],
        sparkline: { kind: "bar", labels: [bestHoliday.name, t("statTypicalLabel", { day: dayLong(bestHoliday.dow) })], data: [bestHoliday.revenue, bestHoliday.typical], highlightIndexes: [0] },
      });
    }
  }

  // 1c. Weather comparison -- only when the owner has weather turned on and
  // cached weather actually covers some of these days. A simple same-vs-dry
  // comparison (not yet weekday-adjusted -- that refinement can come later).
  if (App.weatherEnabled && App.weatherMap.size > 0) {
    const dailyTotals = computeDailyTotals(rows);
    const groups = {};
    dailyTotals.forEach((revenue, date) => {
      if (App.ignoreHolidays && holidayAt(date)) return;
      const w = weatherAt(date);
      if (!w) return;
      const cat = precipCategory(w.precipSum, w.snowSum);
      if (!groups[cat]) groups[cat] = { sum: 0, count: 0 };
      groups[cat].sum += revenue;
      groups[cat].count++;
    });
    const dry = groups.dry;
    let bestWeather = null;
    ["rain", "lightRain", "snow"].forEach((cat) => {
      const g = groups[cat];
      if (!g || !dry || g.count < FACTOR_MIN_DAYS || dry.count < FACTOR_MIN_DAYS) return;
      const avgCat = g.sum / g.count, avgDry = dry.sum / dry.count;
      if (avgDry <= 0) return;
      const pct = Math.round(((avgCat - avgDry) / avgDry) * 100);
      if (Math.abs(pct) >= FACTOR_MIN_PCT_DIFF && (!bestWeather || Math.abs(pct) > Math.abs(bestWeather.pct))) {
        bestWeather = { cat, pct, catCount: g.count, dryCount: dry.count };
      }
    });
    if (bestWeather) {
      const dir = bestWeather.pct >= 0 ? "up" : "down";
      const adj = weatherCategoryAdjective(bestWeather.cat);
      const avgCat = groups[bestWeather.cat].sum / groups[bestWeather.cat].count;
      const avgDry = dry.sum / dry.count;
      insights.push({
        type: "weather",
        headline: t("insightWeatherHeadline", { category: adj, pct: Math.abs(bestWeather.pct), direction: t(dir) }),
        action: t("insightWeatherAction", { category: adj, catDays: bestWeather.catCount, dryDays: bestWeather.dryCount }),
        stats: [
          t("statAvgPerDay", { day: weatherCategoryLabel(bestWeather.cat), amount: formatMoney(avgCat), count: bestWeather.catCount }),
          t("statAvgPerDay", { day: weatherCategoryLabel("dry"), amount: formatMoney(avgDry), count: bestWeather.dryCount }),
          t("statDifference", { amount: formatMoney(Math.abs(avgCat - avgDry)), pct: Math.abs(bestWeather.pct) }),
        ],
        why: t("whyWeather"),
        steps: [
          t("stepWeather1", { category: adj }),
          t("stepWeather2", { category: adj }),
        ],
        sparkline: { kind: "bar", labels: [weatherCategoryLabel(bestWeather.cat), weatherCategoryLabel("dry")], data: [avgCat, avgDry], highlightIndexes: [0] },
      });
    }
  }

  // 1d. Daylight/sunset comparison -- purely local math, so (unlike weather)
  // this works whenever a location is on file, whether or not live weather
  // fetching is turned on.
  if (App.weatherLocation) {
    const dailyTotals = computeDailyTotals(rows);
    const early = { sum: 0, count: 0 };
    const late = { sum: 0, count: 0 };
    dailyTotals.forEach((revenue, date) => {
      if (App.ignoreHolidays && holidayAt(date)) return;
      const d = daylightFor(date, App.weatherLocation);
      if (!d) return;
      const bucket = d.sunsetMin < EARLY_SUNSET_MINUTES ? early : late;
      bucket.sum += revenue;
      bucket.count++;
    });
    if (early.count >= FACTOR_MIN_DAYS && late.count >= FACTOR_MIN_DAYS) {
      const avgEarly = early.sum / early.count, avgLate = late.sum / late.count;
      if (avgLate > 0) {
        const pct = Math.round(((avgEarly - avgLate) / avgLate) * 100);
        if (Math.abs(pct) >= FACTOR_MIN_PCT_DIFF) {
          const dir = pct >= 0 ? "up" : "down";
          insights.push({
            type: "daylight",
            headline: t("insightDaylightHeadline", { pct: Math.abs(pct), direction: t(dir) }),
            action: t("insightDaylightAction", { earlyDays: early.count, lateDays: late.count }),
            stats: [
              t("statAvgPerDay", { day: t("statEarlySunsetLabel"), amount: formatMoney(avgEarly), count: early.count }),
              t("statAvgPerDay", { day: t("statLongDaylightLabel"), amount: formatMoney(avgLate), count: late.count }),
              t("statDifference", { amount: formatMoney(Math.abs(avgEarly - avgLate)), pct: Math.abs(pct) }),
            ],
            why: t("whyDaylight"),
            steps: [t("stepDaylight1"), t("stepDaylight2")],
            sparkline: { kind: "bar", labels: [t("statEarlySunsetLabel"), t("statLongDaylightLabel")], data: [avgEarly, avgLate], highlightIndexes: [0] },
          });
        }
      }
    }
  }

  // 2. Peak two hours
  if (hasTime) {
    const hourTotals = salesByHour(rows);
    const sortedHours = hourTotals.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]);
    const top2 = sortedHours.slice(0, 2);
    const top2Sum = top2.reduce((s, x) => s + x[1], 0);
    if (summary.totalSales > 0 && top2Sum > 0) {
      const pct = Math.round((top2Sum / summary.totalSales) * 100);
      const hour1 = formatHourLabel(top2[0][0]), hour2 = formatHourLabel(top2[1] ? top2[1][0] : top2[0][0]);
      insights.push({
        type: "peakHours",
        headline: t("insightPeakHoursHeadline", { pct }),
        action: t("insightPeakHoursAction", { hour1, hour2 }),
        stats: [
          t("statAtHour", { hour: hour1, amount: formatMoney(top2[0][1]) }),
          t("statAtHour", { hour: hour2, amount: formatMoney(top2[1] ? top2[1][1] : top2[0][1]) }),
          t("statShareOfTotal", { pct, amount: formatMoney(top2Sum) }),
        ],
        why: t("whyPeakHours"),
        steps: [
          t("stepPeakHours1", { hour1, hour2 }),
          t("stepPeakHours2", { hour1, hour2 }),
        ],
        sparkline: { kind: "bar", labels: Array.from({ length: 24 }, (_, i) => formatHourLabel(i)), data: hourTotals, highlightIndexes: top2.map((x) => x[0]) },
      });
    }
  }

  // 3. Week over week (2+ weeks) -- also uses the holiday-excluded baseline,
  // so a holiday landing in "last week" doesn't look like a real trend change.
  if (weeks >= 2) {
    const byWeek = salesByWeek(baselineRows);
    if (byWeek.length >= 2) {
      const last = byWeek[byWeek.length - 1][1];
      const prior = byWeek[byWeek.length - 2][1];
      if (prior > 0) {
        const pct = Math.round(Math.abs((last - prior) / prior) * 100);
        const dir = last >= prior ? "up" : "down";
        const recentWeeks = byWeek.slice(-6);
        insights.push({
          type: "weekOverWeek",
          headline: t("insightWeekOverWeekHeadline", { direction: t(dir), pct }),
          action: t(dir === "up" ? "insightWeekOverWeekActionUp" : "insightWeekOverWeekActionDown"),
          stats: [
            t("statWeekOf", { week: byWeek[byWeek.length - 1][0], amount: formatMoney(last) }),
            t("statWeekOf", { week: byWeek[byWeek.length - 2][0], amount: formatMoney(prior) }),
            t("statDifference", { amount: formatMoney(Math.abs(last - prior)), pct }),
          ],
          why: t("whyWeekOverWeek"),
          steps: [
            t(dir === "up" ? "stepWeekOverWeekUp1" : "stepWeekOverWeekDown1"),
            t(dir === "up" ? "stepWeekOverWeekUp2" : "stepWeekOverWeekDown2"),
          ],
          sparkline: { kind: "line", labels: recentWeeks.map((w) => w[0]), data: recentWeeks.map((w) => w[1]), highlightIndexes: [recentWeeks.length - 1] },
        });
      }
    }
  }

  // 4. Top item share
  const { top, all } = topItems(rows, 5);
  if (top.length) {
    const totalQty = all.reduce((s, x) => s + x.quantity, 0);
    const pct = totalQty > 0 ? Math.round((top[0].quantity / totalQty) * 100) : 0;
    insights.push({
      type: "topItem",
      headline: t("insightTopItemHeadline", { item: top[0].item }),
      action: t("insightTopItemAction", { pct }),
      stats: [
        t("statItemSold", { item: top[0].item, qty: top[0].quantity, revenue: formatMoney(top[0].revenue) }),
        t("statShareOfItems", { pct, totalQty }),
      ],
      why: t("whyTopItem"),
      steps: [
        t("stepTopItem1", { item: top[0].item }),
        t("stepTopItem2", { item: top[0].item }),
      ],
      sparkline: { kind: "bar", horizontal: true, labels: top.map((x) => x.item), data: top.map((x) => x.quantity), highlightIndexes: [0] },
    });
  }

  // 5. Quiet stretch
  if (hasTime) {
    const hourTotals = salesByHour(rows);
    const activeHours = hourTotals.map((v, i) => i).filter((i) => hourTotals[i] > 0);
    if (activeHours.length >= 3) {
      const minH = Math.min(...activeHours), maxH = Math.max(...activeHours);
      let quietStart = minH, quietVal = Infinity;
      for (let h = minH + 1; h < maxH - 1; h++) {
        const windowVal = hourTotals[h] + (hourTotals[h + 1] || 0);
        if (windowVal < quietVal) { quietVal = windowVal; quietStart = h; }
      }
      if (quietVal < Infinity) {
        const startHour = formatHourLabel(quietStart), endHour = formatHourLabel(quietStart + 2);
        insights.push({
          type: "quietStretch",
          headline: t("insightQuietStretchHeadline", { startHour, endHour }),
          action: t("insightQuietStretchAction"),
          stats: [
            t("statAtHour", { hour: startHour, amount: formatMoney(hourTotals[quietStart]) }),
            t("statAtHour", { hour: endHour, amount: formatMoney(hourTotals[quietStart + 1] || 0) }),
            t("statBusiestForComparison", { hour: formatHourLabel(busiestHourOf(hourTotals)), amount: formatMoney(Math.max(...hourTotals)) }),
          ],
          why: t("whyQuietStretch"),
          steps: [
            t("stepQuietStretch1", { startHour, endHour }),
            t("stepQuietStretch2", { startHour, endHour }),
          ],
          sparkline: { kind: "bar", labels: Array.from({ length: 24 }, (_, i) => formatHourLabel(i)), data: hourTotals, highlightIndexes: [quietStart, quietStart + 1] },
        });
      }
    }
  }

  // 6. Delivery share
  if (hasOrderType) {
    const deliveryRevenue = rows.filter((r) => r.orderType && r.orderType.toLowerCase().includes("deliver")).reduce((s, r) => s + rowRevenue(r), 0);
    if (deliveryRevenue > 0 && summary.totalSales > 0) {
      const pct = Math.round((deliveryRevenue / summary.totalSales) * 100);
      const otherRevenue = summary.totalSales - deliveryRevenue;
      const typesForSpark = orderTypeSplit(rows);
      insights.push({
        type: "deliveryShare",
        headline: t("insightDeliveryShareHeadline", { pct }),
        action: t("insightDeliveryShareAction"),
        stats: [
          t("statAmount", { label: t("orderTypeDelivery"), amount: formatMoney(deliveryRevenue) }),
          t("statAmount", { label: t("statOtherOrderTypes"), amount: formatMoney(otherRevenue) }),
          t("statShareOfTotal", { pct, amount: formatMoney(deliveryRevenue) }),
        ],
        why: t("whyDeliveryShare"),
        steps: [
          t("stepDeliveryShare1"),
          t("stepDeliveryShare2"),
        ],
        sparkline: { kind: "bar", labels: typesForSpark.map((x) => orderTypeLabel(x.type)), data: typesForSpark.map((x) => x.revenue), highlightIndexes: typesForSpark.map((x, i) => (x.type || "").toLowerCase().includes("deliver") ? i : -1).filter((i) => i >= 0) },
      });
    }
  }

  // 7. Rare items
  const rareItemsList = all.filter((x) => x.quantity <= 3);
  const rareCount = rareItemsList.length;
  if (rareCount > 0) {
    insights.push({
      type: "rareItems",
      headline: t("insightRareItemsHeadline", { count: rareCount }),
      action: t("insightRareItemsAction"),
      stats: rareItemsList.slice(0, 5).map((x) => t("statItemSold", { item: x.item, qty: x.quantity, revenue: formatMoney(x.revenue) })),
      why: t("whyRareItems"),
      steps: [
        t("stepRareItems1"),
        t("stepRareItems2"),
      ],
      sparkline: rareItemsList.length ? { kind: "bar", horizontal: true, labels: rareItemsList.slice(0, 5).map((x) => x.item), data: rareItemsList.slice(0, 5).map((x) => x.quantity), highlightIndexes: [] } : null,
    });
  }

  return insights.slice(0, 5);
}

// ---------- Dashboard ----------
App.renderDashboard = function () {
  const root = document.getElementById("view-root");
  const rows = getFilteredRows();
  Usage.trackOnce("report_viewed", { source: App.dataSource || "unknown" });
  const weeks = maturityWeeks(rows);
  const thin = weeks < 2;
  const hasTime = rows.some((r) => r.time);
  const hasOrderType = rows.some((r) => r.orderType);

  // Cross-filtering: each chart is filtered by the OTHER active filter
  // (never its own), so it keeps showing all its own bars to click/change,
  // while every KPI, other chart, and insight reflects both filters at once.
  const byDow = (list) => (App.dashboardFilterDow === null ? list : list.filter((r) => rowDayOfWeek(r) === App.dashboardFilterDow));
  const byHour = (list) => (App.dashboardFilterHour === null ? list : list.filter((r) => rowHour(r) === App.dashboardFilterHour));
  const hourAxisRows = byDow(rows);
  const dowAxisRows = byHour(rows);
  const crossRows = byHour(byDow(rows));
  const hasActiveFilter = App.dashboardFilterDow !== null || App.dashboardFilterHour !== null;

  const summary = computeSummary(crossRows);
  // Hour/day charts show the average per calendar day (per Saturday, etc.)
  // in the range, so a weekday that happens to occur more often in the
  // window isn't over-represented. Totals stay in the tooltips.
  const occurrences = rangeWeekdayOccurrences();
  const hourDays = App.dashboardFilterDow === null ? occurrences.reduce((s, c) => s + c, 0) : occurrences[App.dashboardFilterDow];
  const hourTotals = salesByHour(hourAxisRows);
  const hourAvgs = hourTotals.map((v) => (hourDays ? v / hourDays : 0));
  const { totals: dowTotals, averages: dowAvgs, dayCounts: dowDayCounts } = salesByDow(dowAxisRows, occurrences);
  const hourTotalsForStat = salesByHour(crossRows);
  const byWeek = salesByWeek(crossRows);
  const showTrend = weeks >= 3 && byWeek.length >= 3;

  const bestDowIdx = dowAvgs.indexOf(Math.max(...dowAvgs));
  const busiestHourIdx = hourTotalsForStat.some((v) => v > 0) ? hourTotalsForStat.indexOf(Math.max(...hourTotalsForStat)) : 0;
  const top2HourIdx = hourTotals.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);

  const { top: topItemsList, rare } = topItems(crossRows, 5);
  const orderTypes = orderTypeSplit(crossRows);
  const showWeatherCharts = App.weatherEnabled && App.weatherMap.size > 0;
  const weatherByPrecip = showWeatherCharts ? salesByPrecipCategory(crossRows) : null;
  const weatherByTemp = showWeatherCharts ? salesByTempBand(crossRows) : null;

  root.innerHTML = `
    ${renderRangeSelector()}
    ${hasActiveFilter ? `
    <div class="filter-chip-row">
      ${App.dashboardFilterDow !== null ? `<span class="filter-chip">${esc(t("filterChipDay", { day: dayLong(App.dashboardFilterDow) }))}<button type="button" data-clear-filter="dow" aria-label="${esc(t("filterChipRemove"))}">&times;</button></span>` : ""}
      ${App.dashboardFilterHour !== null ? `<span class="filter-chip">${esc(t("filterChipHour", { hour: formatHourLabel(App.dashboardFilterHour) }))}<button type="button" data-clear-filter="hour" aria-label="${esc(t("filterChipRemove"))}">&times;</button></span>` : ""}
      <button type="button" class="btn btn-ghost btn-sm" id="clearAllFiltersBtn">${esc(t("filterClearAll"))}</button>
    </div>` : ""}
    ${renderWeatherLine()}
    ${renderHolidayLine(rows)}
    ${thin ? `<div class="thin-data-banner">${esc(t("thinDataBanner"))}</div>` : ""}
    <div class="stat-grid">
      <div class="card stat-card"><div class="stat-label">${esc(t("cardTotalSales"))}</div><div class="stat-value">${formatMoney(summary.totalSales)}</div></div>
      <div class="card stat-card"><div class="stat-label">${esc(t("cardOrders"))}</div><div class="stat-value">${summary.orderCount.toLocaleString()}</div></div>
      <div class="card stat-card"><div class="stat-label">${esc(t("cardAvgOrder"))}</div><div class="stat-value">${formatMoney2(summary.avgOrder)}</div></div>
      <div class="card stat-card"><div class="stat-label">${esc(t("cardBusiestHour"))}</div><div class="stat-value">${hasTime ? formatHourLabel(busiestHourIdx) : "—"}</div></div>
    </div>

    <div class="chart-grid">
      ${hasTime ? `
      <div class="card chart-card">
        <h3>${esc(t("chartHoursTitle"))}</h3>
        <div class="chart-meta">${esc(maturityLabel(weeks))} &middot; ${esc(t("chartAvgPerDayNote"))}</div>
        <div class="chart-canvas-wrap"><canvas id="chart-hours" aria-label="${esc(t("chartHoursTitle"))}" role="img"></canvas></div>
        <a class="see-details-link" href="#/hours">${esc(t("seeDetails"))}</a>
      </div>` : ""}

      <div class="card chart-card">
        <h3>${esc(t("chartDaysTitle"))}</h3>
        <div class="chart-meta">${esc(maturityLabel(weeks))} &middot; ${esc(t("chartAvgPerDayNote"))}</div>
        <div class="chart-canvas-wrap"><canvas id="chart-days" aria-label="${esc(t("chartDaysTitle"))}" role="img"></canvas></div>
        <a class="see-details-link" href="#/days">${esc(t("seeDetails"))}</a>
      </div>

      ${showTrend ? `
      <div class="card chart-card full-width">
        <h3>${esc(t("chartTrendTitle"))}</h3>
        <div class="chart-meta">${esc(maturityLabel(weeks))} ${weeks >= 8 ? "&middot; " + esc(t("dataMatureMonthly")) : ""}</div>
        ${App.weatherLocation ? `<label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--muted);margin-bottom:8px;">
          <input type="checkbox" id="sunsetToggleDashboard" ${App.showSunsetOnTrend ? "checked" : ""} />
          ${esc(t("trendSunsetToggle"))}
        </label>` : ""}
        <div class="chart-canvas-wrap"><canvas id="chart-trend" aria-label="${esc(t("chartTrendTitle"))}" role="img"></canvas></div>
        <a class="see-details-link" href="#/trend">${esc(t("seeDetails"))}</a>
      </div>` : `<div class="card chart-card"><h3>${esc(t("chartTrendTitle"))}</h3><p class="chart-meta">${esc(t("trendNeedsMoreData"))}</p></div>`}

      <div class="card chart-card">
        <h3>${esc(t("chartItemsTitle"))}</h3>
        <div class="chart-meta">${esc(maturityLabel(weeks))}</div>
        <div class="chart-canvas-wrap"><canvas id="chart-items" aria-label="${esc(t("chartItemsTitle"))}" role="img"></canvas></div>
        ${rare.length ? `<p class="chart-meta">${esc(t("chartRareTitle"))}: ${rare.slice(0, 5).map((r) => esc(r.item)).join(", ")}</p>` : ""}
        <a class="see-details-link" href="#/items">${esc(t("seeDetails"))}</a>
      </div>

      ${hasOrderType ? `
      <div class="card chart-card">
        <h3>${esc(t("chartOrderTypeTitle"))}</h3>
        <div class="chart-meta">${esc(maturityLabel(weeks))}</div>
        <div class="chart-canvas-wrap"><canvas id="chart-ordertype" aria-label="${esc(t("chartOrderTypeTitle"))}" role="img"></canvas></div>
        <a class="see-details-link" href="#/order-types">${esc(t("seeDetails"))}</a>
      </div>` : ""}

      ${weatherByPrecip && weatherByPrecip.labels.length >= 2 ? `
      <div class="card chart-card">
        <h3>${esc(t("chartWeatherConditionTitle"))}</h3>
        <div class="chart-meta">${esc(t("chartWeatherAvgNote"))}</div>
        <div class="chart-canvas-wrap"><canvas id="chart-weather-precip" aria-label="${esc(t("chartWeatherConditionTitle"))}" role="img"></canvas></div>
      </div>` : ""}

      ${weatherByTemp && weatherByTemp.labels.length >= 2 ? `
      <div class="card chart-card">
        <h3>${esc(t("chartWeatherTempTitle"))}</h3>
        <div class="chart-meta">${esc(t("chartWeatherAvgNote"))}</div>
        <div class="chart-canvas-wrap"><canvas id="chart-weather-temp" aria-label="${esc(t("chartWeatherTempTitle"))}" role="img"></canvas></div>
      </div>` : ""}

      ${hasTime ? `
      <div class="card chart-card full-width">
        <h3>${esc(t("chartHeatmapTitle"))}</h3>
        <div class="chart-meta">${esc(maturityLabel(weeks))}</div>
        <div class="heatmap-scroll" id="heatmap-dashboard"></div>
        <a class="see-details-link" href="#/heatmap">${esc(t("seeDetails"))}</a>
      </div>` : ""}
    </div>

    <section class="card insights-section">
      <h2>${esc(t("insightsTitle"))}</h2>
      <div id="insightsList"></div>
      <p class="insights-disclaimer">${esc(t("insightsDisclaimer"))}</p>
    </section>
  `;

  wireRangeSelector(() => App.renderDashboard());

  document.querySelectorAll("[data-clear-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.clearFilter === "dow") App.dashboardFilterDow = null;
      else App.dashboardFilterHour = null;
      App.renderDashboard();
    });
  });
  const clearAllBtn = document.getElementById("clearAllFiltersBtn");
  if (clearAllBtn) clearAllBtn.addEventListener("click", () => {
    App.dashboardFilterDow = null;
    App.dashboardFilterHour = null;
    App.renderDashboard();
  });

  // Clicking a bar here filters the rest of the dashboard to that hour/day
  // (cross-filtering) instead of navigating away -- "See details" still
  // goes to the full detail page. Clicking the already-selected bar clears it.
  function barClickToggle(getCurrent, setValue) {
    return (evt, elements) => {
      const hit = elements.find((el) => el.datasetIndex === 0);
      if (!hit) return;
      setValue(getCurrent() === hit.index ? null : hit.index);
      App.renderDashboard();
    };
  }

  if (hasTime) {
    renderBarChart("chart-hours", Array.from({ length: 24 }, (_, i) => formatHourLabel(i)), hourAvgs, {
      highlightIndexes: top2HourIdx,
      selectedIndex: App.dashboardFilterHour,
      onClick: barClickToggle(() => App.dashboardFilterHour, (v) => { App.dashboardFilterHour = v; }),
      tooltipFormatter: (ctx) => t("tooltipAvgAndTotal", { avg: formatMoney2(hourAvgs[ctx.dataIndex]), total: formatMoney(hourTotals[ctx.dataIndex]), count: hourDays }),
      xAxisLabel: t("axisHourOfDay"), yAxisLabel: t("axisAvgSales"),
      averageLine: avgOfActive(hourAvgs), averageLineLabel: t("legendAverageLine"),
    });
    attachChartLegend("chart-hours", [
      { color: COLORS.amber, label: t("legendBusiestHoursAvg") },
      { color: COLORS.slate, label: t("legendClickToFilter") },
      { color: COLORS.muted, label: t("legendAverageLine") },
    ]);
  }
  renderBarChart("chart-days", Array.from({ length: 7 }, (_, i) => dayShort(i)), dowAvgs, {
    highlightIndexes: [bestDowIdx],
    selectedIndex: App.dashboardFilterDow,
    onClick: barClickToggle(() => App.dashboardFilterDow, (v) => { App.dashboardFilterDow = v; }),
    tooltipFormatter: (ctx) => t("tooltipAvgAndTotal", { avg: formatMoney2(dowAvgs[ctx.dataIndex]), total: formatMoney(dowTotals[ctx.dataIndex]), count: dowDayCounts[ctx.dataIndex] }),
    xAxisLabel: t("axisDayOfWeek"), yAxisLabel: t("axisAvgSales"),
    averageLine: avgOfActive(dowAvgs), averageLineLabel: t("legendAverageLine"),
  });
  attachChartLegend("chart-days", [
    { color: COLORS.amber, label: t("legendBestDayAverage") },
    { color: COLORS.slate, label: t("legendClickToFilter") },
    { color: COLORS.muted, label: t("legendAverageLine") },
  ]);
  if (showTrend) {
    renderLineChart("chart-trend", byWeek.map((w) => w[0]), byWeek.map((w) => w[1]), Object.assign({
      onClick: () => { location.hash = "#/trend"; },
      xAxisLabel: t("axisWeek"), yAxisLabel: t("axisSales"),
    }, trendMarkerOpts(byWeek)));
    const trendLegendItems = [{ color: COLORS.amber, label: t("trendLegendMarker") }];
    if (App.showSunsetOnTrend && App.weatherLocation) trendLegendItems.push({ color: COLORS.slate, label: t("trendSunsetLegend") });
    attachChartLegend("chart-trend", trendLegendItems);
    const sunsetToggle = document.getElementById("sunsetToggleDashboard");
    if (sunsetToggle) {
      sunsetToggle.addEventListener("change", async (e) => {
        App.showSunsetOnTrend = e.target.checked;
        await DB.setSetting("showSunsetOnTrend", App.showSunsetOnTrend);
        App.renderDashboard();
      });
    }
  }
  renderBarChart("chart-items", topItemsList.map((x) => x.item), topItemsList.map((x) => x.quantity), {
    horizontal: true,
    tooltipFormatter: (ctx) => ctx.parsed.x + (ctx.parsed.x === 1 ? " item" : " items"),
    onClick: () => { location.hash = "#/items"; },
    xAxisLabel: t("axisOrderCount"), yAxisLabel: t("axisItem"),
  });
  if (hasOrderType) {
    renderDoughnutChart("chart-ordertype", orderTypes.map((x) => orderTypeLabel(x.type)), orderTypes.map((x) => x.revenue), {
      onClick: () => { location.hash = "#/order-types"; },
    });
  }
  if (weatherByPrecip && weatherByPrecip.labels.length >= 2) {
    renderBarChart("chart-weather-precip", weatherByPrecip.labels, weatherByPrecip.avgs, {
      tooltipFormatter: (ctx) => `${formatMoney(ctx.parsed.y)} (${weatherByPrecip.dayCounts[ctx.dataIndex]} days)`,
      xAxisLabel: t("axisWeatherCondition"), yAxisLabel: t("axisSales"),
    });
  }
  if (weatherByTemp && weatherByTemp.labels.length >= 2) {
    renderBarChart("chart-weather-temp", weatherByTemp.labels, weatherByTemp.avgs, {
      tooltipFormatter: (ctx) => `${formatMoney(ctx.parsed.y)} (${weatherByTemp.dayCounts[ctx.dataIndex]} days)`,
      xAxisLabel: t("axisTemperature"), yAxisLabel: t("axisSales"),
    });
  }
  if (hasTime) {
    const grid = heatmapData(crossRows);
    renderHeatmap(document.getElementById("heatmap-dashboard"), grid, {
      dayLabels: Array.from({ length: 7 }, (_, i) => dayShort(i)),
      cellLabel: (dow, h, v) => t("heatmapCellLabel", { day: dayLong(dow), hour: formatHourLabel(h), amount: formatMoney(v) }),
      onCellClick: () => { location.hash = "#/heatmap"; },
      legendLessLabel: t("heatmapLegendLess"), legendMoreLabel: t("heatmapLegendMore"),
    });
  }

  const insights = generateInsights(crossRows);
  renderInsightCards(insights);
};

// Renders the dashboard's expandable tip cards. Each card starts collapsed
// (just the headline + short action, like before); clicking/tapping it
// expands in place to show the exact numbers, a "why this matters" note,
// concrete next steps, and a small chart -- all computed locally, no AI.
function renderInsightCards(insights) {
  const container = document.getElementById("insightsList");
  container.innerHTML = insights.map((ins, i) => `
    <div class="insight-card">
      <button type="button" class="insight-toggle" id="insight-toggle-${i}" aria-expanded="false" aria-controls="insight-detail-${i}">
        <span class="insight-icon" aria-hidden="true"></span>
        <span class="insight-headline-wrap">
          <span class="insight-headline">${esc(ins.headline)}</span>
          <span class="insight-action">${esc(ins.action)}</span>
        </span>
        <span class="insight-caret" aria-hidden="true">▾</span>
      </button>
      <div class="insight-detail" id="insight-detail-${i}" hidden>
        ${ins.stats && ins.stats.length ? `<ul class="finding-list">${ins.stats.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
        ${ins.why ? `<p class="insight-why">${esc(ins.why)}</p>` : ""}
        ${ins.steps && ins.steps.length ? `<ul class="try-list">${ins.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
        ${ins.sparkline ? `<div class="chart-canvas-wrap" style="height:180px;"><canvas id="insight-spark-${i}"></canvas></div>` : ""}
      </div>
    </div>
  `).join("") || `<p>${esc(t("dataNoData"))}</p>`;

  insights.forEach((ins, i) => {
    const btn = document.getElementById(`insight-toggle-${i}`);
    const detail = document.getElementById(`insight-detail-${i}`);
    let sparkDrawn = false;
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      detail.hidden = expanded;
      if (!expanded && ins.sparkline && !sparkDrawn) {
        sparkDrawn = true;
        const sp = ins.sparkline;
        if (sp.kind === "line") {
          renderLineChart(`insight-spark-${i}`, sp.labels, sp.data, {});
        } else {
          renderBarChart(`insight-spark-${i}`, sp.labels, sp.data, { horizontal: !!sp.horizontal, highlightIndexes: sp.highlightIndexes || [] });
        }
      }
    });
  });
}

// ---------- Detail: Hours ----------
App.renderHoursDetail = function () {
  const root = document.getElementById("view-root");
  const allFiltered = getFilteredRows();
  const scope = App.hoursScope;
  const rows = scope === "all" ? allFiltered : allFiltered.filter((r) => {
    const dow = rowDayOfWeek(r);
    return scope === "weekday" ? dow >= 1 && dow <= 5 : dow === 0 || dow === 6;
  });
  const weeks = maturityWeeks(allFiltered);
  const hourTotals = salesByHour(rows);
  const sortedHours = hourTotals.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]);
  const busiest = sortedHours[0];
  const top2 = sortedHours.slice(0, 2);
  const totalSales = hourTotals.reduce((s, v) => s + v, 0);
  const pct2 = totalSales > 0 ? Math.round(((top2[0][1] + (top2[1] ? top2[1][1] : 0)) / totalSales) * 100) : 0;

  const activeHours = hourTotals.map((v, i) => i).filter((i) => hourTotals[i] > 0);
  let quietText = "";
  let quietStartHour = null, quietEndHour = null;
  if (activeHours.length >= 3) {
    const minH = Math.min(...activeHours), maxH = Math.max(...activeHours);
    let quietStart = minH, quietVal = Infinity;
    for (let h = minH + 1; h < maxH - 1; h++) {
      const windowVal = hourTotals[h] + (hourTotals[h + 1] || 0);
      if (windowVal < quietVal) { quietVal = windowVal; quietStart = h; }
    }
    if (quietVal < Infinity) {
      quietStartHour = formatHourLabel(quietStart);
      quietEndHour = formatHourLabel(quietStart + 2);
      quietText = t("hoursFinding3", { startHour: quietStartHour, endHour: quietEndHour });
    }
  }

  root.innerHTML = `
    <a class="see-details-link" href="#/dashboard">${esc(t("backToDashboard"))}</a>
    <div class="detail-header"><h1>${esc(t("chartHoursTitle"))}</h1><span class="maturity-note">${esc(maturityLabel(weeks))}</span></div>

    <div class="toggle-row">
      <div class="toggle-group" role="group" aria-label="${esc(t("chartHoursTitle"))}">
        <button type="button" data-scope="all" class="${scope === "all" ? "active" : ""}">${esc(t("hoursToggleAll"))}</button>
        <button type="button" data-scope="weekday" class="${scope === "weekday" ? "active" : ""}">${esc(t("hoursToggleWeekday"))}</button>
        <button type="button" data-scope="weekend" class="${scope === "weekend" ? "active" : ""}">${esc(t("hoursToggleWeekend"))}</button>
      </div>
      <div class="toggle-group" role="group" aria-label="${esc(t("chartTypeToggleLabel"))}">
        <button type="button" data-chart-type="bar" class="${App.hoursChartType === "bar" ? "active" : ""}">${esc(t("chartTypeBar"))}</button>
        <button type="button" data-chart-type="line" class="${App.hoursChartType === "line" ? "active" : ""}">${esc(t("chartTypeLine"))}</button>
      </div>
    </div>

    <div class="card">
      <div class="chart-canvas-wrap tall"><canvas id="chart-hours-detail"></canvas></div>
    </div>

    <div class="detail-section">
      <h2>${esc(t("detailWhatShows"))}</h2>
      <p>${esc(t("hoursWhatShows"))}</p>
    </div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatFound"))}</h2>
      <ul class="finding-list">
        <li>${esc(t("hoursFinding1", { hour: formatHourLabel(busiest[0]), amount: formatMoney(busiest[1]) }))}</li>
        <li>${esc(t("hoursFinding2", { hour1: formatHourLabel(top2[0][0]), hour2: formatHourLabel(top2[1] ? top2[1][0] : top2[0][0]), pct: pct2 }))}</li>
        ${quietText ? `<li>${esc(quietText)}</li>` : ""}
      </ul>
    </div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatTry"))}</h2>
      <ul class="try-list">
        <li>${esc(t("hoursTry1", { hour1: formatHourLabel(top2[0][0]), hour2: formatHourLabel(top2[1] ? top2[1][0] : top2[0][0]) }))}</li>
        ${quietStartHour ? `<li>${esc(t("hoursTry2", { startHour: quietStartHour, endHour: quietEndHour }))}</li>` : ""}
      </ul>
    </div>
  `;

  const hourLabels = Array.from({ length: 24 }, (_, i) => formatHourLabel(i));
  const renderFn = App.hoursChartType === "line" ? renderLineChart : renderBarChart;
  renderFn("chart-hours-detail", hourLabels, hourTotals, {
    highlightIndexes: top2.map((x) => x[0]),
    markerIndexes: top2.map((x) => x[0]),
    xAxisLabel: t("axisHourOfDay"), yAxisLabel: t("axisSales"),
    averageLine: avgOfActive(hourTotals), averageLineLabel: t("legendAverageLine"),
  });
  attachChartLegend("chart-hours-detail", [
    { color: COLORS.amber, label: t("legendBusiestHours") },
    { color: COLORS.muted, label: t("legendAverageLine") },
  ]);

  root.querySelectorAll("[data-scope]").forEach((btn) => {
    btn.addEventListener("click", () => { App.hoursScope = btn.dataset.scope; App.renderHoursDetail(); });
  });
  root.querySelectorAll("[data-chart-type]").forEach((btn) => {
    btn.addEventListener("click", () => { App.hoursChartType = btn.dataset.chartType; App.renderHoursDetail(); });
  });
};

// ---------- Detail: Days ----------
App.renderDaysDetail = function () {
  const root = document.getElementById("view-root");
  const rows = getFilteredRows();
  const weeks = maturityWeeks(rows);
  const { totals, averages } = salesByDow(rows, rangeWeekdayOccurrences());
  const bestIdx = averages.indexOf(Math.max(...averages));
  const worstIdx = averages.indexOf(Math.min(...averages));
  const pct = averages[worstIdx] > 0 ? Math.round(((averages[bestIdx] - averages[worstIdx]) / averages[worstIdx]) * 100) : 0;

  root.innerHTML = `
    <a class="see-details-link" href="#/dashboard">${esc(t("backToDashboard"))}</a>
    <div class="detail-header"><h1>${esc(t("chartDaysTitle"))}</h1><span class="maturity-note">${esc(maturityLabel(weeks))}</span></div>

    <div class="toggle-row">
      <div class="toggle-group" role="group">
        <button type="button" data-mode="average" class="active">${esc(t("daysShowAverage"))}</button>
        <button type="button" data-mode="total">${esc(t("daysShowTotal"))}</button>
      </div>
      <div class="toggle-group" role="group" aria-label="${esc(t("chartTypeToggleLabel"))}">
        <button type="button" data-chart-type="bar" class="${App.daysChartType === "bar" ? "active" : ""}">${esc(t("chartTypeBar"))}</button>
        <button type="button" data-chart-type="line" class="${App.daysChartType === "line" ? "active" : ""}">${esc(t("chartTypeLine"))}</button>
      </div>
    </div>

    <div class="card"><div class="chart-canvas-wrap tall"><canvas id="chart-days-detail"></canvas></div></div>

    <div class="detail-section"><h2>${esc(t("detailWhatShows"))}</h2><p>${esc(t("daysWhatShows"))}</p></div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatFound"))}</h2>
      <ul class="finding-list">
        <li>${esc(t("daysFinding1", { bestDay: dayLong(bestIdx), avg: formatMoney(averages[bestIdx]) }))}</li>
        <li>${esc(t("daysFinding2", { bestDay: dayLong(bestIdx), pct, slowestDay: dayLong(worstIdx) }))}</li>
      </ul>
    </div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatTry"))}</h2>
      <ul class="try-list">
        <li>${esc(t("daysTry1", { bestDay: dayLong(bestIdx) }))}</li>
        <li>${esc(t("daysTry2", { slowestDay: dayLong(worstIdx) }))}</li>
      </ul>
    </div>
  `;

  let mode = "average";
  const dayLabels = Array.from({ length: 7 }, (_, i) => dayShort(i));
  const draw = () => {
    const data = mode === "total" ? totals : averages;
    const highlightIdx = mode === "total" ? totals.indexOf(Math.max(...totals)) : bestIdx;
    const renderFn = App.daysChartType === "line" ? renderLineChart : renderBarChart;
    renderFn("chart-days-detail", dayLabels, data, {
      highlightIndexes: [highlightIdx],
      markerIndexes: [highlightIdx],
      xAxisLabel: t("axisDayOfWeek"), yAxisLabel: t("axisSales"),
      averageLine: avgOfActive(data), averageLineLabel: t("legendAverageLine"),
    });
    attachChartLegend("chart-days-detail", [
      { color: COLORS.amber, label: mode === "total" ? t("legendBusiestDayTotal") : t("legendBestDayAverage") },
      { color: COLORS.muted, label: t("legendAverageLine") },
    ]);
  };
  draw();
  root.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll("[data-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.mode;
      draw();
    });
  });
  root.querySelectorAll("[data-chart-type]").forEach((btn) => {
    btn.addEventListener("click", () => { App.daysChartType = btn.dataset.chartType; App.renderDaysDetail(); });
  });
};

// ---------- Detail: Items ----------
// Works on item rows (js/square-items.js): a Square receipt is split into
// its items, any other file's rows are already one item each.
App.renderItemsDetail = function () {
  const root = document.getElementById("view-root");
  const rows = getFilteredRows();
  const weeks = maturityWeeks(rows);
  const allItems = itemRowsFor(rows);
  const channels = Array.from(new Set(allItems.map((it) => it.channel).filter(Boolean))).sort();
  if (!channels.includes(App.itemsChannel)) App.itemsChannel = "";
  if (App.itemsGroup === "channel" && !channels.length) App.itemsGroup = "item";
  const items = App.itemsChannel ? allItems.filter((it) => it.channel === App.itemsChannel) : allItems;
  const groupKeys = {
    item: (it) => it.name,
    variation: (it) => (it.variation ? `${it.name} (${it.variation})` : it.name),
    channel: (it) => it.channel || t("itemsChannelNone"),
  };
  const groups = summarize(items, groupKeys[App.itemsGroup]);
  const byUnits = groups.slice().sort((a, b) => b.units - a.units);
  const totalUnits = groups.reduce((s, g) => s + g.units, 0);
  const totalRevenue = groups.reduce((s, g) => s + g.revenue, 0);
  const topUnitsPct = totalUnits > 0 ? Math.round((byUnits.slice(0, 5).reduce((s, g) => s + g.units, 0) / totalUnits) * 100) : 0;
  const rareCount = groups.filter((g) => g.units <= 3).length;
  const hasPacked = rows.some((r) => r.packed);
  const estBadge = (g) => (g.estimatedUnits > 0 ? `<span class="est-badge" title="${esc(t("itemsEstimatedTitle", { count: g.estimatedUnits }))}">${esc(t("itemsEstimatedBadge"))}</span>` : "");

  root.innerHTML = `
    <a class="see-details-link" href="#/dashboard">${esc(t("backToDashboard"))}</a>
    <div class="detail-header"><h1>${esc(t("itemsPageTitle"))}</h1><span class="maturity-note">${esc(maturityLabel(weeks))}</span></div>
    ${renderRangeSelector()}

    <div class="toggle-row">
      <div class="toggle-group" role="group" aria-label="${esc(t("itemsGroupLabel"))}">
        <button type="button" data-items-group="item" class="${App.itemsGroup === "item" ? "active" : ""}">${esc(t("itemsGroupItem"))}</button>
        <button type="button" data-items-group="variation" class="${App.itemsGroup === "variation" ? "active" : ""}">${esc(t("itemsGroupVariation"))}</button>
        ${channels.length ? `<button type="button" data-items-group="channel" class="${App.itemsGroup === "channel" ? "active" : ""}">${esc(t("itemsGroupChannel"))}</button>` : ""}
      </div>
      ${channels.length ? `
      <div class="search-row">
        <label for="itemChannel">${esc(t("itemsChannelLabel"))}</label>
        <select id="itemChannel">
          <option value="">${esc(t("itemsChannelAll"))}</option>
          ${channels.map((c) => `<option value="${esc(c)}" ${App.itemsChannel === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
      </div>` : ""}
    </div>
    ${hasPacked ? `<p class="chart-meta">${esc(t("itemsReconcileNote", { amount: formatMoney2(totalRevenue) }))}</p>` : ""}

    <div class="chart-grid">
      <div class="card chart-card">
        <h3>${esc(t("itemsChartRevenue"))}</h3>
        <div class="chart-canvas-wrap tall"><canvas id="chart-items-revenue"></canvas></div>
      </div>
      <div class="card chart-card">
        <h3>${esc(t("itemsChartUnits"))}</h3>
        <div class="chart-canvas-wrap tall"><canvas id="chart-items-units"></canvas></div>
      </div>
    </div>

    <div class="detail-section"><h2>${esc(t("detailWhatShows"))}</h2><p>${esc(t("itemsWhatShows"))}</p></div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatFound"))}</h2>
      <ul class="finding-list">
        <li>${esc(t("itemsFinding1", { item: byUnits[0] ? byUnits[0].key : "—", qty: byUnits[0] ? byUnits[0].units : 0 }))}</li>
        <li>${esc(t("itemsFindingRevenue", { item: groups[0] ? groups[0].key : "—", revenue: formatMoney(groups[0] ? groups[0].revenue : 0) }))}</li>
        <li>${esc(t("itemsFinding2", { pct: topUnitsPct }))}</li>
        <li>${esc(t("itemsFinding3", { count: rareCount }))}</li>
      </ul>
    </div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatTry"))}</h2>
      <ul class="try-list">
        <li>${esc(t("itemsTry1", { item: byUnits[0] ? byUnits[0].key : "" }))}</li>
        <li>${esc(t("itemsTry2"))}</li>
      </ul>
    </div>

    <div class="card">
      <div class="search-row">
        <label class="visually-hidden" for="itemSearch">${esc(t("itemsSearchLabel"))}</label>
        <input type="search" id="itemSearch" placeholder="${esc(t("itemsSearchLabel"))}" value="${esc(App.itemsSearch)}" />
        <label for="itemSort">${esc(t("itemsSortLabel"))}</label>
        <select id="itemSort">
          <option value="quantity" ${App.itemsSort === "quantity" ? "selected" : ""}>${esc(t("itemsSortQty"))}</option>
          <option value="revenue" ${App.itemsSort === "revenue" ? "selected" : ""}>${esc(t("itemsSortRevenue"))}</option>
          <option value="name" ${App.itemsSort === "name" ? "selected" : ""}>${esc(t("itemsSortName"))}</option>
        </select>
      </div>
      ${App.itemsGroup === "item" ? `<p class="match-note">${esc(t("itemsDrillHint"))}</p>` : ""}
      <table class="data-table items-table">
        <thead><tr><th>${esc(t("itemsColItem"))}</th><th>${esc(t("itemsColQty"))}</th><th>${esc(t("itemsColRevenue"))}</th></tr></thead>
        <tbody id="itemsTableBody"></tbody>
      </table>
    </div>
  `;

  const topRevenue = groups.slice(0, 8);
  const topUnits = byUnits.slice(0, 8);
  renderBarChart("chart-items-revenue", topRevenue.map((g) => g.key), topRevenue.map((g) => g.revenue), {
    horizontal: true, xAxisLabel: t("axisSales"), yAxisLabel: t("axisItem"),
  });
  renderBarChart("chart-items-units", topUnits.map((g) => g.key), topUnits.map((g) => g.units), {
    horizontal: true, xAxisLabel: t("axisOrderCount"), yAxisLabel: t("axisItem"),
    tooltipFormatter: (ctx) => t("itemsUnitsTooltip", { count: ctx.parsed.x.toLocaleString() }),
  });

  function renderTable() {
    const search = App.itemsSearch.toLowerCase();
    const list = groups.filter((g) => g.key.toLowerCase().includes(search)).sort((a, b) => {
      if (App.itemsSort === "name") return a.key.localeCompare(b.key);
      if (App.itemsSort === "revenue") return b.revenue - a.revenue;
      return b.units - a.units;
    });
    const canDrill = App.itemsGroup === "item";
    document.getElementById("itemsTableBody").innerHTML = list.map((g, i) => {
      const expanded = canDrill && App.itemsExpanded === g.key;
      const variations = expanded ? summarize(items.filter((it) => it.name === g.key), (it) => it.variation || "—") : [];
      return `
        <tr ${canDrill ? `data-item="${i}" tabindex="0" aria-expanded="${expanded}"` : ""}>
          <td>${canDrill ? (expanded ? "▾ " : "▸ ") : ""}${esc(g.key)}${estBadge(g)}</td><td>${g.units.toLocaleString()}</td><td>${formatMoney2(g.revenue)}</td>
        </tr>
        ${variations.map((v) => `<tr class="variation-row"><td>${esc(v.key)}${estBadge(v)}</td><td>${v.units.toLocaleString()}</td><td>${formatMoney2(v.revenue)}</td></tr>`).join("")}`;
    }).join("");
    document.querySelectorAll("#itemsTableBody tr[data-item]").forEach((tr) => {
      const key = list[Number(tr.dataset.item)].key;
      const toggle = () => {
        App.itemsExpanded = App.itemsExpanded === key ? null : key;
        renderTable();
      };
      tr.addEventListener("click", toggle);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
  }
  renderTable();
  wireRangeSelector(() => App.renderItemsDetail());
  root.querySelectorAll("[data-items-group]").forEach((btn) => {
    btn.addEventListener("click", () => { App.itemsGroup = btn.dataset.itemsGroup; App.itemsExpanded = null; App.renderItemsDetail(); });
  });
  const channelSel = document.getElementById("itemChannel");
  if (channelSel) channelSel.addEventListener("change", (e) => { App.itemsChannel = e.target.value; App.renderItemsDetail(); });
  document.getElementById("itemSearch").addEventListener("input", (e) => { App.itemsSearch = e.target.value; renderTable(); });
  document.getElementById("itemSort").addEventListener("change", (e) => { App.itemsSort = e.target.value; renderTable(); });
};

// ---------- Detail: Trend ----------
App.renderTrendDetail = function () {
  const root = document.getElementById("view-root");
  const rows = getFilteredRows();
  const weeks = maturityWeeks(rows);
  const byWeek = salesByWeek(rows);
  const bestWeek = byWeek.slice().sort((a, b) => b[1] - a[1])[0];
  const last = byWeek[byWeek.length - 1];
  const prior = byWeek[byWeek.length - 2];
  const changePct = prior && prior[1] > 0 ? Math.round(((last[1] - prior[1]) / prior[1]) * 100) : null;

  root.innerHTML = `
    <a class="see-details-link" href="#/dashboard">${esc(t("backToDashboard"))}</a>
    <div class="detail-header"><h1>${esc(t("chartTrendTitle"))}</h1><span class="maturity-note">${esc(maturityLabel(weeks))}</span></div>
    ${byWeek.length < 3 ? `<p class="chart-meta">${esc(t("trendNeedsMoreData"))}</p>` : ""}

    ${App.weatherLocation ? `<label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;color:var(--muted);margin-bottom:10px;">
      <input type="checkbox" id="sunsetToggleDetail" ${App.showSunsetOnTrend ? "checked" : ""} />
      ${esc(t("trendSunsetToggle"))}
    </label>` : ""}
    <div class="card"><div class="chart-canvas-wrap tall"><canvas id="chart-trend-detail"></canvas></div></div>

    <div class="detail-section"><h2>${esc(t("detailWhatShows"))}</h2><p>${esc(t("trendWhatShows"))}</p></div>
    ${bestWeek ? `
    <div class="detail-section">
      <h2>${esc(t("detailWhatFound"))}</h2>
      <ul class="finding-list">
        <li>${esc(t("trendFinding1", { week: bestWeek[0], amount: formatMoney(bestWeek[1]) }))}</li>
        ${changePct !== null ? `<li>${esc(t("trendFinding2", { pct: changePct }))}</li>` : ""}
      </ul>
    </div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatTry"))}</h2>
      <ul class="try-list">
        <li>${esc(t("trendTry1"))}</li>
        <li>${esc(t("trendTry2"))}</li>
      </ul>
    </div>
    <div class="card">
      <table class="data-table">
        <thead><tr><th>${esc(t("trendColWeek"))}</th><th>${esc(t("trendColSales"))}</th><th>${esc(t("trendColChange"))}</th>
          ${App.showSunsetOnTrend && App.weatherLocation ? `<th>${esc(t("trendColSunset"))}</th>` : ""}
          <th>${esc(t("trendColNotes"))}</th></tr></thead>
        <tbody>
          ${byWeek.map((w, i) => {
            const prevVal = i > 0 ? byWeek[i - 1][1] : null;
            const change = prevVal && prevVal > 0 ? Math.round(((w[1] - prevVal) / prevVal) * 100) : null;
            const events = eventsInWeek(w[0]);
            let sunsetCell = "";
            if (App.showSunsetOnTrend && App.weatherLocation) {
              let sum = 0, count = 0;
              for (let d = 0; d < 7; d++) {
                const info = daylightFor(dateStrPlusDays(w[0], d), App.weatherLocation);
                if (info) { sum += info.sunsetMin; count++; }
              }
              sunsetCell = `<td>${count ? esc(formatClockMinutes(sum / count)) : "—"}</td>`;
            }
            return `<tr><td>${esc(w[0])}</td><td>${formatMoney(w[1])}</td><td>${change === null ? "—" : (change >= 0 ? "+" : "") + change + "%"}</td>${sunsetCell}<td>${esc(events.join("; "))}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : ""}
  `;
  renderLineChart("chart-trend-detail", byWeek.map((w) => w[0]), byWeek.map((w) => w[1]), Object.assign({
    xAxisLabel: t("axisWeek"), yAxisLabel: t("axisSales"),
  }, trendMarkerOpts(byWeek)));
  const trendDetailLegend = [{ color: COLORS.amber, label: t("trendLegendMarker") }];
  if (App.showSunsetOnTrend && App.weatherLocation) trendDetailLegend.push({ color: COLORS.slate, label: t("trendSunsetLegend") });
  attachChartLegend("chart-trend-detail", trendDetailLegend);
  const sunsetToggleDetail = document.getElementById("sunsetToggleDetail");
  if (sunsetToggleDetail) {
    sunsetToggleDetail.addEventListener("change", async (e) => {
      App.showSunsetOnTrend = e.target.checked;
      await DB.setSetting("showSunsetOnTrend", App.showSunsetOnTrend);
      App.renderTrendDetail();
    });
  }
};

// ---------- Detail: Order Types ----------
App.renderOrderTypesDetail = function () {
  const root = document.getElementById("view-root");
  const rows = getFilteredRows();
  const weeks = maturityWeeks(rows);
  const orderTypes = orderTypeSplit(rows).sort((a, b) => b.revenue - a.revenue);
  const total = orderTypes.reduce((s, x) => s + x.revenue, 0);
  const topType = orderTypes[0];
  const pct = topType && total > 0 ? Math.round((topType.revenue / total) * 100) : 0;

  root.innerHTML = `
    <a class="see-details-link" href="#/dashboard">${esc(t("backToDashboard"))}</a>
    <div class="detail-header"><h1>${esc(t("chartOrderTypeTitle"))}</h1><span class="maturity-note">${esc(maturityLabel(weeks))}</span></div>
    <div class="toggle-group" role="group" aria-label="${esc(t("chartTypeToggleLabel"))}">
      <button type="button" data-chart-type="doughnut" class="${App.orderTypesChartType === "doughnut" ? "active" : ""}">${esc(t("chartTypeDoughnut"))}</button>
      <button type="button" data-chart-type="bar" class="${App.orderTypesChartType === "bar" ? "active" : ""}">${esc(t("chartTypeBar"))}</button>
    </div>
    <div class="card"><div class="chart-canvas-wrap tall"><canvas id="chart-ordertype-detail"></canvas></div></div>
    <div class="detail-section"><h2>${esc(t("detailWhatShows"))}</h2><p>${esc(t("orderTypesWhatShows"))}</p></div>
    ${topType ? `
    <div class="detail-section">
      <h2>${esc(t("detailWhatFound"))}</h2>
      <ul class="finding-list"><li>${esc(t("orderTypesFinding1", { type: orderTypeLabel(topType.type), pct }))}</li></ul>
    </div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatTry"))}</h2>
      <ul class="try-list"><li>${esc(t("orderTypesTry1"))}</li></ul>
    </div>` : ""}
  `;
  if (App.orderTypesChartType === "bar") {
    renderBarChart("chart-ordertype-detail", orderTypes.map((x) => orderTypeLabel(x.type)), orderTypes.map((x) => x.revenue), {
      horizontal: true, xAxisLabel: t("axisSales"),
    });
  } else {
    renderDoughnutChart("chart-ordertype-detail", orderTypes.map((x) => orderTypeLabel(x.type)), orderTypes.map((x) => x.revenue));
  }
  root.querySelectorAll("[data-chart-type]").forEach((btn) => {
    btn.addEventListener("click", () => { App.orderTypesChartType = btn.dataset.chartType; App.renderOrderTypesDetail(); });
  });
};

// ---------- Detail: Heatmap ----------
App.renderHeatmapDetail = function () {
  const root = document.getElementById("view-root");
  const rows = getFilteredRows();
  const weeks = maturityWeeks(rows);
  const grid = heatmapData(rows);
  let bestDow = 0, bestHour = 0, bestVal = -1;
  grid.forEach((row, dow) => row.forEach((v, h) => { if (v > bestVal) { bestVal = v; bestDow = dow; bestHour = h; } }));

  root.innerHTML = `
    <a class="see-details-link" href="#/dashboard">${esc(t("backToDashboard"))}</a>
    <div class="detail-header"><h1>${esc(t("chartHeatmapTitle"))}</h1><span class="maturity-note">${esc(maturityLabel(weeks))}</span></div>
    <div class="card"><div class="heatmap-scroll" id="heatmap-detail"></div></div>
    <div class="detail-section"><h2>${esc(t("detailWhatShows"))}</h2><p>${esc(t("heatmapWhatShows"))}</p></div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatFound"))}</h2>
      <ul class="finding-list"><li>${esc(t("heatmapFinding1", { day: dayLong(bestDow), hour: formatHourLabel(bestHour), amount: formatMoney(bestVal) }))}</li></ul>
    </div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatTry"))}</h2>
      <ul class="try-list"><li>${esc(t("heatmapTry1"))}</li></ul>
    </div>
  `;
  renderHeatmap(document.getElementById("heatmap-detail"), grid, {
    dayLabels: Array.from({ length: 7 }, (_, i) => dayShort(i)),
    cellLabel: (dow, h, v) => t("heatmapCellLabel", { day: dayLong(dow), hour: formatHourLabel(h), amount: formatMoney(v) }),
    legendLessLabel: t("heatmapLegendLess"), legendMoreLabel: t("heatmapLegendMore"),
  });
};

// ---------- Day Notes page ----------
function computeDailyTotals(rows) {
  const map = new Map();
  rows.forEach((r) => { map.set(r.date, (map.get(r.date) || 0) + rowRevenue(r)); });
  return map;
}

App.renderNotes = function () {
  const root = document.getElementById("view-root");
  const dailyTotals = computeDailyTotals(App.allRows);
  const range = dateRangeOf(App.allRows);

  const dateSet = new Set();
  if (App.notesFilter === "all") dailyTotals.forEach((_, d) => dateSet.add(d));
  App.dayNotesMap.forEach((_, d) => dateSet.add(d));
  App.customHolidaysMap.forEach((_, d) => dateSet.add(d));
  if (range) App.holidaysMap.forEach((_, d) => { if (d >= range.min && d <= range.max) dateSet.add(d); });

  let dates = Array.from(dateSet).sort();
  if (App.notesFilter === "noted") {
    dates = dates.filter((d) => App.dayNotesMap.has(d) || App.holidaysMap.has(d) || App.customHolidaysMap.has(d));
  }

  const editing = App.editingNoteDate;
  const editingNote = editing ? (noteAt(editing) || { date: editing, text: "", tags: [] }) : null;

  root.innerHTML = `
    <h1>${esc(t("notesTitle"))}</h1>
    <p>${esc(t("notesIntro"))}</p>

    <div class="card">
      <h2>${esc(t("notesAddForDate"))}</h2>
      <form id="noteForm">
        <div class="match-field" style="max-width:220px;">
          <label for="noteDateInput">${esc(t("notesDateLabel"))}</label>
          <input type="date" id="noteDateInput" value="${esc(editing || "")}" />
        </div>
        <div class="match-field">
          <label for="noteText">${esc(t("notesTextLabel"))}</label>
          <input type="text" id="noteText" value="${esc(editingNote ? editingNote.text : "")}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);" />
        </div>
        <div class="match-field">
          <label>${esc(t("notesTagsLabel"))}</label>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px;">
            ${KNOWN_NOTE_TAGS.map((tag) => `
              <label style="display:flex;align-items:center;gap:6px;font-weight:400;">
                <input type="checkbox" class="noteTagCheckbox" value="${tag}" ${editingNote && editingNote.tags && editingNote.tags.includes(tag) ? "checked" : ""} />
                ${esc(t("notesTag" + tag.charAt(0).toUpperCase() + tag.slice(1)))}
              </label>
            `).join("")}
          </div>
          <input type="text" id="noteOtherTag" placeholder="${esc(t("notesTagOtherPlaceholder"))}"
            value="${esc(editingNote ? (editingNote.tags || []).find((tg) => !KNOWN_NOTE_TAGS.includes(tg)) || "" : "")}"
            style="margin-top:8px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);" />
        </div>
        <div class="match-field" id="promoFieldsWrap" ${editingNote && editingNote.tags && editingNote.tags.includes("promo") ? "" : "hidden"}>
          <p class="match-note">${esc(t("notesPromoExplain"))}</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <div>
              <label for="notePromoEndDate">${esc(t("notesPromoEndDate"))}</label>
              <input type="date" id="notePromoEndDate" value="${esc(editingNote && editingNote.endDate ? editingNote.endDate : "")}" />
            </div>
            <div>
              <label for="notePromoChannel">${esc(t("notesPromoChannel"))}</label>
              <select id="notePromoChannel">
                ${PROMO_CHANNELS.map((c) => `<option value="${c}" ${editingNote && editingNote.channel === c ? "selected" : ""}>${esc(t("notesPromoChannel" + c.charAt(0).toUpperCase() + c.slice(1)))}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>
        <div class="data-actions">
          <button type="submit" class="btn btn-primary">${esc(t("notesSave"))}</button>
          ${editing ? `<button type="button" class="btn btn-ghost" id="noteCancelBtn">${esc(t("notesCancel"))}</button>` : ""}
        </div>
      </form>
    </div>

    <div class="card" style="margin-top:20px;">
      <h2>${esc(t("customHolidaysTitle"))}</h2>
      <p class="match-note">${esc(t("customHolidaysIntro"))}</p>
      <form id="customHolidayForm" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:10px;">
        <div class="match-field" style="max-width:180px;">
          <label for="customHolidayDate">${esc(t("notesDateLabel"))}</label>
          <input type="date" id="customHolidayDate" required />
        </div>
        <div class="match-field" style="flex:1;min-width:180px;">
          <label for="customHolidayName">${esc(t("customHolidayNameLabel"))}</label>
          <input type="text" id="customHolidayName" placeholder="${esc(t("customHolidayNamePlaceholder"))}" required
            style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);" />
        </div>
        <button type="submit" class="btn btn-primary">${esc(t("customHolidayAdd"))}</button>
      </form>

      <div class="data-actions" style="margin-top:14px;">
        <button type="button" class="btn btn-secondary" id="importHolidaysBtn">${esc(t("customHolidayImport"))}</button>
        <input type="file" accept=".csv,text/csv" id="importHolidaysInput" class="visually-hidden" />
        <button type="button" class="btn btn-ghost" id="downloadHolidayTemplateBtn">${esc(t("customHolidayTemplate"))}</button>
      </div>

      ${App.customHolidaysMap.size ? `
      <table class="data-table" style="margin-top:16px;">
        <thead><tr><th>${esc(t("notesColDate"))}</th><th>${esc(t("customHolidayNameLabel"))}</th><th></th></tr></thead>
        <tbody>
          ${Array.from(App.customHolidaysMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1)).map((h) => `
            <tr>
              <td>${esc(h.date)}</td><td>${esc(h.name)}</td>
              <td><button type="button" class="btn btn-ghost customHolidayDeleteBtn" data-date="${esc(h.date)}" style="padding:6px 10px;">${esc(t("notesDelete"))}</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>` : ""}
    </div>

    <div class="toggle-group" role="group" style="margin-top:20px;">
      <button type="button" data-filter="all" class="${App.notesFilter === "all" ? "active" : ""}">${esc(t("notesShowAllDays"))}</button>
      <button type="button" data-filter="noted" class="${App.notesFilter === "noted" ? "active" : ""}">${esc(t("notesShowNotedOnly"))}</button>
    </div>

    <div class="card">
      ${dates.length ? `
      <table class="data-table">
        <thead><tr>
          <th>${esc(t("notesColDate"))}</th><th>${esc(t("notesColDay"))}</th><th>${esc(t("notesColSales"))}</th>
          <th>${esc(t("notesColHoliday"))}</th><th>${esc(t("notesColNote"))}</th><th></th>
        </tr></thead>
        <tbody>
          ${dates.map((d) => {
            const sales = dailyTotals.has(d) ? formatMoney(dailyTotals.get(d)) : "—";
            const h = holidayAt(d);
            const n = noteAt(d);
            const dow = dayShort(rowDayOfWeek({ date: d }));
            let noteText = n ? [n.text, ...(n.tags || []).map(tagLabel)].filter(Boolean).join(" — ") : "";
            if (n && n.tags && n.tags.includes("promo")) {
              const channelLabel = t("notesPromoChannel" + n.channel.charAt(0).toUpperCase() + n.channel.slice(1));
              noteText += ` (${n.date} – ${n.endDate}, ${channelLabel})`;
            }
            return `<tr>
              <td>${esc(d)}</td><td>${esc(dow)}</td><td>${esc(sales)}</td>
              <td>${h ? esc(h.name) : ""}</td>
              <td>${esc(noteText)}</td>
              <td style="white-space:nowrap;">
                <button type="button" class="btn btn-ghost noteEditBtn" data-date="${esc(d)}" style="padding:6px 10px;">${esc(n ? t("notesEdit") : t("notesAddAction"))}</button>
                ${n ? `<button type="button" class="btn btn-ghost noteDeleteBtn" data-date="${esc(d)}" style="padding:6px 10px;">${esc(t("notesDelete"))}</button>` : ""}
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>` : `<p>${esc(t("notesNone"))}</p>`}
    </div>
  `;

  root.querySelectorAll(".toggle-group button").forEach((btn) => {
    btn.addEventListener("click", () => { App.notesFilter = btn.dataset.filter; App.renderNotes(); });
  });

  root.querySelectorAll(".noteEditBtn").forEach((btn) => {
    btn.addEventListener("click", () => { App.editingNoteDate = btn.dataset.date; App.renderNotes(); });
  });
  root.querySelectorAll(".noteDeleteBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const date = btn.dataset.date;
      showModal({
        title: t("notesDeleteConfirmTitle"),
        body: t("notesDeleteConfirmBody"),
        confirmLabel: t("notesDelete"),
        cancelLabel: t("notesCancel"),
        danger: true,
        onConfirm: async () => {
          await DB.deleteDayNote(date);
          await refreshDayNotes();
          if (App.editingNoteDate === date) App.editingNoteDate = null;
          App.renderNotes();
        },
      });
    });
  });
  const cancelBtn = document.getElementById("noteCancelBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", () => { App.editingNoteDate = null; App.renderNotes(); });

  const promoCheckbox = document.querySelector('.noteTagCheckbox[value="promo"]');
  const promoWrap = document.getElementById("promoFieldsWrap");
  if (promoCheckbox && promoWrap) {
    promoCheckbox.addEventListener("change", () => { promoWrap.hidden = !promoCheckbox.checked; });
  }

  document.getElementById("noteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = document.getElementById("noteDateInput").value;
    if (!date) return;
    const text = document.getElementById("noteText").value.trim();
    const tags = Array.from(document.querySelectorAll(".noteTagCheckbox:checked")).map((cb) => cb.value);
    const otherTag = document.getElementById("noteOtherTag").value.trim();
    if (otherTag) tags.push(otherTag);
    const note = { date, text, tags };
    // A marketing/promo note can cover a date range and names a channel, so
    // it's ready to plug into a before/after tracker down the road -- it
    // just isn't built as a comparison tool yet, only stored and displayed.
    if (tags.includes("promo")) {
      const endDate = document.getElementById("notePromoEndDate").value;
      note.endDate = endDate || date;
      note.channel = document.getElementById("notePromoChannel").value;
    }
    await DB.setDayNote(note);
    await refreshDayNotes();
    App.editingNoteDate = null;
    App.renderNotes();
  });

  // ---- Custom holidays: manual add, CSV import, template, delete ----
  document.getElementById("customHolidayForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = document.getElementById("customHolidayDate").value;
    const name = document.getElementById("customHolidayName").value.trim();
    if (!date || !name) return;
    await DB.setCustomHoliday({ date, name });
    await refreshCustomHolidays();
    App.renderNotes();
  });

  root.querySelectorAll(".customHolidayDeleteBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const date = btn.dataset.date;
      showModal({
        title: t("notesDeleteConfirmTitle"),
        body: t("notesDeleteConfirmBody"),
        confirmLabel: t("notesDelete"),
        cancelLabel: t("notesCancel"),
        danger: true,
        onConfirm: async () => {
          await DB.deleteCustomHoliday(date);
          await refreshCustomHolidays();
          App.renderNotes();
        },
      });
    });
  });

  document.getElementById("downloadHolidayTemplateBtn").addEventListener("click", () => {
    const csv = "date,name\n2026-02-17,Chinese New Year\n2026-11-01,Diwali\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holiday-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  document.getElementById("importHolidaysBtn").addEventListener("click", () => {
    document.getElementById("importHolidaysInput").click();
  });
  document.getElementById("importHolidaysInput").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data || [];
        const fields = (results.meta && results.meta.fields) || [];
        const dateField = fields.find((f) => /date/i.test(f)) || fields[0];
        const nameField = fields.find((f) => /name|holiday|label/i.test(f)) || fields[1];
        const holidays = [];
        rows.forEach((r) => {
          const { date } = parseDateString(r[dateField]);
          const name = (r[nameField] || "").trim();
          if (date && name) holidays.push({ date, name });
        });
        if (!holidays.length) {
          showError(t("customHolidayImportError"));
          return;
        }
        await DB.setCustomHolidays(holidays);
        await refreshCustomHolidays();
        showMergeBanner(t("customHolidayImportSuccess", { count: holidays.length }));
        App.renderNotes();
      },
      error: () => showError(t("customHolidayImportError")),
    });
  });
};

// ---------- Ask a Question (rule-based, no AI, no network) ----------
const ASK_MAX_LENGTH = 300;

App.renderAsk = function () {
  const root = document.getElementById("view-root");
  const starters = [t("askStarter1"), t("askStarter2"), t("askStarter3"), t("askStarter4")];

  root.innerHTML = `
    <h1>${esc(t("askTitle"))}</h1>
    <p>${esc(t("askIntro"))}</p>

    <div class="card">
      <p style="font-weight:600;margin-bottom:8px;">${esc(t("askStarterTitle"))}</p>
      <div class="upload-secondary" style="justify-content:flex-start;">
        ${starters.map((s, i) => `<button type="button" class="btn btn-secondary askStarterBtn" data-q="${esc(s)}">${esc(s)}</button>`).join("")}
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div id="askHistoryList">
        ${App.askHistory.length ? App.askHistory.map((h) => `
          <div class="ask-turn">
            <div class="ask-question"><strong>${esc(t("askYouAsked"))}:</strong> ${esc(h.question)}</div>
            <div class="ask-answer">${esc(h.answer)}</div>
          </div>
        `).join("") : `<p class="match-note" id="askHistoryEmpty">${esc(t("askHistoryEmpty"))}</p>`}
      </div>

      <form id="askForm" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
        <label class="visually-hidden" for="askInput">${esc(t("askInputLabel"))}</label>
        <input type="text" id="askInput" placeholder="${esc(t("askPlaceholder"))}" maxlength="${ASK_MAX_LENGTH}"
          style="flex:1;min-width:200px;padding:10px;border-radius:8px;border:1px solid var(--border);" />
        <button type="submit" class="btn btn-primary">${esc(t("askSubmit"))}</button>
      </form>
    </div>
  `;

  function submitQuestion(question) {
    const q = question.trim();
    if (!q) return;
    if (q.length > ASK_MAX_LENGTH) {
      showError(t("askTooLong"));
      return;
    }
    clearError();
    const answer = answerQuestion(q, getFilteredRows()) || t("qaError");
    App.askHistory.push({ question: q, answer });
    App.renderAsk();
    // Scroll the newest turn into view.
    const list = document.getElementById("askHistoryList");
    if (list) list.scrollTop = list.scrollHeight;
  }

  root.querySelectorAll(".askStarterBtn").forEach((btn) => {
    btn.addEventListener("click", () => submitQuestion(btn.dataset.q));
  });

  document.getElementById("askForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("askInput");
    submitQuestion(input.value);
    input.value = "";
  });
};

// ---------- Returning Customers (privacy-sensitive: hashed IDs only) ----------
// "2026-08" reads unambiguously in both languages without needing 12 more
// translated month names just for this one chart's axis labels.
function monthLabel(dateStr) {
  return dateStr;
}

// The "Customer Growth Report" section: an optional, separate data source
// from the hashed per-transaction analysis below it. Some registers can
// only export an already-aggregated monthly new/returning count, not a
// per-order file with a customer identifier -- that's a genuinely different
// shape of data (see js/customer-summary.js), so it gets its own card and
// its own chart rather than being forced into the hashed repeat-rate math.
function renderCustomerSummaryCard() {
  const summaryRows = (App.customerSummaryRows || []).slice().sort((a, b) => a.month.localeCompare(b.month));
  const totalNew = summaryRows.reduce((s, r) => s + r.newCount, 0);
  const totalReturning = summaryRows.reduce((s, r) => s + r.returningCount, 0);
  const returningShare = (totalNew + totalReturning) > 0 ? Math.round((totalReturning / (totalNew + totalReturning)) * 100) : null;

  return `
    <div class="card" style="margin-top:20px;">
      <h2>${esc(t("customersSummaryTitle"))}</h2>
      <p class="match-note">${esc(t("customersSummaryBody"))}</p>
      <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" id="customerSummaryInput" class="visually-hidden" />
      <button type="button" class="btn btn-secondary" id="customerSummaryImportBtn">${esc(t("customersSummaryImportBtn"))}</button>
      ${summaryRows.length ? `
        <div style="margin-top:18px;">
          <div class="chart-meta">${esc(t("customersSummaryBasedOn", { count: summaryRows.length }))}</div>
          <div class="chart-canvas-wrap"><canvas id="chart-customers-summary"></canvas></div>
        </div>
        <div class="stat-grid" style="margin-top:16px; grid-template-columns: repeat(3, 1fr);">
          <div class="card stat-card"><div class="stat-label">${esc(t("customersSummaryTotalNew"))}</div><div class="stat-value">${totalNew.toLocaleString()}</div></div>
          <div class="card stat-card"><div class="stat-label">${esc(t("customersSummaryTotalReturning"))}</div><div class="stat-value">${totalReturning.toLocaleString()}</div></div>
          <div class="card stat-card"><div class="stat-label">${esc(t("customersSummaryReturningShare"))}</div><div class="stat-value">${returningShare === null ? "—" : returningShare + "%"}</div></div>
        </div>
        <button type="button" class="btn btn-ghost" id="clearCustomerSummaryBtn" style="margin-top:14px;">${esc(t("customersSummaryClear"))}</button>
      ` : ""}
    </div>`;
}

function drawCustomerSummaryChart() {
  const canvas = document.getElementById("chart-customers-summary");
  if (!canvas) return;
  const summaryRows = (App.customerSummaryRows || []).slice().sort((a, b) => a.month.localeCompare(b.month));
  renderStackedBarChart("chart-customers-summary", summaryRows.map((r) => monthLabel(r.month)),
    [
      { label: t("customersNew"), data: summaryRows.map((r) => r.newCount), color: COLORS.green },
      { label: t("customersReturning"), data: summaryRows.map((r) => r.returningCount), color: COLORS.amber },
    ],
    { xAxisLabel: t("axisMonth"), yAxisLabel: t("customersCountAxis") }
  );
}

App.renderCustomers = function () {
  const root = document.getElementById("view-root");
  const rows = App.allRows; // uses all saved history, not just the range selector, since repeat behavior spans your whole dataset
  const hasAnyHash = rows.some((r) => r.customerHash);
  const summaryCard = renderCustomerSummaryCard();

  const privacyCard = `
    <div class="card">
      <h2>${esc(t("customersPrivacyTitle"))}</h2>
      <p class="match-note">${esc(t("customersPrivacyBody"))}</p>
      <p class="match-note">${App.customerIdColumnName
        ? esc(t("customersDetectedColumn", { column: App.customerIdColumnName }))
        : esc(t("customersNoColumnEver"))}</p>
      <button type="button" class="btn btn-ghost" id="regenerateSaltBtn">${esc(t("customersRegenerateSalt"))}</button>
    </div>`;

  if (!hasAnyHash) {
    root.innerHTML = `
      <h1>${esc(t("customersTitle"))}</h1>
      ${summaryCard}
      ${privacyCard}
      <div class="card" style="margin-top:20px;">
        <p>${esc(t("customersNoColumnFound"))}</p>
      </div>
    `;
    drawCustomerSummaryChart();
    wireCustomersPage();
    return;
  }

  const visits = computeCustomerVisits(rows);
  const range = dateRangeOf(rows);

  if (visits.size < CUSTOMER_MIN_COUNT) {
    root.innerHTML = `
      <h1>${esc(t("customersTitle"))}</h1>
      ${summaryCard}
      ${privacyCard}
      <div class="card" style="margin-top:20px;">
        <p>${esc(t("customersThinData", { count: visits.size, min: CUSTOMER_MIN_COUNT }))}</p>
      </div>
    `;
    drawCustomerSummaryChart();
    wireCustomersPage();
    return;
  }

  const maxDate = range.max;
  const rr30 = computeRepeatRate(visits, maxDate, 30);
  const rr60 = computeRepeatRate(visits, maxDate, 60);
  const rr90 = computeRepeatRate(visits, maxDate, 90);
  const visitStats = computeVisitStats(visits);
  const winBack = computeWinBackCount(visits, maxDate, 60);
  const byMonth = newVsReturningByPeriod(visits, (d) => d.slice(0, 7));
  const monthKeys = Array.from(byMonth.keys()).sort();

  root.innerHTML = `
    <h1>${esc(t("customersTitle"))}</h1>
    <p>${esc(t("customersIntro"))}</p>
    ${summaryCard}
    ${privacyCard}

    <div class="card" style="margin-top:20px;">
      <h2>${esc(t("customersChartTitle"))}</h2>
      <div class="chart-meta">${esc(t("customersBasedOn", { count: visits.size }))}</div>
      <div class="chart-canvas-wrap"><canvas id="chart-customers-newvreturning"></canvas></div>
    </div>

    <div class="stat-grid" style="margin-top:20px;">
      <div class="card stat-card">
        <div class="stat-label">${esc(t("customersRepeatRate30"))}</div>
        <div class="stat-value">${rr30.pct === null ? "—" : rr30.pct + "%"}</div>
        <p class="match-note">${esc(t("customersRepeatRateNote", { eligible: rr30.eligible }))}</p>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${esc(t("customersRepeatRate60"))}</div>
        <div class="stat-value">${rr60.pct === null ? "—" : rr60.pct + "%"}</div>
        <p class="match-note">${esc(t("customersRepeatRateNote", { eligible: rr60.eligible }))}</p>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${esc(t("customersRepeatRate90"))}</div>
        <div class="stat-value">${rr90.pct === null ? "—" : rr90.pct + "%"}</div>
        <p class="match-note">${esc(t("customersRepeatRateNote", { eligible: rr90.eligible }))}</p>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${esc(t("customersWinBack"))}</div>
        <div class="stat-value">${winBack.toLocaleString()}</div>
        <p class="match-note">${esc(t("customersWinBackNote"))}</p>
      </div>
    </div>

    <div class="stat-grid" style="margin-top:16px; grid-template-columns: repeat(2, 1fr);">
      <div class="card stat-card">
        <div class="stat-label">${esc(t("customersAvgVisits"))}</div>
        <div class="stat-value">${visitStats.avgVisitsPerRepeat === null ? "—" : visitStats.avgVisitsPerRepeat.toFixed(1)}</div>
        <p class="match-note">${esc(t("customersAvgVisitsNote", { count: visitStats.repeatCustomers }))}</p>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${esc(t("customersAvgGap"))}</div>
        <div class="stat-value">${visitStats.avgGapDays === null ? "—" : Math.round(visitStats.avgGapDays) + " " + t("customersDays")}</div>
        <p class="match-note">${esc(t("customersAvgGapNote"))}</p>
      </div>
    </div>

    <p class="insights-disclaimer">${esc(t("customersDisclaimer"))}</p>
  `;

  renderStackedBarChart("chart-customers-newvreturning", monthKeys.map(monthLabel),
    [
      { label: t("customersNew"), data: monthKeys.map((k) => byMonth.get(k).newCount), color: COLORS.green },
      { label: t("customersReturning"), data: monthKeys.map((k) => byMonth.get(k).returningCount), color: COLORS.amber },
    ],
    { xAxisLabel: t("axisMonth"), yAxisLabel: t("customersCountAxis") }
  );
  drawCustomerSummaryChart();

  wireCustomersPage();
};

// Parses a monthly new/returning customer report (already-aggregated, no
// per-customer identifier, so no hashing involved) and saves it to its own
// store, upserted by month. Accepts CSV/TSV/Excel like the main upload.
function handleCustomerSummaryFile(file) {
  const ext = fileExt(file.name);
  const onRows = async (dataRows) => {
    if (!dataRows || !dataRows.length) { showError(t("errorEmpty")); return; }
    const headers = Object.keys(dataRows[0]);
    const guesses = guessCustomerSummaryColumns(headers);
    if (!guesses.month || (!guesses.newCustomers && !guesses.returningCustomers)) {
      showError(t("customersSummaryImportError"));
      return;
    }
    const { rows } = buildCustomerSummaryRows(dataRows, guesses);
    if (!rows.length) { showError(t("customersSummaryImportError")); return; }
    await DB.putCustomerSummaryRows(rows);
    App.customerSummaryRows = await DB.getAllCustomerSummary();
    clearError();
    showMergeBanner(t("customersSummaryImportSuccess", { count: rows.length }));
    App.renderCustomers();
  };
  if (EXCEL_EXTENSIONS.includes(ext)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        onRows(XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }));
      } catch (err) { showError(t("errorParse")); }
    };
    reader.onerror = () => showError(t("errorParse"));
    reader.readAsArrayBuffer(file);
  } else {
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => onRows(results.data), error: () => showError(t("errorParse")) });
  }
}

function wireCustomersPage() {
  const btn = document.getElementById("regenerateSaltBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      showModal({
        title: t("customersRegenerateSaltConfirmTitle"),
        body: t("customersRegenerateSaltConfirmBody"),
        confirmLabel: t("customersRegenerateSalt"),
        cancelLabel: t("notesCancel"),
        danger: true,
        onConfirm: async () => {
          const bytes = crypto.getRandomValues(new Uint8Array(16));
          const salt = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
          await DB.setSetting("customerHashSalt", salt);
          App.renderCustomers();
        },
      });
    });
  }

  const importBtn = document.getElementById("customerSummaryImportBtn");
  const importInput = document.getElementById("customerSummaryInput");
  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) handleCustomerSummaryFile(e.target.files[0]);
    });
  }
  const clearBtn = document.getElementById("clearCustomerSummaryBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      showModal({
        title: t("customersSummaryClearConfirmTitle"),
        body: t("customersSummaryClearConfirmBody"),
        confirmLabel: t("customersSummaryClear"),
        cancelLabel: t("notesCancel"),
        danger: true,
        onConfirm: async () => {
          await DB.clearCustomerSummary();
          App.customerSummaryRows = [];
          App.renderCustomers();
        },
      });
    });
  }
}

// ---------- Grow Your Business ----------
// Maps each tip id from js/business-tips.js to the translation keys used to
// render it. Kept as one table so adding a new tip only means adding a rule
// in business-tips.js plus one row here plus the translations themselves.
const BUSINESS_TIP_CONTENT = {
  loyaltyProgram: { headline: "tipLoyaltyProgramHeadline", why: "tipLoyaltyProgramWhy", action: "tipLoyaltyProgramAction" },
  strongRepeat: { headline: "tipStrongRepeatHeadline", why: "tipStrongRepeatWhy", action: "tipStrongRepeatAction" },
  deliveryGap: { headline: "tipDeliveryGapHeadline", why: "tipDeliveryGapWhy", action: "tipDeliveryGapAction" },
  menuConcentrationRisk: { headline: "tipMenuConcentrationHeadline", why: "tipMenuConcentrationWhy", action: "tipMenuConcentrationAction" },
  manyRareItems: { headline: "tipManyRareItemsHeadline", why: "tipManyRareItemsWhy", action: "tipManyRareItemsAction" },
  weekdayWeekendGap: { headline: "tipWeekdayGapHeadline", why: "tipWeekdayGapWhy", action: "tipWeekdayGapAction" },
  weatherSensitive: { headline: "tipWeatherSensitiveHeadline", why: "tipWeatherSensitiveWhy", action: "tipWeatherSensitiveAction" },
  daylightSensitive: { headline: "tipDaylightSensitiveHeadline", why: "tipDaylightSensitiveWhy", action: "tipDaylightSensitiveAction" },
  holidayPlanning: { headline: "tipHolidayPlanningHeadline", why: "tipHolidayPlanningWhy", action: "tipHolidayPlanningAction" },
  noPromosLogged: { headline: "tipNoPromosHeadline", why: "tipNoPromosWhy", action: "tipNoPromosAction" },
  barHappyHour: { headline: "tipBarHappyHourHeadline", why: "tipBarHappyHourWhy", action: "tipBarHappyHourAction" },
  bakeryPerishables: { headline: "tipBakeryPerishablesHeadline", why: "tipBakeryPerishablesWhy", action: "tipBakeryPerishablesAction" },
};

const MENU_QUADRANT_LABEL_KEYS = { star: "quadrantStar", plowhorse: "quadrantPlowhorse", puzzle: "quadrantPuzzle", dog: "quadrantDog" };
const MENU_QUADRANT_ORDER = ["star", "plowhorse", "puzzle", "dog"];

App.renderGrow = function () {
  const root = document.getElementById("view-root");
  const rows = App.allRows;
  const summary = computeSummary(rows);
  const weeks = maturityWeeks(rows);

  const businessType = detectBusinessType(rows);

  // Build the small context object business-tips.js's rules read. Reuses
  // stats this app already computes elsewhere rather than recalculating a
  // second definition of "delivery share" or "weather sensitivity."
  const { totals: dowTotals, averages: dowAverages, dayCounts } = salesByDow(rows);
  let bestIdx = 0, worstIdx = 0;
  dowAverages.forEach((v, i) => { if (v > dowAverages[bestIdx]) bestIdx = i; if (v < dowAverages[worstIdx]) worstIdx = i; });
  const dowGapPct = (bestIdx !== worstIdx && dowAverages[worstIdx] > 0)
    ? ((dowAverages[bestIdx] - dowAverages[worstIdx]) / dowAverages[worstIdx]) * 100 : null;

  const typeSplit = orderTypeSplit(rows);
  const hasOrderTypeData = typeSplit.length > 0;
  const totalTypeRevenue = typeSplit.reduce((s, x) => s + x.revenue, 0);
  const deliveryRevenue = typeSplit.find((x) => (x.type || "").toLowerCase() === "delivery");
  const deliveryPct = hasOrderTypeData && totalTypeRevenue > 0 ? ((deliveryRevenue ? deliveryRevenue.revenue : 0) / totalTypeRevenue) * 100 : null;

  const { top, all, rare } = topItems(rows, 1);
  const topItemPct = summary.totalSales > 0 && top.length ? (top[0].revenue / summary.totalSales) * 100 : null;
  const distinctItemCount = all.length;
  const rareItemRatio = distinctItemCount > 0 ? rare.length / distinctItemCount : null;

  let hasPromoNotes = false;
  App.dayNotesMap.forEach((n) => { if (n.tags && n.tags.includes("promo")) hasPromoNotes = true; });

  const visits = computeCustomerVisits(rows);
  const hasCustomerData = visits.size >= CUSTOMER_MIN_COUNT;
  const range = dateRangeOf(rows);
  const repeatRate30 = hasCustomerData && range ? computeRepeatRate(visits, range.max, 30).pct : null;

  const insightTypes = new Set(generateInsights(rows).map((i) => i.type));

  const ctx = {
    businessType, weeks, hasCustomerData, repeatRate30,
    hasOrderTypeData, deliveryPct, topItemPct, distinctItemCount, rareItemRatio, dowGapPct,
    hasWeatherInsight: insightTypes.has("weather"),
    hasDaylightInsight: insightTypes.has("daylight"),
    hasHolidayInsight: insightTypes.has("holidayImpact"),
    hasPromoNotes,
  };

  const tips = generateBusinessTips(ctx);
  const menuEngineering = computeMenuEngineering(rows);

  root.innerHTML = `
    <h1>${esc(t("growTitle"))}</h1>
    <p>${esc(t("growIntro"))}</p>

    <div class="card">
      <h2>${esc(t("growBusinessTypeTitle"))}</h2>
      <p>${esc(t("growBusinessTypeBody", { type: t("businessType" + businessType.charAt(0).toUpperCase() + businessType.slice(1)) }))}</p>
    </div>

    ${menuEngineering ? `
    <div class="card" style="margin-top:20px;">
      <h2>${esc(t("growMenuEngTitle"))}</h2>
      <p>${esc(t("growMenuEngIntro"))}</p>
      <p class="match-note">${esc(t("growMenuEngCaveat"))}</p>
      <div class="menu-eng-grid">
        ${MENU_QUADRANT_ORDER.map((q) => {
          const itemsInQuadrant = menuEngineering.items.filter((x) => x.quadrant === q);
          return `
          <div class="menu-eng-quadrant menu-eng-${q}">
            <h3>${esc(t(MENU_QUADRANT_LABEL_KEYS[q]))}</h3>
            <p class="match-note">${esc(t(MENU_QUADRANT_LABEL_KEYS[q] + "Desc"))}</p>
            ${itemsInQuadrant.length ? `<ul class="menu-eng-item-list">${itemsInQuadrant.slice(0, 6).map((x) => `<li>${esc(x.item)} <span class="match-note">(${x.quantity}, ${formatMoney2(x.avgPrice)})</span></li>`).join("")}${itemsInQuadrant.length > 6 ? `<li class="match-note">${esc(t("growMenuEngMore", { count: itemsInQuadrant.length - 6 }))}</li>` : ""}</ul>` : `<p class="match-note">${esc(t("growMenuEngEmpty"))}</p>`}
          </div>`;
        }).join("")}
      </div>
    </div>` : `<div class="card" style="margin-top:20px;"><p>${esc(t("growMenuEngThinData"))}</p></div>`}

    <div class="card" style="margin-top:20px;">
      <h2>${esc(t("growTipsTitle"))}</h2>
      ${tips.length ? `<div id="growTipsList"></div>` : `<p>${esc(t("growNoTips"))}</p>`}
    </div>

    <p class="insights-disclaimer">${esc(t("growDisclaimer"))}</p>
  `;

  if (tips.length) {
    const insightShaped = tips.map((tip) => {
      const content = BUSINESS_TIP_CONTENT[tip.id];
      return {
        headline: t(content.headline, tip.vars),
        action: t(content.action, tip.vars),
        why: t(content.why, tip.vars),
      };
    });
    renderInsightCardsInto("growTipsList", insightShaped);
  }
};

// Same expandable-card renderer as the dashboard's insights, but targeting
// an arbitrary container id so the Grow page's tips can reuse it without
// competing with the dashboard's own #insightsList.
function renderInsightCardsInto(containerId, insights) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = insights.map((ins, i) => `
    <div class="insight-card">
      <button type="button" class="insight-toggle" id="${containerId}-toggle-${i}" aria-expanded="false" aria-controls="${containerId}-detail-${i}">
        <span class="insight-icon" aria-hidden="true"></span>
        <span class="insight-headline-wrap">
          <span class="insight-headline">${esc(ins.headline)}</span>
          <span class="insight-action">${esc(ins.action)}</span>
        </span>
        <span class="insight-caret" aria-hidden="true">▾</span>
      </button>
      <div class="insight-detail" id="${containerId}-detail-${i}" hidden>
        ${ins.why ? `<p class="insight-why">${esc(ins.why)}</p>` : ""}
      </div>
    </div>
  `).join("");

  insights.forEach((ins, i) => {
    const btn = document.getElementById(`${containerId}-toggle-${i}`);
    const detail = document.getElementById(`${containerId}-detail-${i}`);
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      detail.hidden = expanded;
    });
  });
}

// ---------- Data page ----------
App.renderData = function () {
  const root = document.getElementById("view-root");
  const rows = App.allRows;
  const range = dateRangeOf(rows);
  const gaps = findGaps(rows, 1);

  root.innerHTML = `
    <h1>${esc(t("dataTitle"))}</h1>
    <div class="data-stat-row">
      <div class="card stat-card"><div class="stat-label">${esc(t("dataTotalRows"))}</div><div class="stat-value" id="dataTotalRows">…</div></div>
      <div class="card stat-card"><div class="stat-label">${esc(t("dataDateRange"))}</div><div class="stat-value" id="dataDateRange" style="font-size:1.1rem;">…</div></div>
      <div class="card stat-card"><div class="stat-label">${esc(t("dataLastUpload"))}</div><div class="stat-value" id="dataLastUpload" style="font-size:1.1rem;">…</div></div>
    </div>

    <div class="card">
      <h2>${esc(t("dataGapsTitle"))}</h2>
      ${gaps.length ? `<ul class="gap-list">${gaps.map((g) => `<li>${esc(t("dataGapItem", { start: g.start, end: g.end }))}</li>`).join("")}</ul>` : `<p>${esc(t("dataNoGaps"))}</p>`}
    </div>

    <div class="card" style="margin-top:20px;">
      <h2>${esc(t("settingsTitle"))}</h2>
      <label style="display:flex;align-items:flex-start;gap:10px;font-weight:600;">
        <input type="checkbox" id="ignoreHolidaysToggle" ${App.ignoreHolidays ? "checked" : ""} style="margin-top:3px;" />
        <span>${esc(t("settingIgnoreHolidays"))}</span>
      </label>
      <p class="match-note">${esc(t("settingIgnoreHolidaysExplain"))}</p>
    </div>

    <div class="card" style="margin-top:20px;">
      <h2>${esc(t("settingOutsideDataTitle"))}</h2>
      <p class="match-note">${esc(t("settingLocationSharedNote"))}</p>
      <div id="weatherLocationSection">${renderWeatherLocationSection()}</div>
      <label style="display:flex;align-items:flex-start;gap:10px;font-weight:600;margin-top:16px;">
        <input type="checkbox" id="weatherEnabledToggle" ${App.weatherEnabled ? "checked" : ""} style="margin-top:3px;" />
        <span>${esc(t("settingOutsideDataToggle"))}</span>
      </label>
      <p class="match-note">${esc(t("settingOutsideDataExplain"))}</p>
      ${App.weatherLastError ? `<p class="match-note" style="color:#b3401f;">${esc(App.weatherLastError)}</p>` : ""}
      <p class="match-note">${esc(t("weatherAttribution"))} <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a></p>
    </div>

    <div class="card" id="squareCard" style="margin-top:20px;" hidden></div>
    <div class="card" id="accountCard" style="margin-top:20px;" hidden></div>

    <div class="card" style="margin-top:20px;">
      <h2>${esc(t("addMoreData"))}</h2>
      <div class="dropzone" id="dropzoneData">
        <p><strong>${esc(t("uploadDrop"))}</strong></p>
        <p>${esc(t("uploadOr"))}</p>
        <div class="upload-actions">
          <button type="button" class="btn btn-primary" id="chooseFileBtn">${esc(t("uploadChoose"))}</button>
          <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" id="fileInput" class="visually-hidden" />
        </div>
      </div>
      <div class="upload-secondary">
        <button type="button" class="btn btn-secondary" id="sampleBtn">${esc(t("uploadSample"))}</button>
        <button type="button" class="btn btn-secondary" id="sample2Btn">${esc(t("uploadSample2"))}</button>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="data-actions">
        <button type="button" class="btn btn-secondary" id="exportBackupBtn">${esc(t("dataExport"))}</button>
        <button type="button" class="btn btn-secondary" id="importBackupBtn">${esc(t("dataImport"))}</button>
        <input type="file" accept="application/json,.json" id="importInput" class="visually-hidden" />
        <button type="button" class="btn btn-danger" id="deleteAllBtn">${esc(t("dataDeleteAll"))}</button>
      </div>
    </div>
  `;

  document.getElementById("dataTotalRows").textContent = rows.length.toLocaleString();
  document.getElementById("dataDateRange").textContent = range ? `${range.min} – ${range.max}` : "—";
  DB.getSetting("lastUpload").then((ts) => {
    // The owner may have navigated to a different page before this resolved.
    const el = document.getElementById("dataLastUpload");
    if (el) el.textContent = ts ? new Date(ts).toLocaleDateString() : "—";
  });

  document.getElementById("ignoreHolidaysToggle").addEventListener("change", async (e) => {
    App.ignoreHolidays = e.target.checked;
    await DB.setSetting("ignoreHolidays", App.ignoreHolidays);
  });

  document.getElementById("weatherEnabledToggle").addEventListener("change", async (e) => {
    App.weatherEnabled = e.target.checked;
    await DB.setSetting("weatherEnabled", App.weatherEnabled);
    if (App.weatherEnabled) {
      refreshWeatherIfNeeded(); // fire-and-forget; renders itself in when data lands
    }
  });
  wireWeatherLocationSection();

  App.matchReturnHash = "#/data";
  wireUploadWidget(document.getElementById("view-root"));
  SquareSync.mount();
  Account.mount();

  document.getElementById("exportBackupBtn").addEventListener("click", exportBackup);
  document.getElementById("importBackupBtn").addEventListener("click", () => document.getElementById("importInput").click());
  document.getElementById("importInput").addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) importBackupFile(e.target.files[0]);
  });
  document.getElementById("deleteAllBtn").addEventListener("click", () => {
    showModal({
      title: t("dataDeleteConfirmTitle"),
      body: t("dataDeleteConfirmBody"),
      confirmLabel: t("dataDeleteConfirmYes"),
      cancelLabel: t("dataDeleteConfirmCancel"),
      danger: true,
      onConfirm: deleteAllData,
    });
  });
};

async function deleteAllData() {
  await DB.clearAll();
  Usage.reset(); // settings are gone, so the next event gets a brand-new random browser id
  App.dataSource = null;
  App.ignoreHolidays = true;
  App.weatherEnabled = false;
  App.weatherLocation = null;
  App.weatherUnits = { temp: "F", precip: "in" };
  App.weatherMap = new Map();
  App.weatherLastError = null;
  App.customerIdColumnName = null;
  App.customerSummaryRows = [];
  await refreshAllRows();
  location.hash = "#/dashboard";
  dispatchRoute();
}

// Backup format history:
//   version 1 -> just { rows }.
//   version 2 -> adds { dayNotes, settings } (Phase 1: holidays & day notes).
//   version 3 -> adds { weather } and weather settings (weather initiative
//   Phase 1).
//   version 4 -> adds { customHolidays } (owner-entered holidays).
//   version 5 -> adds the customer-hash salt + detected column name to
//   settings, so a restored backup keeps hashing future uploads
//   consistently with already-hashed rows (which travel with `rows` as
//   normal fields -- there is no raw customer data anywhere to carry).
//   version 6 -> adds { customerSummary }: an optional, already-aggregated
//   monthly new/returning customer report, a separate data source from the
//   hashed per-transaction rows (see js/customer-summary.js).
//   Importing an older backup still works: any field it doesn't have
//   simply defaults to empty/off.
function exportBackup() {
  const payload = {
    version: 6,
    exportedAt: new Date().toISOString(),
    rows: App.allRows.map((r) => {
      const copy = Object.assign({}, r);
      delete copy.id;
      return copy;
    }),
    dayNotes: Array.from(App.dayNotesMap.values()),
    weather: Array.from(App.weatherMap.values()),
    customHolidays: Array.from(App.customHolidaysMap.values()),
    customerSummary: App.customerSummaryRows || [],
    settings: {
      ignoreHolidays: App.ignoreHolidays,
      weatherEnabled: App.weatherEnabled,
      weatherLocation: App.weatherLocation,
      weatherUnits: App.weatherUnits,
      customerIdColumnName: App.customerIdColumnName,
    },
  };
  DB.getSetting("customerHashSalt").then((salt) => {
    if (salt) payload.settings.customerHashSalt = salt;
    downloadBackupPayload(payload);
  });
}

function downloadBackupPayload(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cafe-insights-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackupFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload || !Array.isArray(payload.rows)) throw new Error("bad shape");
      await DB.replaceAllRows(payload.rows);
      // Older backups won't have these fields -- default them instead of
      // failing, so old backup files still import cleanly.
      await DB.replaceAllDayNotes(Array.isArray(payload.dayNotes) ? payload.dayNotes : []);
      await DB.replaceAllWeather(Array.isArray(payload.weather) ? payload.weather : []);
      await DB.replaceAllCustomHolidays(Array.isArray(payload.customHolidays) ? payload.customHolidays : []);
      await DB.replaceAllCustomerSummary(Array.isArray(payload.customerSummary) ? payload.customerSummary : []);
      App.customerSummaryRows = await DB.getAllCustomerSummary();
      const s = payload.settings || {};
      if (typeof s.ignoreHolidays === "boolean") {
        await DB.setSetting("ignoreHolidays", s.ignoreHolidays);
        App.ignoreHolidays = s.ignoreHolidays;
      }
      await DB.setSetting("weatherEnabled", !!s.weatherEnabled);
      App.weatherEnabled = !!s.weatherEnabled;
      await DB.setSetting("weatherLocation", s.weatherLocation || null);
      App.weatherLocation = s.weatherLocation || null;
      await DB.setSetting("weatherUnits", s.weatherUnits || { temp: "F", precip: "in" });
      App.weatherUnits = s.weatherUnits || { temp: "F", precip: "in" };
      if (s.customerHashSalt) await DB.setSetting("customerHashSalt", s.customerHashSalt);
      if (s.customerIdColumnName) {
        await DB.setSetting("customerIdColumnName", s.customerIdColumnName);
        App.customerIdColumnName = s.customerIdColumnName;
      }
      await refreshAllRows();
      await refreshWeatherMap();
      showMergeBanner(t("dataImportSuccess", { count: payload.rows.length }));
      location.hash = "#/data";
      dispatchRoute();
      if (App.weatherEnabled && App.weatherLocation) refreshWeatherIfNeeded();
    } catch (err) {
      showError(t("dataImportError"));
    }
  };
  reader.onerror = () => showError(t("dataImportError"));
  reader.readAsText(file);
}

// ---------- Init ----------
async function initApp() {
  try {
    const savedLang = await DB.getSetting("lang");
    App.lang = savedLang || "en";
    const savedIgnoreHolidays = await DB.getSetting("ignoreHolidays");
    App.ignoreHolidays = savedIgnoreHolidays === undefined ? true : !!savedIgnoreHolidays;
    const savedWeatherEnabled = await DB.getSetting("weatherEnabled");
    App.weatherEnabled = !!savedWeatherEnabled;
    const savedWeatherLocation = await DB.getSetting("weatherLocation");
    App.weatherLocation = savedWeatherLocation || null;
    const savedWeatherUnits = await DB.getSetting("weatherUnits");
    App.weatherUnits = savedWeatherUnits || { temp: App.lang === "zh" ? "C" : "F", precip: App.lang === "zh" ? "mm" : "in" };
    const savedShowSunset = await DB.getSetting("showSunsetOnTrend");
    App.showSunsetOnTrend = !!savedShowSunset;
    const savedExcludeOneOffs = await DB.getSetting("excludeOneOffs");
    App.excludeOneOffs = savedExcludeOneOffs === undefined ? true : !!savedExcludeOneOffs;
    App.customerIdColumnName = (await DB.getSetting("customerIdColumnName")) || null;
    App.customerSummaryRows = await DB.getAllCustomerSummary();
    App.hasSeenIntro = !!(await DB.getSetting("hasSeenIntro"));
    App.dataSource = (await DB.getSetting("dataSource")) || null;
    applyStaticText();
    document.getElementById("langToggleBtn").addEventListener("click", () => {
      setLang(App.lang === "en" ? "zh" : "en");
    });
    await refreshAllRows();
    await refreshWeatherMap();
    document.getElementById("bootStatus").hidden = true;
    dispatchRoute(); // figures out the right route on its own -- #/home with no data, otherwise the dashboard or whatever hash is already set
    if (App.weatherEnabled) refreshWeatherIfNeeded(); // fire-and-forget; never blocks page load
    SquareSync.init(); // fire-and-forget: Square card status + returning from "Connect Square"
    Usage.track("visit"); // fire-and-forget; see js/usage.js
    Account.load().then(() => { renderNav(); App.updateActiveNav(location.hash); }); // adds the admin-only Founder link
  } catch (err) {
    // If this device's saved data can't be opened (e.g. another tab of this
    // app is still open on an older version and is holding the database
    // locked), show a clear way out instead of leaving a blank page.
    const boot = document.getElementById("bootStatus");
    boot.hidden = false;
    boot.innerHTML = `
      <p><strong>This page is having trouble loading your saved data.</strong></p>
      <p>This can happen if another tab or window with this app is still open. Try closing other tabs of this site, then reload this page.</p>
      <button type="button" class="btn btn-primary" onclick="location.reload()">Reload</button>
    `;
  }
}

document.addEventListener("DOMContentLoaded", initApp);
