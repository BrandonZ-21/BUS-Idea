// Main application logic: state, upload flow, column matching, merging,
// dashboard + detail page rendering. Nothing in this file ever sends the
// owner's data anywhere -- all parsing, storage (IndexedDB) and calculation
// happen locally in the browser.

const App = {
  lang: "en",
  allRows: [],
  rangeMode: "all",
  pendingParse: null, // { headers, dataRows, guesses, signature, remembered }
  matchReturnHash: "#/dashboard",
  itemsSort: "quantity",
  itemsSearch: "",
  hoursScope: "all",
  ignoreHolidays: true,
  holidaysMap: new Map(), // "YYYY-MM-DD" -> { key, nameKey }
  dayNotesMap: new Map(), // "YYYY-MM-DD" -> { date, text, tags }
  notesFilter: "all", // "all" | "noted"
  editingNoteDate: null,
};

function closedDates() {
  const set = new Set();
  App.dayNotesMap.forEach((note, date) => {
    if (note.tags && note.tags.includes("closed")) set.add(date);
  });
  return set;
}

function holidayAt(dateStr) {
  return App.holidaysMap.get(dateStr) || null;
}

function noteAt(dateStr) {
  return App.dayNotesMap.get(dateStr) || null;
}

const KNOWN_NOTE_TAGS = ["rainy", "festival", "shortStaffed", "closed"];
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
  ["view-upload", "view-match", "view-root"].forEach((id) => {
    document.getElementById(id).hidden = id !== name;
  });
}

App.showEmptyState = function () {
  document.getElementById("mainNav").innerHTML = "";
  showView("view-upload");
  renderUploadScreen();
};

App.showAppShell = function () {
  showView("view-root");
  renderNav();
};

App.updateActiveNav = function (route) {
  document.querySelectorAll("#mainNav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === route || (route === "#/dashboard" && a.getAttribute("href") === "#/dashboard"));
  });
};

function renderNav() {
  const items = [
    ["#/dashboard", "navDashboard"],
    ["#/notes", "navNotes"],
    ["#/data", "navData"],
  ];
  document.getElementById("mainNav").innerHTML = items
    .map(([href, key]) => `<a href="${href}">${esc(t(key))}</a>`)
    .join("");
}

function applyStaticText() {
  document.title = t("appName");
  document.getElementById("brandName").textContent = t("appName");
  document.getElementById("privateBadgeText").textContent = t("privateBadge");
  document.getElementById("privacyStrip").textContent = t("privacyNote");
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
  } else if (App.allRows.length === 0) {
    App.showEmptyState();
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

// ---------- Upload screen ----------
function renderUploadScreen() {
  const el = document.getElementById("view-upload");
  el.innerHTML = `
    <div class="upload-hero">
      <h1>${esc(t("uploadTitle"))}</h1>
      <p>${esc(t("tagline"))}</p>
    </div>
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
  `;
  wireUploadWidget(el);
}

function wireUploadWidget(scopeEl) {
  const dz = scopeEl.querySelector("#dropzone");
  const input = scopeEl.querySelector("#fileInput");
  const chooseBtn = scopeEl.querySelector("#chooseFileBtn");
  const sampleBtn = scopeEl.querySelector("#sampleBtn");
  const sample2Btn = scopeEl.querySelector("#sample2Btn");

  if (chooseBtn) chooseBtn.addEventListener("click", () => input.click());
  if (input) input.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });
  if (dz) {
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
    dz.addEventListener("drop", (e) => {
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

function handleFile(file) {
  clearError();
  const ext = fileExt(file.name);
  if (EXCEL_EXTENSIONS.includes(ext)) {
    parseExcelFile(file);
  } else if (TEXT_EXTENSIONS.includes(ext) || !ext) {
    parseTextFile(file);
  } else {
    showError(t("errorFileType"));
  }
}

function parseTextFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: onParsed,
    error: () => showError(t("errorParse")),
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
      showError(t("errorParse"));
    }
  };
  reader.onerror = () => showError(t("errorParse"));
  reader.readAsArrayBuffer(file);
}

function loadSampleFile(path) {
  clearError();
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
    showError(t("errorParse"));
    return;
  }
  const data = results.data || [];
  if (!data.length) { showError(t("errorEmpty")); return; }
  const headers = results.meta && results.meta.fields ? results.meta.fields : Object.keys(data[0]);
  if (!headers.length) { showError(t("errorParse")); return; }

  const { guesses } = guessColumns(headers);
  const signature = formatSignature(headers);

  DB.getSetting("format:" + signature).then((remembered) => {
    App.pendingParse = {
      headers,
      dataRows: data,
      guesses: remembered || guesses,
      signature,
      remembered: !!remembered,
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
  el.innerHTML = `
    <h1>${esc(t("matchTitle"))}</h1>
    <p>${esc(t("matchIntro"))}</p>
    ${p.remembered ? `<div class="match-remembered-note">${esc(t("matchRemembered"))}</div>` : ""}
    <form id="matchForm">
      <div class="match-grid">
        ${MATCH_FIELDS.map(([field, labelKey]) => `
          <div class="match-field">
            <label for="match-${field}">${esc(t(labelKey))}</label>
            <select id="match-${field}" name="${field}">${options(p.guesses[field])}</select>
            ${field === "quantity" ? `<p class="match-note">${esc(t("matchQuantityNote"))}</p>` : ""}
            ${field === "date" ? `<p class="match-note">${esc(t("matchCombinedHint"))}</p>` : ""}
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

function confirmMatch() {
  const p = App.pendingParse;
  const mapping = {};
  MATCH_FIELDS.forEach(([field]) => {
    const val = document.getElementById("match-" + field).value;
    mapping[field] = val || null;
  });
  if (!mapping.date || !mapping.price) {
    showError(t("errorMissingRequired"));
    return;
  }
  const { rows, badCount } = buildRows(p.dataRows, mapping);
  if (!rows.length) {
    showError(t("errorNoValidRows"));
    return;
  }
  DB.setSetting("format:" + p.signature, mapping).then(() => {
    App.pendingParse = null;
    return mergeNewRows(rows);
  }).then(() => {
    clearError();
    location.hash = App.matchReturnHash;
    App.matchReturnHash = "#/dashboard";
    refreshAllRows().then(dispatchRoute);
  }).catch(() => showError(t("errorGeneric")));
}

// ---------- Merge / dedupe ----------
async function mergeNewRows(newRows) {
  const existing = App.allRows.length ? App.allRows : await DB.getAllRows();
  const savedCounts = new Map();
  existing.forEach((r) => {
    const fp = r.fingerprint || fingerprintRow(r);
    savedCounts.set(fp, (savedCounts.get(fp) || 0) + 1);
  });
  const importCounts = new Map();
  const toInsert = [];
  newRows.forEach((row) => {
    const fp = fingerprintRow(row);
    const occ = importCounts.get(fp) || 0;
    const savedCount = savedCounts.get(fp) || 0;
    if (occ >= savedCount) {
      toInsert.push(Object.assign({}, row, { fingerprint: fp, importedAt: Date.now() }));
    }
    importCounts.set(fp, occ + 1);
  });
  const added = toInsert.length;
  const skipped = newRows.length - added;
  if (added > 0) {
    await DB.addRows(toInsert);
    await DB.setSetting("lastUpload", Date.now());
  }
  if (added === 0) {
    showMergeBanner(t("mergeAllDuplicate"));
  } else if (skipped === 0) {
    showMergeBanner(t("mergeSummaryNoSkip", { added }));
  } else {
    showMergeBanner(t("mergeSummary", { added, skipped }));
  }
  await refreshAllRows();
}

async function refreshAllRows() {
  App.allRows = await DB.getAllRows();
  App.holidaysMap = holidaysForRows(App.allRows);
  await refreshDayNotes();
}

async function refreshDayNotes() {
  const notes = await DB.getAllDayNotes();
  App.dayNotesMap = new Map(notes.map((n) => [n.date, n]));
}

// ---------- Date range filter ----------
// Applies the date-range selector AND drops rows on dates tagged "closed" in
// Day Notes, since a closed day shouldn't count toward any average.
function getFilteredRows() {
  const ranged = filterByRange(App.allRows, App.rangeMode);
  const closed = closedDates();
  if (closed.size === 0) return ranged;
  return ranged.filter((r) => !closed.has(r.date));
}

function maturityWeeks(rows) {
  return weeksCovered(rows);
}

function maturityLabel(weeks) {
  const w = Math.max(1, Math.round(weeks));
  return w === 1 ? t("basedOnWeek1") : t("basedOnWeeks", { weeks: w });
}

function renderRangeSelector() {
  return `
    <div class="date-range-row">
      <label for="rangeSelect">${esc(t("rangeLabel"))}</label>
      <select id="rangeSelect">
        <option value="4weeks" ${App.rangeMode === "4weeks" ? "selected" : ""}>${esc(t("range4weeks"))}</option>
        <option value="8weeks" ${App.rangeMode === "8weeks" ? "selected" : ""}>${esc(t("range8weeks"))}</option>
        <option value="all" ${App.rangeMode === "all" ? "selected" : ""}>${esc(t("rangeAll"))}</option>
      </select>
    </div>`;
}

function wireRangeSelector(onChange) {
  const sel = document.getElementById("rangeSelect");
  if (sel) sel.addEventListener("change", (e) => {
    App.rangeMode = e.target.value;
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
    if (h) events.push(`${t(h.nameKey)} (${shortDate})`);
    const n = noteAt(ds);
    if (n && (n.text || (n.tags && n.tags.length))) {
      const label = n.text || (n.tags || []).map(tagLabel).join(", ");
      events.push(`${label} (${shortDate})`);
    }
  }
  return events;
}

function trendMarkerOpts(byWeek) {
  const markerIndexes = [];
  byWeek.forEach((w, i) => { if (eventsInWeek(w[0]).length) markerIndexes.push(i); });
  return {
    markerIndexes,
    markerLabelFn: (i) => eventsInWeek(byWeek[i][0]),
  };
}

// ---------- Insights ----------
function generateInsights(rows) {
  const insights = [];
  if (!rows.length) return insights;
  const summary = computeSummary(rows);
  const { totals: dowTotals, averages: dowAverages } = salesByDow(rows);
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
      insights.push({
        headline: t("insightBestVsSlowestHeadline", { bestDay: dayLong(bestIdx), slowestDay: dayLong(worstIdx) }),
        action: t("insightBestVsSlowestAction", { bestDay: dayLong(bestIdx), slowestDay: dayLong(worstIdx), pct }),
      });
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
      insights.push({
        headline: t("insightPeakHoursHeadline", { pct }),
        action: t("insightPeakHoursAction", { hour1: formatHourLabel(top2[0][0]), hour2: formatHourLabel(top2[1] ? top2[1][0] : top2[0][0]) }),
      });
    }
  }

  // 3. Week over week (2+ weeks)
  if (weeks >= 2) {
    const byWeek = salesByWeek(rows);
    if (byWeek.length >= 2) {
      const last = byWeek[byWeek.length - 1][1];
      const prior = byWeek[byWeek.length - 2][1];
      if (prior > 0) {
        const pct = Math.round(Math.abs((last - prior) / prior) * 100);
        const dir = last >= prior ? "up" : "down";
        insights.push({
          headline: t("insightWeekOverWeekHeadline", { direction: t(dir), pct }),
          action: t(dir === "up" ? "insightWeekOverWeekActionUp" : "insightWeekOverWeekActionDown"),
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
      headline: t("insightTopItemHeadline", { item: top[0].item }),
      action: t("insightTopItemAction", { pct }),
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
        insights.push({
          headline: t("insightQuietStretchHeadline", { startHour: formatHourLabel(quietStart), endHour: formatHourLabel(quietStart + 2) }),
          action: t("insightQuietStretchAction"),
        });
      }
    }
  }

  // 6. Delivery share
  if (hasOrderType) {
    const deliveryRevenue = rows.filter((r) => r.orderType && r.orderType.toLowerCase().includes("deliver")).reduce((s, r) => s + rowRevenue(r), 0);
    if (deliveryRevenue > 0 && summary.totalSales > 0) {
      const pct = Math.round((deliveryRevenue / summary.totalSales) * 100);
      insights.push({
        headline: t("insightDeliveryShareHeadline", { pct }),
        action: t("insightDeliveryShareAction"),
      });
    }
  }

  // 7. Rare items
  const rareCount = all.filter((x) => x.quantity <= 3).length;
  if (rareCount > 0) {
    insights.push({
      headline: t("insightRareItemsHeadline", { count: rareCount }),
      action: t("insightRareItemsAction"),
    });
  }

  return insights.slice(0, 5);
}

// ---------- Dashboard ----------
App.renderDashboard = function () {
  const root = document.getElementById("view-root");
  const rows = getFilteredRows();
  const weeks = maturityWeeks(rows);
  const thin = weeks < 2;
  const summary = computeSummary(rows);
  const { totals: hourTotals } = { totals: salesByHour(rows) };
  const { totals: dowTotals } = salesByDow(rows);
  const hasTime = rows.some((r) => r.time);
  const hasOrderType = rows.some((r) => r.orderType);
  const byWeek = salesByWeek(rows);
  const showTrend = weeks >= 3 && byWeek.length >= 3;

  const bestDowIdx = dowTotals.indexOf(Math.max(...dowTotals));
  const busiestHourIdx = hourTotals.indexOf(Math.max(...hourTotals));
  const top2HourIdx = hourTotals.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);

  const { top: topItemsList, rare } = topItems(rows, 5);
  const orderTypes = orderTypeSplit(rows);

  root.innerHTML = `
    ${renderRangeSelector()}
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
        <div class="chart-meta">${esc(maturityLabel(weeks))}</div>
        <div class="chart-canvas-wrap"><canvas id="chart-hours" aria-label="${esc(t("chartHoursTitle"))}" role="img"></canvas></div>
        <a class="see-details-link" href="#/hours">${esc(t("seeDetails"))}</a>
      </div>` : ""}

      <div class="card chart-card">
        <h3>${esc(t("chartDaysTitle"))}</h3>
        <div class="chart-meta">${esc(maturityLabel(weeks))}</div>
        <div class="chart-canvas-wrap"><canvas id="chart-days" aria-label="${esc(t("chartDaysTitle"))}" role="img"></canvas></div>
        <a class="see-details-link" href="#/days">${esc(t("seeDetails"))}</a>
      </div>

      ${showTrend ? `
      <div class="card chart-card full-width">
        <h3>${esc(t("chartTrendTitle"))}</h3>
        <div class="chart-meta">${esc(maturityLabel(weeks))} ${weeks >= 8 ? "&middot; " + esc(t("dataMatureMonthly")) : ""}</div>
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

  if (hasTime) {
    renderBarChart("chart-hours", Array.from({ length: 24 }, (_, i) => formatHourLabel(i)), hourTotals, {
      highlightIndexes: top2HourIdx,
      onClick: () => { location.hash = "#/hours"; },
    });
  }
  renderBarChart("chart-days", Array.from({ length: 7 }, (_, i) => dayShort(i)), dowTotals, {
    highlightIndexes: [bestDowIdx],
    onClick: () => { location.hash = "#/days"; },
  });
  if (showTrend) {
    renderLineChart("chart-trend", byWeek.map((w) => w[0]), byWeek.map((w) => w[1]), Object.assign({
      onClick: () => { location.hash = "#/trend"; },
    }, trendMarkerOpts(byWeek)));
  }
  renderBarChart("chart-items", topItemsList.map((x) => x.item), topItemsList.map((x) => x.quantity), {
    horizontal: true,
    tooltipFormatter: (ctx) => ctx.parsed.x + (ctx.parsed.x === 1 ? " item" : " items"),
    onClick: () => { location.hash = "#/items"; },
  });
  if (hasOrderType) {
    renderDoughnutChart("chart-ordertype", orderTypes.map((x) => orderTypeLabel(x.type)), orderTypes.map((x) => x.revenue), {
      onClick: () => { location.hash = "#/order-types"; },
    });
  }
  if (hasTime) {
    const grid = heatmapData(rows);
    renderHeatmap(document.getElementById("heatmap-dashboard"), grid, {
      dayLabels: Array.from({ length: 7 }, (_, i) => dayShort(i)),
      cellLabel: (dow, h, v) => t("heatmapCellLabel", { day: dayLong(dow), hour: formatHourLabel(h), amount: formatMoney(v) }),
      onCellClick: () => { location.hash = "#/heatmap"; },
    });
  }

  const insights = generateInsights(rows);
  document.getElementById("insightsList").innerHTML = insights.map((ins) => `
    <div class="insight-card">
      <div class="insight-icon" aria-hidden="true">✨</div>
      <div>
        <div class="insight-headline">${esc(ins.headline)}</div>
        <div class="insight-action">${esc(ins.action)}</div>
      </div>
    </div>
  `).join("") || `<p>${esc(t("dataNoData"))}</p>`;
};

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

    <div class="toggle-group" role="group" aria-label="${esc(t("chartHoursTitle"))}">
      <button type="button" data-scope="all" class="${scope === "all" ? "active" : ""}">${esc(t("hoursToggleAll"))}</button>
      <button type="button" data-scope="weekday" class="${scope === "weekday" ? "active" : ""}">${esc(t("hoursToggleWeekday"))}</button>
      <button type="button" data-scope="weekend" class="${scope === "weekend" ? "active" : ""}">${esc(t("hoursToggleWeekend"))}</button>
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

  renderBarChart("chart-hours-detail", Array.from({ length: 24 }, (_, i) => formatHourLabel(i)), hourTotals, {
    highlightIndexes: top2.map((x) => x[0]),
  });

  root.querySelectorAll(".toggle-group button").forEach((btn) => {
    btn.addEventListener("click", () => { App.hoursScope = btn.dataset.scope; App.renderHoursDetail(); });
  });
};

// ---------- Detail: Days ----------
App.renderDaysDetail = function () {
  const root = document.getElementById("view-root");
  const rows = getFilteredRows();
  const weeks = maturityWeeks(rows);
  const { totals, averages } = salesByDow(rows);
  const bestIdx = averages.indexOf(Math.max(...averages));
  const worstIdx = averages.indexOf(Math.min(...averages));
  const pct = averages[worstIdx] > 0 ? Math.round(((averages[bestIdx] - averages[worstIdx]) / averages[worstIdx]) * 100) : 0;

  root.innerHTML = `
    <a class="see-details-link" href="#/dashboard">${esc(t("backToDashboard"))}</a>
    <div class="detail-header"><h1>${esc(t("chartDaysTitle"))}</h1><span class="maturity-note">${esc(maturityLabel(weeks))}</span></div>

    <div class="toggle-group" role="group">
      <button type="button" data-mode="total" class="active">${esc(t("daysShowTotal"))}</button>
      <button type="button" data-mode="average">${esc(t("daysShowAverage"))}</button>
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

  let mode = "total";
  const draw = () => {
    const data = mode === "total" ? totals : averages;
    renderBarChart("chart-days-detail", Array.from({ length: 7 }, (_, i) => dayShort(i)), data, {
      highlightIndexes: [mode === "total" ? totals.indexOf(Math.max(...totals)) : bestIdx],
    });
  };
  draw();
  root.querySelectorAll(".toggle-group button").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll(".toggle-group button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.mode;
      draw();
    });
  });
};

// ---------- Detail: Items ----------
App.renderItemsDetail = function () {
  const root = document.getElementById("view-root");
  const rows = getFilteredRows();
  const weeks = maturityWeeks(rows);
  const { top, all } = topItems(rows, 5);
  const totalQty = all.reduce((s, x) => s + x.quantity, 0);
  const pct = totalQty > 0 ? Math.round((top.reduce((s, x) => s + x.quantity, 0) / totalQty) * 100) : 0;
  const rareCount = all.filter((x) => x.quantity <= 3).length;

  root.innerHTML = `
    <a class="see-details-link" href="#/dashboard">${esc(t("backToDashboard"))}</a>
    <div class="detail-header"><h1>${esc(t("chartItemsTitle"))}</h1><span class="maturity-note">${esc(maturityLabel(weeks))}</span></div>

    <div class="card"><div class="chart-canvas-wrap tall"><canvas id="chart-items-detail"></canvas></div></div>

    <div class="detail-section"><h2>${esc(t("detailWhatShows"))}</h2><p>${esc(t("itemsWhatShows"))}</p></div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatFound"))}</h2>
      <ul class="finding-list">
        <li>${esc(t("itemsFinding1", { item: top[0] ? top[0].item : "—", qty: top[0] ? top[0].quantity : 0 }))}</li>
        <li>${esc(t("itemsFinding2", { pct }))}</li>
        <li>${esc(t("itemsFinding3", { count: rareCount }))}</li>
      </ul>
    </div>
    <div class="detail-section">
      <h2>${esc(t("detailWhatTry"))}</h2>
      <ul class="try-list">
        <li>${esc(t("itemsTry1", { item: top[0] ? top[0].item : "" }))}</li>
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
      <table class="data-table">
        <thead><tr><th>${esc(t("itemsColItem"))}</th><th>${esc(t("itemsColQty"))}</th><th>${esc(t("itemsColRevenue"))}</th></tr></thead>
        <tbody id="itemsTableBody"></tbody>
      </table>
    </div>
  `;

  renderBarChart("chart-items-detail", top.map((x) => x.item), top.map((x) => x.quantity), { horizontal: true });

  function renderTable() {
    let list = all.filter((x) => x.item.toLowerCase().includes(App.itemsSearch.toLowerCase()));
    list = list.slice().sort((a, b) => {
      if (App.itemsSort === "name") return a.item.localeCompare(b.item);
      if (App.itemsSort === "revenue") return b.revenue - a.revenue;
      return b.quantity - a.quantity;
    });
    document.getElementById("itemsTableBody").innerHTML = list.map((x) => `
      <tr><td>${esc(x.item)}</td><td>${x.quantity}</td><td>${formatMoney2(x.revenue)}</td></tr>
    `).join("");
  }
  renderTable();
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
        <thead><tr><th>${esc(t("trendColWeek"))}</th><th>${esc(t("trendColSales"))}</th><th>${esc(t("trendColChange"))}</th><th>${esc(t("trendColNotes"))}</th></tr></thead>
        <tbody>
          ${byWeek.map((w, i) => {
            const prevVal = i > 0 ? byWeek[i - 1][1] : null;
            const change = prevVal && prevVal > 0 ? Math.round(((w[1] - prevVal) / prevVal) * 100) : null;
            const events = eventsInWeek(w[0]);
            return `<tr><td>${esc(w[0])}</td><td>${formatMoney(w[1])}</td><td>${change === null ? "—" : (change >= 0 ? "+" : "") + change + "%"}</td><td>${esc(events.join("; "))}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : ""}
  `;
  renderLineChart("chart-trend-detail", byWeek.map((w) => w[0]), byWeek.map((w) => w[1]), trendMarkerOpts(byWeek));
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
  renderDoughnutChart("chart-ordertype-detail", orderTypes.map((x) => orderTypeLabel(x.type)), orderTypes.map((x) => x.revenue));
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
  if (range) App.holidaysMap.forEach((_, d) => { if (d >= range.min && d <= range.max) dateSet.add(d); });

  let dates = Array.from(dateSet).sort();
  if (App.notesFilter === "noted") {
    dates = dates.filter((d) => App.dayNotesMap.has(d) || App.holidaysMap.has(d));
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
        <div class="data-actions">
          <button type="submit" class="btn btn-primary">${esc(t("notesSave"))}</button>
          ${editing ? `<button type="button" class="btn btn-ghost" id="noteCancelBtn">${esc(t("notesCancel"))}</button>` : ""}
        </div>
      </form>
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
            const noteText = n ? [n.text, ...(n.tags || []).map(tagLabel)].filter(Boolean).join(" — ") : "";
            return `<tr>
              <td>${esc(d)}</td><td>${esc(dow)}</td><td>${esc(sales)}</td>
              <td>${h ? esc(t(h.nameKey)) : ""}</td>
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

  document.getElementById("noteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = document.getElementById("noteDateInput").value;
    if (!date) return;
    const text = document.getElementById("noteText").value.trim();
    const tags = Array.from(document.querySelectorAll(".noteTagCheckbox:checked")).map((cb) => cb.value);
    const otherTag = document.getElementById("noteOtherTag").value.trim();
    if (otherTag) tags.push(otherTag);
    await DB.setDayNote({ date, text, tags });
    await refreshDayNotes();
    App.editingNoteDate = null;
    App.renderNotes();
  });
};

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
    document.getElementById("dataLastUpload").textContent = ts ? new Date(ts).toLocaleDateString() : "—";
  });

  document.getElementById("ignoreHolidaysToggle").addEventListener("change", async (e) => {
    App.ignoreHolidays = e.target.checked;
    await DB.setSetting("ignoreHolidays", App.ignoreHolidays);
  });

  App.matchReturnHash = "#/data";
  wireUploadWidget(document.getElementById("view-root"));

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
  App.ignoreHolidays = true;
  await refreshAllRows();
  location.hash = "#/dashboard";
  dispatchRoute();
}

// Backup format history:
//   version 1 -> just { rows }.
//   version 2 -> adds { dayNotes, settings } (Phase 1). Importing a version-1
//   backup still works: dayNotes/settings simply default to empty.
function exportBackup() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    rows: App.allRows.map((r) => {
      const copy = Object.assign({}, r);
      delete copy.id;
      return copy;
    }),
    dayNotes: Array.from(App.dayNotesMap.values()),
    settings: { ignoreHolidays: App.ignoreHolidays },
  };
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
      // Older (version 1) backups won't have these fields -- default them
      // instead of failing, so old backup files still import cleanly.
      await DB.replaceAllDayNotes(Array.isArray(payload.dayNotes) ? payload.dayNotes : []);
      if (payload.settings && typeof payload.settings.ignoreHolidays === "boolean") {
        await DB.setSetting("ignoreHolidays", payload.settings.ignoreHolidays);
        App.ignoreHolidays = payload.settings.ignoreHolidays;
      }
      await refreshAllRows();
      showMergeBanner(t("dataImportSuccess", { count: payload.rows.length }));
      location.hash = "#/data";
      dispatchRoute();
    } catch (err) {
      showError(t("dataImportError"));
    }
  };
  reader.onerror = () => showError(t("dataImportError"));
  reader.readAsText(file);
}

// ---------- Init ----------
async function initApp() {
  const savedLang = await DB.getSetting("lang");
  App.lang = savedLang || "en";
  const savedIgnoreHolidays = await DB.getSetting("ignoreHolidays");
  App.ignoreHolidays = savedIgnoreHolidays === undefined ? true : !!savedIgnoreHolidays;
  applyStaticText();
  document.getElementById("langToggleBtn").addEventListener("click", () => {
    setLang(App.lang === "en" ? "zh" : "en");
  });
  await refreshAllRows();
  if (!location.hash) location.hash = "#/dashboard";
  dispatchRoute();
}

document.addEventListener("DOMContentLoaded", initApp);
