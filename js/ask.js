// Rule-based "Ask a question" engine. No AI, no network call, no server --
// every answer is a template filled in with numbers already computed from
// the owner's own data in js/stats.js. This intentionally covers a
// recognizable set of common questions rather than truly open-ended free
// text; unrecognized questions fall back to a short data overview instead
// of a dead end.

const WEEKDAY_KEYWORDS = [
  { dow: 0, en: ["sunday", "sun"], zh: ["星期日", "周日", "礼拜天"] },
  { dow: 1, en: ["monday", "mon"], zh: ["星期一", "周一"] },
  { dow: 2, en: ["tuesday", "tue"], zh: ["星期二", "周二"] },
  { dow: 3, en: ["wednesday", "wed"], zh: ["星期三", "周三"] },
  { dow: 4, en: ["thursday", "thu"], zh: ["星期四", "周四"] },
  { dow: 5, en: ["friday", "fri"], zh: ["星期五", "周五"] },
  { dow: 6, en: ["saturday", "sat"], zh: ["星期六", "周六"] },
];

function findWeekdayInText(qLower) {
  for (const w of WEEKDAY_KEYWORDS) {
    if (w.en.some((k) => qLower.includes(k)) || w.zh.some((k) => qLower.includes(k))) return w.dow;
  }
  return null;
}

function matchesAny(qLower, list) {
  return list.some((k) => qLower.includes(k));
}

// Each handler: { keywords: [...strings...], run(rows, qLower) => answer string | null }
// Order matters -- more specific handlers (a named weekday, a named item)
// are checked before generic ones.
function buildQuestionHandlers() {
  return [
    {
      keywords: ["best day", "busiest day", "top day", "最好的一天", "最忙的一天", "哪天最好", "哪天最忙", "哪天生意最好"],
      run: (rows) => {
        const { averages, dayCounts } = salesByDow(rows);
        const bestIdx = averages.indexOf(Math.max(...averages));
        const overall = averages.reduce((s, v) => s + v, 0) / averages.filter((v) => v > 0).length;
        return t("qaBestDay", { day: dayLong(bestIdx), amount: formatMoney(averages[bestIdx]), count: dayCounts[bestIdx], overall: formatMoney(overall) });
      },
    },
    {
      keywords: ["worst day", "slowest day", "quietest day", "最淡的一天", "最差的一天", "哪天最淡", "哪天生意最差"],
      run: (rows) => {
        const { averages, dayCounts } = salesByDow(rows);
        const worstIdx = averages.indexOf(Math.min(...averages));
        const overall = averages.reduce((s, v) => s + v, 0) / averages.filter((v) => v > 0).length;
        return t("qaWorstDay", { day: dayLong(worstIdx), amount: formatMoney(averages[worstIdx]), count: dayCounts[worstIdx], overall: formatMoney(overall) });
      },
    },
    {
      keywords: ["busiest hour", "peak hour", "rush hour", "最忙的时段", "高峰时段", "什么时候最忙"],
      run: (rows) => {
        if (!rows.some((r) => r.time)) return t("qaNoHourData");
        const hourTotals = salesByHour(rows);
        const idx = busiestHourOf(hourTotals);
        return t("qaBusiestHour", { hour: formatHourLabel(idx), amount: formatMoney(hourTotals[idx]) });
      },
    },
    {
      keywords: ["quiet hour", "slow hour", "slowest time", "dead time", "清闲时段", "最闲的时候", "什么时候最闲"],
      run: (rows) => {
        if (!rows.some((r) => r.time)) return t("qaNoHourData");
        const hourTotals = salesByHour(rows);
        const active = hourTotals.map((v, i) => i).filter((i) => hourTotals[i] > 0);
        if (active.length < 3) return t("qaNoHourData");
        const minH = Math.min(...active), maxH = Math.max(...active);
        let quietStart = minH, quietVal = Infinity;
        for (let h = minH + 1; h < maxH - 1; h++) {
          const v = hourTotals[h] + (hourTotals[h + 1] || 0);
          if (v < quietVal) { quietVal = v; quietStart = h; }
        }
        return t("qaQuietHours", { startHour: formatHourLabel(quietStart), endHour: formatHourLabel(quietStart + 2) });
      },
    },
    {
      keywords: ["top seller", "best seller", "top item", "most popular", "popular item", "热销", "畅销", "卖得最好", "最受欢迎"],
      run: (rows) => {
        const { top, all } = topItems(rows, 1);
        if (!top.length) return t("qaNoData");
        const totalQty = all.reduce((s, x) => s + x.quantity, 0);
        const pct = totalQty > 0 ? Math.round((top[0].quantity / totalQty) * 100) : 0;
        return t("qaTopItem", { item: top[0].item, qty: top[0].quantity, pct });
      },
    },
    {
      keywords: ["rarely", "least popular", "not selling", "slow seller", "很少", "卖得不好", "冷门"],
      run: (rows) => {
        const { all } = topItems(rows, 5);
        const rare = all.filter((x) => x.quantity <= 3);
        if (!rare.length) return t("qaNoRareItems");
        return t("qaRareItems", { count: rare.length, items: rare.slice(0, 3).map((x) => x.item).join(", ") });
      },
    },
    {
      keywords: ["trend", "trending", "growing", "declining", "going up", "going down", "how are sales", "趋势", "增长", "下滑", "生意怎么样", "销售怎么样"],
      run: (rows) => {
        const weeks = maturityWeeks(rows);
        if (weeks < 2) return t("qaTrendNeedsData");
        const byWeek = salesByWeek(rows);
        if (byWeek.length < 2) return t("qaTrendNeedsData");
        const last = byWeek[byWeek.length - 1][1], prior = byWeek[byWeek.length - 2][1];
        if (prior <= 0) return t("qaTrendNeedsData");
        const pct = Math.round(Math.abs((last - prior) / prior) * 100);
        const dir = last >= prior ? t("up") : t("down");
        return t("qaTrend", { direction: dir, pct, last: formatMoney(last), prior: formatMoney(prior) });
      },
    },
    {
      keywords: ["rain", "weather", "snow", "hot", "cold", "天气", "下雨", "下雪", "冷", "热"],
      run: (rows) => {
        if (!App.weatherEnabled) return t("qaWeatherOff");
        if (App.weatherMap.size === 0) return t("qaWeatherNoData");
        const dailyTotals = computeDailyTotals(rows);
        const groups = {};
        dailyTotals.forEach((revenue, date) => {
          const w = weatherAt(date);
          if (!w) return;
          const cat = precipCategory(w.precipSum, w.snowSum);
          if (!groups[cat]) groups[cat] = { sum: 0, count: 0 };
          groups[cat].sum += revenue; groups[cat].count++;
        });
        const dry = groups.dry;
        if (!dry || dry.count < 3) return t("qaWeatherNoData");
        const rain = groups.rain;
        if (!rain || rain.count < 3) return t("qaWeatherNoData");
        const avgDry = dry.sum / dry.count, avgRain = rain.sum / rain.count;
        const pct = Math.round(Math.abs((avgRain - avgDry) / avgDry) * 100);
        const dir = avgRain >= avgDry ? t("up") : t("down");
        return t("qaWeather", { direction: dir, pct, rainAmount: formatMoney(avgRain), dryAmount: formatMoney(avgDry) });
      },
    },
    {
      keywords: ["holiday", "节日", "节假日", "假期"],
      run: (rows) => {
        const nonHolidayRows = rows.filter((r) => !holidayAt(r.date));
        const nonHolidayByDow = salesByDow(nonHolidayRows);
        const dailyTotals = computeDailyTotals(rows);
        let best = null;
        dailyTotals.forEach((revenue, date) => {
          const h = holidayAt(date);
          if (!h) return;
          const dow = rowDayOfWeek({ date });
          const typical = nonHolidayByDow.averages[dow];
          if (typical > 0 && (!best || Math.abs(revenue - typical) / typical > Math.abs(best.pctRaw))) {
            best = { name: t(h.nameKey), date, revenue, typical, pctRaw: (revenue - typical) / typical };
          }
        });
        if (!best) return t("qaHolidayNone");
        const pct = Math.round(Math.abs(best.pctRaw) * 100);
        const dir = best.pctRaw >= 0 ? t("up") : t("down");
        return t("qaHoliday", { name: best.name, direction: dir, pct, amount: formatMoney(best.revenue) });
      },
    },
    {
      keywords: ["delivery", "takeout", "dine-in", "dine in", "order type", "外送", "外带", "堂食", "订单类型"],
      run: (rows, qLower) => {
        if (!rows.some((r) => r.orderType)) return t("qaNoOrderTypeData");
        const types = orderTypeSplit(rows).sort((a, b) => b.revenue - a.revenue);
        const total = types.reduce((s, x) => s + x.revenue, 0);
        if (!types.length || total <= 0) return t("qaNoOrderTypeData");
        // If a specific type was named (not just "order type" generically),
        // answer about that one instead of always the largest. Matches
        // against the raw order-type text in the data, not the display
        // label, so this works regardless of the current UI language.
        const named = { deliver: ["delivery", "外送"], takeout: ["takeout", "外带"], "dine": ["dine-in", "dine in", "堂食"] };
        let picked = null;
        for (const rawFragment in named) {
          if (named[rawFragment].some((k) => qLower.includes(k))) {
            picked = types.find((x) => (x.type || "").toLowerCase().includes(rawFragment));
            if (picked) break;
          }
        }
        const top = picked || types[0];
        const pct = Math.round((top.revenue / total) * 100);
        const key = picked ? "qaOrderTypeSpecific" : "qaOrderType";
        return t(key, { type: orderTypeLabel(top.type), pct, amount: formatMoney(top.revenue) });
      },
    },
    {
      keywords: ["total sales", "how much", "revenue", "总销售额", "一共卖了多少", "总共赚了多少"],
      run: (rows) => {
        const s = computeSummary(rows);
        return t("qaTotalSales", { amount: formatMoney(s.totalSales), orders: s.orderCount.toLocaleString(), avg: formatMoney2(s.avgOrder) });
      },
    },
  ];
}

// answers a free-text question. Returns a plain-language string. Never
// throws -- any internal error falls back to a friendly message so the
// panel can never crash from a question it didn't expect.
function answerQuestion(question, rows) {
  const q = (question || "").trim();
  if (!q) return null;
  if (!rows || !rows.length) return t("qaNoData");
  const qLower = q.toLowerCase();

  try {
    // A specific weekday mentioned anywhere in the question (works for
    // "why was Tuesday slow", "how's Saturday", "星期二怎么样", etc.)
    const dow = findWeekdayInText(qLower);
    if (dow !== null) {
      const { averages, dayCounts } = salesByDow(rows);
      const overall = averages.reduce((s, v) => s + v, 0) / averages.filter((v) => v > 0).length;
      const pct = overall > 0 ? Math.round(Math.abs((averages[dow] - overall) / overall) * 100) : 0;
      const dir = averages[dow] >= overall ? t("up") : t("down");
      return t("qaSpecificDay", { day: dayLong(dow), amount: formatMoney(averages[dow]), count: dayCounts[dow], direction: dir, pct, overall: formatMoney(overall) });
    }

    const handlers = buildQuestionHandlers();
    for (const h of handlers) {
      if (matchesAny(qLower, h.keywords)) {
        const answer = h.run(rows, qLower);
        if (answer) return answer;
      }
    }

    return generalSummaryAnswer(rows);
  } catch (err) {
    return t("qaError");
  }
}

// Fallback for a question that didn't match a known pattern -- a short,
// genuinely useful overview instead of "I don't understand."
function generalSummaryAnswer(rows) {
  const s = computeSummary(rows);
  const { averages } = salesByDow(rows);
  const bestIdx = averages.indexOf(Math.max(...averages));
  const { top } = topItems(rows, 1);
  return t("qaFallbackSummary", {
    amount: formatMoney(s.totalSales),
    orders: s.orderCount.toLocaleString(),
    bestDay: dayLong(bestIdx),
    item: top.length ? top[0].item : "—",
  });
}
