// Home page (#/home), redesigned 2026-11: "One sales recap. One thing to try
// next week." The hero sells the weekly decision (Spot -> Try -> Check), not
// the charts. Next to it sits a receipt-style SAMPLE brief with fictional
// numbers; visitors step through Spot / Try / Check with touch, mouse or
// keyboard (an ARIA tab list). Below: how it works, where a sales file goes
// vs. Square, a short FAQ, and a final call to action.
//
// All text comes from TRANSLATIONS (js/translations.js, hv* keys), so the
// language switch in the header re-renders this page in Chinese and keeps
// the selected step (App.homeStep). Motion is CSS only (css/style.css,
// "Home page" section) and is switched off under prefers-reduced-motion.
// Loaded after js/app.js; replaces the old App.renderHome.

const HOME_STEPS = ["spot", "try", "check"];
App.homeStep = "spot";
App.homeReceiptShown = false; // the receipt's entrance animation plays once per page load

const LOCK_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 0 1 6 0v3z"/></svg>';

function homeRow(label, value, highlight) {
  return `<div class="hv-row${highlight ? " hv-row-hi" : ""}"><span class="hv-row-label">${esc(label)}</span><span class="hv-row-dots" aria-hidden="true"></span><span class="hv-row-value">${highlight ? `<mark>${esc(value)}</mark>` : esc(value)}</span></div>`;
}

// The content of one step of the sample brief. Fictional numbers only; they
// tell one consistent story: sides at lunch fell from 16 to 8 per 100 orders.
function homePanel(step) {
  const per100 = (n) => `${n} ${t("hvPer100")}`;
  if (step === "try") {
    return `
      <p class="hv-panel-kicker">${esc(t("hvTryTitle"))}</p>
      <p class="hv-action"><mark>${esc(t("hvTryAction"))}</mark></p>
      <p class="hv-panel-body">${esc(t("hvTryBody"))}</p>
      <p class="hv-tag"><span aria-hidden="true">✎</span> ${esc(t("hvTryTag"))}</p>`;
  }
  if (step === "check") {
    return `
      <p class="hv-panel-kicker">${esc(t("hvCheckTitle"))}</p>
      <p class="hv-metric"><mark>${esc(t("hvCheckMetric"))}</mark></p>
      <div class="hv-rows">
        ${homeRow(t("hvWeekBefore"), per100(16))}
        ${homeRow(t("hvLastWeek"), per100(8))}
        ${homeRow(t("hvNextWeek"), `___ ${t("hvPer100")}`, true)}
      </div>
      <p class="hv-label-line"><strong>${esc(t("hvObservedLabel"))}</strong> ${esc(t("hvCheckObserved").replace(/^[^:：]+[:：]\s*/, ""))}</p>
      <p class="hv-label-line"><strong>${esc(t("hvSuggestedLabel"))}</strong> ${esc(t("hvCheckSuggested").replace(/^[^:：]+[:：]\s*/, ""))}</p>`;
  }
  return `
    <p class="hv-panel-kicker">${esc(t("hvSpotTitle"))}</p>
    <p class="hv-figure" aria-label="16 → 8 ${esc(t("hvSpotUnit"))}"><span class="hv-num hv-num-was">16</span><span class="hv-arrow" aria-hidden="true">→</span><mark class="hv-num hv-num-now">8</mark></p>
    <p class="hv-unit">${esc(t("hvSpotUnit"))}</p>
    <div class="hv-rows">
      ${homeRow(t("hvLastWeek"), per100(16))}
      ${homeRow(t("hvThisWeek"), per100(8), true)}
    </div>
    <p class="hv-panel-body">${esc(t("hvSpotBody"))} ${esc(t("hvSpotContext"))}</p>`;
}

function homeReceipt() {
  const i = HOME_STEPS.indexOf(App.homeStep);
  const labels = { spot: t("hvStepSpot"), try: t("hvStepTry"), check: t("hvStepCheck") };
  return `
    <article class="hv-receipt${App.homeReceiptShown ? "" : " hv-receipt-enter"}" id="hvBrief" aria-label="${esc(t("hvBriefLabel"))}">
      <header class="hv-receipt-head">
        <p class="hv-receipt-brand">TALLY · ${esc(t("hvBriefHeader"))}</p>
        <p class="hv-receipt-meta">${esc(t("hvBriefShop"))}</p>
        <p class="hv-receipt-meta">${esc(t("hvBriefPeriod"))}</p>
      </header>
      <div class="hv-tabs" role="tablist" aria-label="${esc(t("hvStepsLabel"))}">
        ${HOME_STEPS.map((s, n) => `
          <button type="button" role="tab" class="hv-tab" id="hvTab-${s}" data-step="${s}"
            aria-selected="${s === App.homeStep}" aria-controls="hvPanel" tabindex="${s === App.homeStep ? 0 : -1}">
            <span class="hv-tab-num" aria-hidden="true">${n + 1}</span><span>${esc(labels[s])}</span>
          </button>`).join("")}
      </div>
      <div class="hv-progress">
        <span class="hv-progress-bars" aria-hidden="true">${HOME_STEPS.map((s, n) => `<span class="hv-bar${n <= i ? " hv-bar-on" : ""}"></span>`).join("")}</span>
        <span class="hv-progress-text" id="hvProgressText">${esc(t("hvStepOf", { n: i + 1 }))}</span>
      </div>
      <div class="hv-panel" id="hvPanel" role="tabpanel" tabindex="0" aria-labelledby="hvTab-${App.homeStep}">
        ${homePanel(App.homeStep)}
      </div>
      <footer class="hv-receipt-foot">
        <button type="button" class="hv-link-btn" id="hvOpenSample" data-track="hvOpenSample">${esc(t("hvBriefOpen"))} →</button>
        <p class="hv-receipt-note">${esc(t("hvBriefNote"))}</p>
      </footer>
    </article>`;
}

// Moves to a step and redraws only the receipt's tabs, progress and panel.
function homeSelectStep(step, focusTab) {
  if (!HOME_STEPS.includes(step)) return;
  App.homeStep = step;
  const i = HOME_STEPS.indexOf(step);
  document.querySelectorAll(".hv-tab").forEach((b) => {
    const on = b.dataset.step === step;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll(".hv-bar").forEach((b, n) => b.classList.toggle("hv-bar-on", n <= i));
  document.getElementById("hvProgressText").textContent = t("hvStepOf", { n: i + 1 });
  const panel = document.getElementById("hvPanel");
  panel.setAttribute("aria-labelledby", `hvTab-${step}`);
  panel.innerHTML = homePanel(step);
  // Restart the short step transition (CSS; none under reduced motion).
  panel.classList.remove("hv-panel-change");
  void panel.offsetWidth;
  panel.classList.add("hv-panel-change");
  if (focusTab) document.getElementById(`hvTab-${step}`).focus();
}

function homePrefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function wireHomeReceipt() {
  document.querySelectorAll(".hv-tab").forEach((btn) => {
    btn.addEventListener("click", () => homeSelectStep(btn.dataset.step, false));
    btn.addEventListener("keydown", (e) => {
      const i = HOME_STEPS.indexOf(btn.dataset.step);
      let next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = HOME_STEPS[(i + 1) % 3];
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = HOME_STEPS[(i + 2) % 3];
      else if (e.key === "Home") next = HOME_STEPS[0];
      else if (e.key === "End") next = HOME_STEPS[2];
      if (next) {
        e.preventDefault();
        homeSelectStep(next, true);
      }
    });
  });
  // Into the existing full sample dashboard (js/app.js startDemo): loads the
  // built-in sample, or opens this browser's own report if it already has sales.
  document.getElementById("hvOpenSample").addEventListener("click", () => startDemo());
  const receipt = document.getElementById("hvBrief");
  receipt.addEventListener("animationend", () => receipt.classList.remove("hv-receipt-enter"), { once: true });
  App.homeReceiptShown = true;
}

App.renderHome = function () {
  const el = document.getElementById("view-root");
  const shareUrl = appShareUrl();
  const formUrl = feedbackUrl();
  el.innerHTML = `
    <div class="hv">
      <section class="hv-hero">
        <div class="hv-copy">
          <p class="hv-kicker">${esc(t("hvKicker"))}</p>
          <h1 class="hv-h1">${esc(t("hvHeadline"))}</h1>
          <p class="hv-sub">${esc(t("hvSub"))}</p>
          <div class="hv-ctas">
            <button type="button" class="hv-btn hv-btn-primary" id="hvTrySample" data-track="hvTrySample">${esc(t("hvCtaSample"))}</button>
            <button type="button" class="hv-btn hv-btn-secondary" id="hvUseFile" data-track="hvUseFile">${esc(t("hvCtaFile"))}</button>
          </div>
          <p class="hv-trust">${LOCK_ICON}<span>${esc(t("hvTrustFile"))}</span></p>
          <p class="hv-trust hv-trust-lang"><span aria-hidden="true">文A</span><span>${esc(t("hvTrustLang"))}</span></p>
        </div>
        <div class="hv-brief-col">${homeReceipt()}</div>
      </section>

      <section class="hv-section hv-how" aria-labelledby="hvHowTitle">
        <h2 id="hvHowTitle" class="hv-h2">${esc(t("hvHowTitle"))}</h2>
        <ol class="hv-steps">
          <li><span class="hv-step-num" aria-hidden="true">1</span><h3>${esc(t("hvStepSpot"))}</h3><p>${esc(t("hvHow1Body"))}</p></li>
          <li><span class="hv-step-num" aria-hidden="true">2</span><h3>${esc(t("hvStepTry"))}</h3><p>${esc(t("hvHow2Body"))}</p></li>
          <li><span class="hv-step-num" aria-hidden="true">3</span><h3>${esc(t("hvStepCheck"))}</h3><p>${esc(t("hvHow3Body"))}</p></li>
        </ol>
      </section>

      <section class="hv-section hv-where landing-upload" id="landingUploadSection" aria-labelledby="hvWhereTitle">
        <h2 id="hvWhereTitle" class="hv-h2">${esc(t("hvWhereTitle"))}</h2>
        <div class="hv-where-grid">
          <div class="hv-where-file">
            <h3>${esc(t("hvWhereFileTitle"))}</h3>
            <p>${esc(t("hvWhereFileBody"))}</p>
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
          </div>
          <div class="hv-where-square">
            <h3>${esc(t("hvWhereSquareTitle"))}</h3>
            <p>${esc(t("hvWhereSquareBody"))}</p>
            <div class="card square-card" id="squareCard" hidden></div>
            <h3>${esc(t("hvWhereSavedTitle"))}</h3>
            <p>${esc(t("hvWhereSavedBody"))}</p>
            <div class="card square-card" id="accountCard" hidden></div>
            <p><a href="${App.lang === "zh" ? "/privacy.html?lang=zh" : "/privacy.html?lang=en"}" id="hvPrivacyLink">${esc(t("hvWherePrivacy"))} →</a></p>
          </div>
        </div>
      </section>

      <section class="hv-section hv-faq" aria-labelledby="hvFaqTitle">
        <h2 id="hvFaqTitle" class="hv-h2">${esc(t("hvFaqTitle"))}</h2>
        ${[1, 2, 3].map((n) => `
          <details class="hv-faq-item">
            <summary>${esc(t(`hvFaq${n}Q`))}</summary>
            <p>${esc(t(`hvFaq${n}A`))}</p>
          </details>`).join("")}
      </section>

      <section class="hv-section hv-final">
        <h2 class="hv-h2">${esc(t("hvFinalTitle"))}</h2>
        <p>${esc(t("hvFinalBody"))}</p>
        <div class="hv-ctas hv-ctas-center">
          <button type="button" class="hv-btn hv-btn-primary" id="hvTrySample2" data-track="hvTrySampleEnd">${esc(t("hvCtaSample"))}</button>
          <button type="button" class="hv-btn hv-btn-secondary" id="hvUseFile2" data-track="hvUseFileEnd">${esc(t("hvCtaFile"))}</button>
        </div>
      </section>

      ${shareUrl || formUrl ? `
      <section class="hv-section hv-more" aria-label="${esc(t("hvMoreTitle"))}">
        ${shareUrl ? `
        <div class="landing-feedback card">
          <div class="landing-feedback-qr">${qrSvg(shareUrl, { label: t("shareHomeQrLabel") })}</div>
          <div>
            <h2>${esc(t("shareHomeTitle"))}</h2>
            <p>${esc(t("shareHomeBody"))}</p>
            <p class="landing-share-link">${esc(shareUrl.replace(/^https:\/\//, "").replace(/\/$/, ""))}</p>
          </div>
        </div>` : ""}
        ${formUrl ? `
        <div class="landing-feedback card">
          <div class="landing-feedback-qr">${qrSvg(formUrl, { label: t("feedbackHomeQrLabel") })}</div>
          <div>
            <h2>${esc(t("feedbackHomeTitle"))}</h2>
            <p>${esc(t("feedbackHomeBody"))}</p>
            <div class="data-actions">
              <a class="btn btn-primary" id="homeFeedbackLink">${esc(t("feedbackLink"))}</a>
              <a class="btn btn-ghost" href="/card.html">${esc(t("feedbackCardLink"))}</a>
            </div>
          </div>
        </div>` : ""}
      </section>` : ""}
    </div>
  `;

  const homeFeedbackLink = document.getElementById("homeFeedbackLink");
  if (homeFeedbackLink) wireFeedbackLink(homeFeedbackLink);
  wireUploadWidget(el);
  SquareSync.mount();
  Account.mount();
  wireHomeReceipt();

  const smooth = homePrefersReducedMotion() ? "auto" : "smooth";
  // "Try the sample brief": bring the walkthrough into view and put keyboard
  // focus on its current step. No file picker, no account.
  const trySample = () => {
    const brief = document.getElementById("hvBrief");
    brief.scrollIntoView({ behavior: smooth, block: "center" });
    brief.classList.remove("hv-receipt-attention");
    void brief.offsetWidth;
    brief.classList.add("hv-receipt-attention");
    document.getElementById(`hvTab-${App.homeStep}`).focus({ preventScroll: true });
  };
  // "Use my sales file": show where the file goes first, then the file button.
  const useFile = () => {
    document.getElementById("landingUploadSection").scrollIntoView({ behavior: smooth, block: "start" });
    document.getElementById("chooseFileBtn").focus({ preventScroll: true });
  };
  ["hvTrySample", "hvTrySample2"].forEach((id) => document.getElementById(id).addEventListener("click", trySample));
  ["hvUseFile", "hvUseFile2"].forEach((id) => document.getElementById(id).addEventListener("click", useFile));
};
