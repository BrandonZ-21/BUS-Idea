// Draws the advice: the "Start here" box, one card per recommendation (same
// seven parts every time), small bar charts, optional one-tap inputs, the
// "General ideas (not from your data)" section, and the anonymous
// "Was this useful?" counts. Facts come from js/insights.js + js/advice.js,
// words from js/insight-text.js + js/advice-text.js. Nothing here sends any
// sales data anywhere.

// ---- Screen text (EN + ZH). Merged into TRANSLATIONS at load. ----
const ADVICE_UI = {
  en: {
    startHereTitle: "Start here",
    startHereIntro: "The three things most worth your time this week, based on your own sales.",
    adviceSeeWhy: "See why",
    advicePartSaw: "What we saw",
    advicePartWhy: "Why it matters",
    advicePartTry: "One thing to try",
    advicePartCheck: "Check in 2 weeks",
    advicePartSure: "How sure we are",
    adviceUsefulQ: "Was this useful?",
    adviceUsefulYes: "Yes",
    adviceUsefulNo: "No",
    adviceUsefulThanks: "Thanks. That helps us improve Tally.",
    adviceOutsideBadge: "Uses outside data",
    adviceSourceBls: "Source: U.S. Bureau of Labor Statistics, Consumer Price Index (CPI-U), food away from home. Retrieved {date}.",
    adviceSourceOpenMeteo: "Weather data by Open-Meteo.com (CC BY 4.0).",
    adviceSourceLocalDates: "Dates: Brandeis University Registrar, academic calendar. Typed in by hand; last checked {date}.",
    adviceChartCompare: "Similar days", adviceChartPeriod: "Your note's days",
    adviceChartBefore: "Before (per day)", adviceChartAfter: "After (per day)",
    adviceChartTop: "Top items", adviceChartRest: "All the others",
    adviceChartRepeat: "Returning customers", adviceChartOnce: "One-time customers",
    adviceChartNeeded: "Break-even", adviceChartActual: "Your pace",
    adviceChartDry: "Dry days", adviceChartWet: "Rain or snow days",
    adviceChartUsual: "Weeks before", adviceChartPeriodDays: "During the period",
    adviceChartYou: "Your prices", adviceChartMarket: "U.S. restaurants",
    adviceChartWindow: "Those two hours", adviceChartRestOfDay: "Rest of the day",
    adviceChartTypical: "Typical two hours", adviceChartQuiet: "Quiet two hours",
    adviceChartSlowHalf: "Slower half of the menu", adviceChartFastHalf: "Faster half",
    adviceChartAll: "All orders", adviceChartWith: "Orders with {item}",
    adviceChartSingle: "One-item orders", adviceChartMulti: "Bigger orders",
    adviceChartPrior: "4 weeks before", adviceChartRecent: "Last 4 weeks",
    adviceFeesTitle: "Add your fees to see what you really keep",
    adviceFeesHint: "The % each channel takes from a sale (a delivery app's commission, card fees). Use the number from your own contract or statement. Example only: if an app keeps 20 cents of every dollar, type 20. Saved only on this device.",
    adviceFeesSave: "Save fees",
    adviceFeesClear: "Clear",
    adviceBreakEvenTitle: "Add two numbers to see your break-even",
    adviceBreakEvenHint: "Fixed costs are bills that don't change with sales, like rent and insurance. Cost % is the share of each sale that goes to ingredients, supplies and fees. Saved only on this device.",
    adviceBreakEvenFixed: "Fixed costs per month ($)",
    adviceBreakEvenCost: "Cost % of sales",
    adviceBreakEvenSave: "Show my break-even",
    adviceInputSaved: "Saved on this device.",
    adviceMoreTitle: "More from your data",
    adviceNotEnoughTitle: "Not enough data yet",
    ideasTitle: "General ideas (not from your data)",
    ideasIntro: "Ideas other small food businesses use. They are picked to match what your data shows, but the ideas themselves come from the sources listed, not from your sales.",
    ideasSource: "Source: {source}. Last reviewed {date}.",
    ideasLink: "Read the source",
    weatherOneTapTitle: "Weather tips",
    weatherOneTapBody: "Turn on weather to get a heads-up before rainy days that have been slow (or busy) for you. Tally sends a rough location (about 1 km) to the free Open-Meteo service. Never your sales.",
    weatherOneTapSquare: "Turn on weather for {place}",
    weatherOneTapPlace: "your Square location",
    weatherOneTapZip: "Add a city or ZIP code",
    weatherZipWhy: "Only used to look up the weather near you. Saved on this device, never on Tally's server.",
    dataNotesTitle: "About these numbers",
    dataNoteSquareRefunds: "Refunds aren't included in sales from Connect Square, so totals can read a little high. Upload a Square export to see refunds.",
    dataNoteFileRefunds: "Refunds in your uploaded file are subtracted from totals. Partial refunds are not.",
    dataNoteGross: "Sales are before discounts, and without tax or tips.",
    dataNoteOverlap: "{days} days ({first} to {last}) have sales from both Connect Square and an uploaded file, so those days are counted twice.",
    dataNoteOverlapFix: "Keep Square for those days",
    dataNoteOverlapDone: "Done. Those days now use your Square sales only.",
    dataNoteMenuPrice: "The menu chart on the Grow page ranks items by price, not profit, because Tally doesn't know your costs.",
    overlapKeepSquare: "Use Square's sales for those days",
    growMenuEngByPrice: "By price, not profit",
    weatherUseSquare: "Use my Square business location",
  },
  zh: { // ZH-REVIEW (every string in this block)
    startHereTitle: "从这里开始",
    startHereIntro: "根据你自己的销售数据，本周最值得花时间的三件事。",
    adviceSeeWhy: "查看原因",
    advicePartSaw: "我们看到的",
    advicePartWhy: "为什么重要",
    advicePartTry: "可以试一件事",
    advicePartCheck: "2 周后检查",
    advicePartSure: "我们有多确定",
    adviceUsefulQ: "这条建议有用吗？",
    adviceUsefulYes: "有用",
    adviceUsefulNo: "没用",
    adviceUsefulThanks: "谢谢，这能帮助我们改进 Tally。",
    adviceOutsideBadge: "使用外部数据",
    adviceSourceBls: "来源：美国劳工统计局，消费者价格指数（CPI-U），在外饮食类。获取日期：{date}。",
    adviceSourceOpenMeteo: "天气数据来自 Open-Meteo.com（CC BY 4.0）。",
    adviceSourceLocalDates: "日期：Brandeis 大学教务处校历，人工录入；最后核对：{date}。",
    adviceChartCompare: "类似的日子", adviceChartPeriod: "备注的日子",
    adviceChartBefore: "改价前（每天）", adviceChartAfter: "改价后（每天）",
    adviceChartTop: "热销商品", adviceChartRest: "其他所有商品",
    adviceChartRepeat: "回头客", adviceChartOnce: "只来过一次的顾客",
    adviceChartNeeded: "保本点", adviceChartActual: "你的节奏",
    adviceChartDry: "晴天", adviceChartWet: "雨雪天",
    adviceChartUsual: "之前几周", adviceChartPeriodDays: "这段时间内",
    adviceChartYou: "你的价格", adviceChartMarket: "全美餐馆",
    adviceChartWindow: "这两个小时", adviceChartRestOfDay: "一天中其他时间",
    adviceChartTypical: "一般的两小时", adviceChartQuiet: "清淡的两小时",
    adviceChartSlowHalf: "卖得慢的一半商品", adviceChartFastHalf: "卖得快的一半",
    adviceChartAll: "所有订单", adviceChartWith: "含{item}的订单",
    adviceChartSingle: "只有一样的订单", adviceChartMulti: "多样的订单",
    adviceChartPrior: "之前 4 周", adviceChartRecent: "最近 4 周",
    adviceFeesTitle: "填上费率，看看你实际能留下多少",
    adviceFeesHint: "每个渠道从一笔销售中抽取的百分比（外卖平台佣金、刷卡手续费）。请用你自己合同或账单上的数字。仅作举例：如果平台每一美元抽走 20 美分，就填 20。只保存在这台设备上。",
    adviceFeesSave: "保存费率",
    adviceFeesClear: "清除",
    adviceBreakEvenTitle: "填两个数字，看看你的保本点",
    adviceBreakEvenHint: "固定成本是不随销售变化的开支，比如房租和保险。成本比例是每笔销售中用于食材、用品和手续费的部分。只保存在这台设备上。",
    adviceBreakEvenFixed: "每月固定成本（美元）",
    adviceBreakEvenCost: "成本占销售额的百分比",
    adviceBreakEvenSave: "显示我的保本点",
    adviceInputSaved: "已保存在这台设备上。",
    adviceMoreTitle: "你的数据里还有这些",
    adviceNotEnoughTitle: "数据还不够",
    ideasTitle: "一般性建议（不是来自你的数据）",
    ideasIntro: "其他小餐饮店常用的做法。我们会挑选和你的数据情况相符的建议，但建议本身来自列出的来源，而不是你的销售数据。",
    ideasSource: "来源：{source}。最后核对：{date}。",
    ideasLink: "查看来源",
    weatherOneTapTitle: "天气提示",
    weatherOneTapBody: "开启天气功能后，如果过去的雨天对你来说生意偏淡（或偏忙），Tally 会提前提醒你。Tally 会把一个大致位置（约 1 公里范围）发送给免费的 Open-Meteo 服务，绝不会发送你的销售数据。",
    weatherOneTapSquare: "为{place}开启天气",
    weatherOneTapPlace: "你的 Square 店铺位置",
    weatherOneTapZip: "添加城市或邮政编码",
    weatherZipWhy: "只用来查询你附近的天气。只保存在这台设备上，不会存到 Tally 的服务器。",
    dataNotesTitle: "关于这些数字",
    dataNoteSquareRefunds: "“连接 Square”导入的销售额不包含退款，所以总数可能略高。上传 Square 导出文件即可看到退款。",
    dataNoteFileRefunds: "你上传的文件中的退款已从总数中扣除，但部分退款没有扣除。",
    dataNoteGross: "销售额为折扣前的金额，不含税和小费。",
    dataNoteOverlap: "有 {days} 天（{first} 至 {last}）同时有“连接 Square”和上传文件的销售记录，所以这些天被计算了两次。",
    dataNoteOverlapFix: "这些天只保留 Square 的记录",
    dataNoteOverlapDone: "完成。这些天现在只使用你的 Square 销售记录。",
    dataNoteMenuPrice: "“发展”页上的菜单图按价格而不是利润给商品排序，因为 Tally 不知道你的成本。",
    overlapKeepSquare: "这些天使用 Square 的销售记录",
    growMenuEngByPrice: "按价格，不是利润",
    weatherUseSquare: "使用我在 Square 上的店铺位置",
  },
};
if (typeof TRANSLATIONS !== "undefined") {
  Object.assign(TRANSLATIONS.en, ADVICE_UI.en);
  Object.assign(TRANSLATIONS.zh, ADVICE_UI.zh);
}

// ---- Building the report ----

// Everything the advice rules may know besides the rows, from this browser only.
function adviceEnv() {
  const outsideOn = ADVICE_CONFIG.outsideData !== false && !OutsideData.disabled;
  return {
    today: toDateStrLocal(new Date()),
    notes: Array.from(App.dayNotesMap.values()),
    isHoliday: (d) => !!holidayAt(d),
    weather: App.weatherEnabled ? App.weatherMap : null,
    localDates: adviceLocalDatesOn() ? localCalendarPeriods("brandeis") : [],
    outside: outsideOn ? OutsideData.data : null,
    nearBoston: adviceNearBoston(),
    inputs: App.adviceInputs || {},
    outsideOn,
  };
}

function adviceLocation() {
  return App.weatherLocation || App.squareLocation || null;
}

// The BLS "Boston-Cambridge-Newton" area, roughly (eastern Massachusetts and
// the southeast corner of New Hampshire). Only decides which BLS line to show.
function adviceNearBoston() {
  const loc = adviceLocation();
  return !!loc && loc.latitude >= 41.7 && loc.latitude <= 43.4 && loc.longitude >= -71.9 && loc.longitude <= -70.5;
}

// The Brandeis dates apply when the owner turned them on, or the shop is
// within ~5 km of campus.
function adviceLocalDatesOn() {
  if (App.localCalendar === "brandeis") return true;
  const loc = adviceLocation();
  return !!loc && Math.abs(loc.latitude - 42.366) < 0.045 && Math.abs(loc.longitude - (-71.259)) < 0.06;
}

const ADVICE_SCORE = (x) => INSIGHT_CONF_WEIGHT[x.confidence] * x.strength * x.reach;

// { meta, facts, cards, top3, notEnough, cantTell, labels, ctx, inputPrompts }
function buildAdviceReport(rows) {
  const result = generateInsightFacts(rows);
  const extra = generateExtraAdvice(rows, adviceEnv());
  const extraIds = new Set(extra.insights.map((x) => x.id));
  const facts = result.insights
    .filter((x) => !(x.id === "longTail" && extraIds.has("concentration")))
    .filter((x) => !(x.id === "channels" && x.facts.kind === "orderType" && extraIds.has("channelMix")))
    .concat(extra.insights)
    .sort((a, b) => ADVICE_SCORE(b) - ADVICE_SCORE(a) || a.id.localeCompare(b.id));

  const top3 = [];
  const used = new Set();
  facts.forEach((x) => { if (top3.length < 3 && !used.has(x.angle)) { top3.push(x.id); used.add(x.angle); } });
  facts.forEach((x) => { if (top3.length < 3 && !top3.includes(x.id)) top3.push(x.id); });

  const lang = App.lang;
  const S = INSIGHT_STRINGS[lang] || INSIGHT_STRINGS.en;
  const cards = facts.map((f) => Object.assign(renderInsight(f, result.meta, lang), { fact: f, impact: adviceImpact(f, extra.ctx) }));
  const notEnough = result.notEnough.concat(extra.notEnough).map((x) => renderNotEnough(x, lang));
  return {
    meta: result.meta, facts, cards, top3,
    notEnough, cantTell: result.cantTell.map((k) => S.cantTell[k]),
    labels: S.labels, ctx: extra.ctx,
    // Optional inputs to offer: break-even when nothing's entered yet.
    showBreakEvenPrompt: !(App.adviceInputs && App.adviceInputs.fixedMonthly > 0) && result.meta.sellingDays >= INSIGHT_MIN.sellingDays,
  };
}

// ---- Tiny charts (plain HTML bars: fast and readable on a phone) ----

function adviceChartRows(card) {
  const f = card.fact.facts, c = card.fact.chart;
  const money = (v) => InsightFmt.money(v);
  const pct = (v) => `${v}%`;
  const dow = (d) => InsightFmt.dow(d, App.lang);
  const L = (k, vars) => t(k, vars);
  switch (card.id) {
    case "noteImpact": return [[L("adviceChartCompare"), f.compAvg, money], [L("adviceChartPeriod"), f.periodAvg, money]];
    case "priceChange": return [[L("adviceChartBefore"), f.beforeUnitsPerDay, String], [L("adviceChartAfter"), f.afterUnitsPerDay, String]];
    case "concentration": return [[L("adviceChartTop") + ` (${f.topCount})`, f.topSharePct, pct], [L("adviceChartRest") + ` (${f.restCount})`, f.restSharePct, pct]];
    case "returning": return [[L("adviceChartRepeat"), f.repeatSalesPct, pct], [L("adviceChartOnce"), 100 - f.repeatSalesPct, pct]];
    case "channelMix": return f.channels.map((ch) => [adviceChannelName(ch.key, App.lang), ch.sales, money]);
    case "breakEven": return [[L("adviceChartNeeded"), f.breakEvenMonthly, money], [L("adviceChartActual"), f.avgMonthly, money]];
    case "weatherAhead": return [[L("adviceChartDry"), f.dryAvg, money], [L("adviceChartWet"), f.wetAvg, money]];
    case "eventAhead": return [[L("adviceChartUsual"), f.baseAvg, money], [L("adviceChartPeriodDays"), f.inAvg, money]];
    case "priceVsMarket": return [[L("adviceChartYou"), f.ownPct, (v) => `${v}%`], [L("adviceChartMarket"), f.marketPct, (v) => `${v}%`]];
    case "busiestWindow": return [[L("adviceChartWindow"), f.sharePct, pct], [L("adviceChartRestOfDay"), 100 - f.sharePct, pct]];
    case "slowHours": return [[L("adviceChartTypical"), f.typicalAvgPerDay, money], [L("adviceChartQuiet"), f.avgPerDay, money]];
    case "bestSlowDay": return [[dow(f.bestDow), f.bestAvg, money], [dow(f.slowDow), f.slowAvg, money]];
    case "topSellers": return f.top.map((x) => [x.name, x.revenue, money]);
    case "longTail": return [[L("adviceChartFastHalf"), 100 - f.tailRevenuePct, pct], [L("adviceChartSlowHalf"), f.tailRevenuePct, pct]];
    case "pairs": return [[L("adviceChartAll"), f.basePct, pct], [L("adviceChartWith", { item: f.anchor }), f.withPct, pct]];
    case "orderSize": return [[L("adviceChartSingle"), f.avgSingle, money], [L("adviceChartMulti"), f.avgMulti, money]];
    case "recentTrend": return [[L("adviceChartPrior"), f.priorAvg, money], [L("adviceChartRecent"), f.recentAvg, money]];
    case "seasonality": return [[InsightFmt.month(f.bestMonth, App.lang), f.bestAvg, money], [InsightFmt.month(f.slowMonth, App.lang), f.slowAvg, money]];
    case "channels": return [[f.highName, f.highAvg, money], [f.lowName, f.lowAvg, money]];
    default: return c && c.values ? c.values.map((v, i) => [String(c.labels[i]), v, String]) : [];
  }
}

function renderAdviceChart(card) {
  const rows = adviceChartRows(card).filter((r) => typeof r[1] === "number" && Number.isFinite(r[1]));
  if (rows.length < 2) return "";
  const max = Math.max(...rows.map((r) => Math.abs(r[1]))) || 1;
  return `<div class="advice-chart" role="img" aria-label="${esc(rows.map((r) => `${r[0]}: ${r[2](r[1])}`).join("; "))}">
    ${rows.map((r) => `<div class="advice-bar-row"><span class="advice-bar-label">${esc(r[0])}</span><span class="advice-bar-track"><span class="advice-bar${r[1] < 0 ? " advice-bar-neg" : ""}" style="width:${Math.max(2, Math.round((Math.abs(r[1]) / max) * 100))}%"></span></span><span class="advice-bar-value">${esc(r[2](r[1]))}</span></div>`).join("")}
  </div>`;
}

// ---- Optional inputs (browser-only) ----

function renderFeesForm(card) {
  const fees = (App.adviceInputs && App.adviceInputs.fees) || {};
  return `<form class="advice-input" data-advice-form="fees">
    <h4>${esc(t("adviceFeesTitle"))}</h4>
    <p class="match-note">${esc(t("adviceFeesHint"))}</p>
    ${card.fact.facts.channels.map((ch) => `<label class="advice-input-row"><span>${esc(adviceChannelName(ch.key, App.lang))}</span>
      <input type="number" inputmode="decimal" min="0" max="99" step="0.1" name="${esc(ch.key)}" value="${fees[ch.key] !== undefined ? esc(fees[ch.key]) : ""}" aria-label="${esc(adviceChannelName(ch.key, App.lang))} %" /> %</label>`).join("")}
    <div class="data-actions"><button type="submit" class="btn btn-secondary btn-sm" data-track="adviceFeesSave">${esc(t("adviceFeesSave"))}</button>
    <button type="button" class="btn btn-ghost btn-sm" data-advice-clear="fees" data-track="adviceFeesClear">${esc(t("adviceFeesClear"))}</button></div>
  </form>`;
}

function renderBreakEvenForm() {
  const inp = App.adviceInputs || {};
  return `<form class="advice-input" data-advice-form="breakEven">
    <h4>${esc(t("adviceBreakEvenTitle"))}</h4>
    <p class="match-note">${esc(t("adviceBreakEvenHint"))}</p>
    <label class="advice-input-row"><span>${esc(t("adviceBreakEvenFixed"))}</span><input type="number" inputmode="decimal" min="0" step="1" name="fixedMonthly" value="${inp.fixedMonthly > 0 ? esc(inp.fixedMonthly) : ""}" /></label>
    <label class="advice-input-row"><span>${esc(t("adviceBreakEvenCost"))}</span><input type="number" inputmode="decimal" min="0" max="99" step="0.1" name="costPct" value="${inp.costPct >= 0 && inp.fixedMonthly > 0 ? esc(inp.costPct) : ""}" /> %</label>
    <div class="data-actions"><button type="submit" class="btn btn-secondary btn-sm" data-track="adviceBreakEvenSave">${esc(t("adviceBreakEvenSave"))}</button>
    ${inp.fixedMonthly > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-advice-clear="breakEven" data-track="adviceBreakEvenClear">${esc(t("adviceFeesClear"))}</button>` : ""}</div>
  </form>`;
}

async function saveAdviceInputs(next) {
  App.adviceInputs = next;
  await DB.setSetting("adviceInputs", next);
  showMergeBanner(t("adviceInputSaved"));
  dispatchRoute();
}

function wireAdviceForms(scope) {
  scope.querySelectorAll("[data-advice-form]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const kind = form.dataset.adviceForm;
      const inputs = Object.assign({}, App.adviceInputs || {});
      if (kind === "fees") {
        const fees = {};
        form.querySelectorAll("input").forEach((el) => {
          const v = parseFloat(el.value);
          if (Number.isFinite(v) && v >= 0 && v < 100) fees[el.name] = Math.round(v * 10) / 10;
        });
        inputs.fees = fees;
      } else {
        const fixed = parseFloat(form.elements.fixedMonthly.value), cost = parseFloat(form.elements.costPct.value);
        if (!(fixed > 0) || !(cost >= 0 && cost < 100)) return;
        inputs.fixedMonthly = Math.round(fixed);
        inputs.costPct = Math.round(cost * 10) / 10;
      }
      saveAdviceInputs(inputs);
    });
  });
  scope.querySelectorAll("[data-advice-clear]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inputs = Object.assign({}, App.adviceInputs || {});
      if (btn.dataset.adviceClear === "fees") delete inputs.fees;
      else { delete inputs.fixedMonthly; delete inputs.costPct; }
      saveAdviceInputs(inputs);
    });
  });
}

// ---- "Was this useful?" (anonymous counts for the Founder page) ----

const ADVICE_USEFUL_KEY = "tally.adviceUseful";
const ADVICE_SHOWN_KEY = "tally.adviceShown";

function adviceStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; }
}
function adviceStoreSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: fine */ }
}

// "Shown" is counted at most once per recommendation type per day per browser.
function trackAdviceShown(ids) {
  const today = toDateStrLocal(new Date());
  const seen = adviceStore(ADVICE_SHOWN_KEY);
  ids.forEach((id) => {
    if (seen[id] === today) return;
    seen[id] = today;
    Usage.track("rec_shown", { detail: id });
  });
  adviceStoreSet(ADVICE_SHOWN_KEY, seen);
}

function renderUseful(id) {
  const answered = adviceStore(ADVICE_USEFUL_KEY)[id];
  if (answered) return `<p class="advice-useful match-note">${esc(t("adviceUsefulThanks"))}</p>`;
  return `<p class="advice-useful"><span>${esc(t("adviceUsefulQ"))}</span>
    <button type="button" class="btn btn-ghost btn-sm" data-useful="yes" data-useful-id="${esc(id)}" data-track="adviceUsefulYes">${esc(t("adviceUsefulYes"))}</button>
    <button type="button" class="btn btn-ghost btn-sm" data-useful="no" data-useful-id="${esc(id)}" data-track="adviceUsefulNo">${esc(t("adviceUsefulNo"))}</button></p>`;
}

function wireUseful(scope) {
  scope.querySelectorAll("[data-useful]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.usefulId, answer = btn.dataset.useful;
      const store = adviceStore(ADVICE_USEFUL_KEY);
      store[id] = answer;
      adviceStoreSet(ADVICE_USEFUL_KEY, store);
      Usage.track("rec_useful", { reason: answer, detail: id });
      const p = btn.closest(".advice-useful");
      if (p) p.outerHTML = `<p class="advice-useful match-note">${esc(t("adviceUsefulThanks"))}</p>`;
    });
  });
}

// ---- Cards ----

function renderAdviceSources(card) {
  const out = card.fact.outside || [];
  const lines = []; // [text, link, linkText]
  const bls = OutsideData.data && OutsideData.data.bls;
  if (out.includes("bls") && bls) lines.push([t("adviceSourceBls", { date: InsightFmt.date(String(bls.retrievedAt).slice(0, 10), App.lang) }), bls.link, "bls.gov"]);
  if (out.includes("openMeteo")) lines.push([t("adviceSourceOpenMeteo"), "https://open-meteo.com", "open-meteo.com"]);
  if (out.includes("localDates")) lines.push([t("adviceSourceLocalDates", { date: InsightFmt.date(LOCAL_CALENDARS.brandeis.reviewedAt, App.lang) }), LOCAL_CALENDARS.brandeis.sourceUrl, "brandeis.edu"]);
  if (!lines.length) return "";
  return `<p class="advice-source">${lines.map(([text, href, label]) => `${esc(text)} <a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`).join("<br />")}</p>`;
}

function renderImpact(card) {
  const im = card.impact;
  if (!im) return "";
  const T = ADVICE_IMPACT_TEXT[App.lang] || ADVICE_IMPACT_TEXT.en;
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);
  const vars = Object.assign({}, im.vars, { price: im.vars.price !== undefined ? InsightFmt.money(im.vars.price) : undefined });
  return `<div class="advice-impact"><strong>${esc(fill(T.range, { low: InsightFmt.money(im.low), high: InsightFmt.money(im.high) }))}</strong>
    <span class="advice-impact-label">${esc(T.label)}.</span> ${esc(fill(T[im.key], vars))}</div>`;
}

function renderAdviceCards(containerId, cards) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = cards.map((x) => `
    <article class="insight-card advice-card" id="${containerId}-card-${x.id}">
      <button type="button" class="insight-toggle" aria-expanded="false" aria-controls="${containerId}-detail-${x.id}">
        <span class="insight-icon" aria-hidden="true"></span>
        <span class="insight-headline-wrap">
          <span class="memo-kind">${esc(x.name)}${(x.fact.outside || []).length ? ` <span class="advice-badge">${esc(t("adviceOutsideBadge"))}</span>` : ""}</span>
          <span class="insight-headline">${esc(x.headline)}</span>
          <span class="insight-action">${esc(x.action)}</span>
        </span>
        <span class="insight-caret" aria-hidden="true">▾</span>
      </button>
      <div class="insight-detail" id="${containerId}-detail-${x.id}" hidden>
        <dl class="memo-parts">
          <dt>${esc(t("advicePartSaw"))}</dt><dd>${esc(x.evidence)}${renderAdviceChart(x)}</dd>
          <dt>${esc(t("advicePartWhy"))}</dt><dd>${esc(x.why)}</dd>
          <dt>${esc(t("advicePartTry"))}</dt><dd>${esc(x.action)}${renderImpact(x)}</dd>
          <dt>${esc(t("advicePartCheck"))}</dt><dd>${esc(x.check)}</dd>
          <dt>${esc(t("advicePartSure"))}</dt><dd><span class="memo-conf memo-conf-${esc(x.confidenceLevel)}">${esc(x.confidence)}</span> ${esc(x.caveat)}</dd>
        </dl>
        ${x.id === "channelMix" ? renderFeesForm(x) : ""}
        ${x.id === "breakEven" ? renderBreakEvenForm() : ""}
        ${renderAdviceSources(x)}
        <a class="see-details-link" href="${esc(x.link)}">${esc(x.linkLabel)} →</a>
        ${renderUseful(x.id)}
      </div>
    </article>`).join("");
  container.querySelectorAll(".insight-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      document.getElementById(btn.getAttribute("aria-controls")).hidden = expanded;
    });
  });
  wireAdviceForms(container);
  wireUseful(container);
  trackAdviceShown(cards.map((x) => x.id));
}

// The "Start here" box: three cards, in order, one sentence each.
function renderStartHere(report) {
  if (!report.top3.length) return "";
  const byId = new Map(report.cards.map((c) => [c.id, c]));
  return `<section class="card memo-top3 start-here">
    <h2>${esc(t("startHereTitle"))}</h2>
    <p class="chart-meta">${esc(t("startHereIntro"))}</p>
    <ol>${report.top3.map((id) => `<li><strong>${esc(byId.get(id).action)}</strong> <span class="start-here-why">${esc(byId.get(id).headline)}</span> <button type="button" class="link-button" data-memo-jump="${esc(id)}">${esc(t("adviceSeeWhy"))}</button></li>`).join("")}</ol>
  </section>`;
}

// ---- Weather: one tap, only once there's value to show ----

function renderWeatherOneTap() {
  if (App.weatherEnabled || ADVICE_CONFIG.outsideData === false || OutsideData.disabled) return "";
  if (App.squareLocation) {
    return `<div class="card advice-onetap"><h3>${esc(t("weatherOneTapTitle"))}</h3><p>${esc(t("weatherOneTapBody"))}</p>
      <button type="button" class="btn btn-secondary btn-sm" id="weatherOneTapBtn">${esc(t("weatherOneTapSquare", { place: App.squareLocation.name || t("weatherOneTapPlace") }))}</button></div>`;
  }
  return `<div class="card advice-onetap"><h3>${esc(t("weatherOneTapTitle"))}</h3><p>${esc(t("weatherOneTapBody"))}</p>
    <a class="btn btn-ghost btn-sm" href="#/data" data-track="weatherOneTapZip">${esc(t("weatherOneTapZip"))}</a></div>`;
}

function wireWeatherOneTap() {
  const btn = document.getElementById("weatherOneTapBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    App.weatherEnabled = true;
    App.weatherLocation = App.squareLocation;
    await DB.setSetting("weatherEnabled", true);
    await DB.setSetting("weatherLocation", App.weatherLocation);
    await DB.clearWeather();
    await refreshWeatherMap();
    refreshWeatherIfNeeded(); // fetches, then redraws this page
  });
}

// ---- Data notes: the known gaps, labeled ----

// Dates that have rows from both Connect Square and an uploaded file.
function squareFileOverlap() {
  const sq = new Set(), file = new Set();
  App.allRows.forEach((r) => (r.source === "square" ? sq : file).add(r.date));
  const days = Array.from(sq).filter((d) => file.has(d)).sort();
  return days.length ? { days, first: days[0], last: days[days.length - 1] } : null;
}

function renderDataNotes() {
  const hasSquare = App.allRows.some((r) => r.source === "square");
  const hasFileRefunds = App.allRows.some((r) => r.refund);
  const overlap = squareFileOverlap();
  const notes = [];
  if (overlap) notes.push(`${esc(t("dataNoteOverlap", { days: overlap.days.length, first: shortDate(overlap.first), last: shortDate(overlap.last) }))} <button type="button" class="btn btn-secondary btn-sm" id="fixOverlapBtn">${esc(t("dataNoteOverlapFix"))}</button>`);
  if (hasSquare) notes.push(esc(t("dataNoteSquareRefunds")));
  if (hasFileRefunds) notes.push(esc(t("dataNoteFileRefunds")));
  if (hasSquare) notes.push(esc(t("dataNoteGross")));
  if (!notes.length) return "";
  return `<details class="card data-notes"${overlap ? " open" : ""}><summary>${esc(t("dataNotesTitle"))}</summary><ul>${notes.map((n) => `<li>${n}</li>`).join("")}</ul></details>`;
}

// Removes uploaded-file rows on days that also have Square rows.
async function keepSquareForOverlap() {
  const overlap = squareFileOverlap();
  if (!overlap) return;
  const days = new Set(overlap.days);
  const keep = App.allRows.filter((r) => r.source === "square" || !days.has(r.date));
  await DB.replaceAllRows(keep);
  await refreshAllRows();
  showMergeBanner(t("dataNoteOverlapDone"));
  dispatchRoute();
}

function wireDataNotes() {
  const btn = document.getElementById("fixOverlapBtn");
  if (btn) btn.addEventListener("click", keepSquareForOverlap);
}

// ---- General ideas (hand-curated, data/ideas.js) ----

// Conditions an idea can be tied to, all read from this report.
function ideaConditions(report) {
  const byId = new Map(report.facts.map((f) => [f.id, f]));
  const ch = byId.get("channelMix");
  const deliveryShare = ch ? ch.facts.channels.filter((c) => /deliver/i.test(c.key)).reduce((s, c) => s + c.sharePct, 0) : 0;
  const ret = byId.get("returning");
  const conc = byId.get("concentration");
  const days = byId.get("bestSlowDay");
  return {
    always: true,
    quietHoursFound: byId.has("slowHours"),
    pairsFound: byId.has("pairs"),
    manySingleItemOrders: byId.has("orderSize"),
    highDeliveryShare: deliveryShare >= 30,
    lowRepeatShare: !!ret && ret.facts.repeatSalesPct < 30,
    manySlowItems: !!conc && conc.facts.barelyCount >= 3,
    bigWeekdayGap: !!days && days.facts.gapPct >= 40,
    priceChanged: byId.has("priceChange"),
  };
}

// Returns { show: [...], stale: [...], placeholders: [...] } -- the last two
// are for the Founder page's monthly review.
function ideasStatus(today) {
  const list = typeof TALLY_IDEAS !== "undefined" ? TALLY_IDEAS : [];
  const maxAge = ADVICE_CONFIG.staleDays.ideasReview;
  const age = (d) => (d ? adviceDaysBetween(d, today) : Infinity);
  return {
    placeholders: list.filter((x) => x.placeholder),
    stale: list.filter((x) => !x.placeholder && age(x.lastReviewed) > maxAge),
    usable: list.filter((x) => !x.placeholder && age(x.lastReviewed) <= maxAge && x.sourceUrl && /^https:\/\//.test(x.sourceUrl)),
  };
}

function renderIdeasSection(report) {
  if (!report.facts.length) return "";
  const cond = ideaConditions(report);
  const type = detectBusinessType(App.allRows);
  const ideas = ideasStatus(toDateStrLocal(new Date())).usable
    .filter((x) => cond[x.when] === true)
    .filter((x) => !x.businessTypes || !x.businessTypes.length || x.businessTypes.includes("all") || x.businessTypes.includes(type))
    .slice(0, 4);
  if (!ideas.length) return "";
  const lang = App.lang === "zh" ? "zh" : "en";
  return `<section class="card ideas-section">
    <h2>${esc(t("ideasTitle"))}</h2>
    <p class="chart-meta">${esc(t("ideasIntro"))}</p>
    <ul class="ideas-list">${ideas.map((x) => `<li><strong>${esc(x.title[lang] || x.title.en)}</strong> ${esc(x.description[lang] || x.description.en)}
      <span class="advice-source">${esc(t("ideasSource", { source: x.sourceName, date: InsightFmt.date(x.lastReviewed, App.lang) }))} <a href="${esc(x.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t("ideasLink"))}</a></span></li>`).join("")}</ul>
  </section>`;
}
