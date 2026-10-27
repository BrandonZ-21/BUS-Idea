// Advisory insights: the wording. Turns the facts from js/insights.js into
// a short memo in English or Chinese. Fixed sentence templates only -- no
// AI, no network. A template may use the numbers it is handed and nothing
// else (tests/insights-test.html checks every digit in the output against
// the facts); the only numbers written into the templates themselves are
// the "2 weeks" test period and "1,000" in the refund rate.
//
// Each insight renders to:
//   { headline, evidence, why, action, check, confidence, caveat, link }
// Suggestions are always something to TRY and how to tell if it worked --
// never a promised result.

const INSIGHT_DOW = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  zh: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
};
const INSIGHT_MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const InsightFmt = {
  money(n) {
    const abs = Math.abs(n);
    const digits = abs >= 100 ? 0 : 2;
    return "$" + abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  },
  count(n) { return Number(n).toLocaleString("en-US"); },
  hour(h, lang) {
    const hh = ((h % 24) + 24) % 24;
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    if (lang === "zh") return `${hh < 12 ? "上午" : "下午"}${h12}点`;
    return `${h12} ${hh < 12 ? "AM" : "PM"}`;
  },
  dow(d, lang) { return INSIGHT_DOW[lang][d]; },
  date(s, lang) {
    const [y, m, d] = s.split("-").map(Number);
    return lang === "zh" ? `${y}年${m}月${d}日` : `${INSIGHT_MONTHS_EN[m - 1].slice(0, 3)} ${d}, ${y}`;
  },
  month(s, lang) {
    const [y, m] = s.split("-").map(Number);
    return lang === "zh" ? `${y}年${m}月` : `${INSIGHT_MONTHS_EN[m - 1]} ${y}`;
  },
  range(meta, lang) {
    return lang === "zh" ? `${InsightFmt.date(meta.start, lang)}至${InsightFmt.date(meta.end, lang)}` : `${InsightFmt.date(meta.start, lang)} to ${InsightFmt.date(meta.end, lang)}`;
  },
};

const INSIGHT_TEMPLATES = {
  en: {
    busiestWindow(f, s, meta, F) {
      const a = F.hour(f.startHour, "en"), b = F.hour(f.endHour, "en");
      return {
        headline: `${a} to ${b} are your busiest two hours: ${f.sharePct}% of a typical day's sales.`,
        evidence: `On an average selling day those two hours take ${F.money(f.avgPerDay)}.`
          + (f.peakDow === null ? "" : ` ${F.dow(f.peakDow, "en")}s are strongest, at ${F.money(f.peakDowAvg)} (${f.peakDowDays} ${F.dow(f.peakDow, "en")}s).`)
          + ` Based on ${F.count(s.sellingDays)} selling days, ${F.range(meta, "en")}.`,
        why: "If that window is short-staffed, or you run out of a top item during it, it costs you more than at any other time of day.",
        action: `This week, have your fastest person on from ${a} and finish prep for your top sellers before then.`,
        check: `After 2 weeks, compare sales for ${a} to ${b} with the 2 weeks before.`,
      };
    },
    slowHours(f, s, meta, F) {
      const a = F.hour(f.startHour, "en"), b = F.hour(f.endHour, "en");
      return {
        headline: `${a} to ${b} is your quiet stretch: about ${f.belowPct}% below a typical two hours.`,
        evidence: `It averages ${F.money(f.avgPerDay)} a day, against ${F.money(f.typicalAvgPerDay)} for a typical two hours between ${F.hour(f.openHour, "en")} and ${F.hour(f.closeHour, "en")}. Based on ${F.count(s.sellingDays)} selling days, ${F.range(meta, "en")}.`,
        why: "You pay for staff and lights in those hours either way, and it's the easiest time to try something new without disrupting a rush.",
        action: "Try one off-peak offer in that window for 2 weeks, such as a set price on a drink with a snack.",
        check: `Then compare average sales for ${a} to ${b} with the 2 weeks before. If nothing moves, drop it.`,
      };
    },
    bestSlowDay(f, s, meta, F) {
      const best = F.dow(f.bestDow, "en"), slow = F.dow(f.slowDow, "en");
      return {
        headline: f.gapPct >= 100 ? `${best}s bring in about ${f.times} times what ${slow}s do.` : `${best}s bring in ${f.gapPct}% more than ${slow}s.`,
        evidence: `An average ${best} takes ${F.money(f.bestAvg)} (${f.bestDays} ${best}s). An average ${slow} takes ${F.money(f.slowAvg)} (${f.slowDays} ${slow}s). That is ${F.money(f.gapAmount)} a day apart, ${F.range(meta, "en")}.`,
        why: "Staffing and prepping the same way every day means too many hands on the slow day or too few on the busy one.",
        action: `This week, put ${slow}'s staffing and prep list next to ${best}'s and change one thing.`,
        check: `After 2 weeks, check that ${slow} still ran smoothly and compare the two days on the Days chart.`,
      };
    },
    topSellers(f, s, meta, F) {
      const names = f.top.map((x) => x.name);
      return {
        headline: `Three items bring in ${f.top3SharePct}% of your item sales: ${names[0]}, ${names[1]} and ${names[2]}.`,
        evidence: f.top.map((x) => `${x.name}: ${F.money(x.revenue)} (${F.count(x.units)} sold, ${x.sharePct}%).`).join(" ")
          + ` Out of ${f.distinctItems} items and ${F.count(s.units)} sold, ${F.range(meta, "en")}.`,
        why: "Running out of one of these, or letting its quality slip, hurts sales more than anything else you sell.",
        action: "This week, check stock for these three first every morning so none of them runs out.",
        check: "Over the next 2 weeks, count the days any of them sold out.",
      };
    },
    longTail(f, s, meta, F) {
      return {
        headline: `The slower half of your menu, ${f.tailItems} of ${f.distinctItems} items, brings in only ${f.tailRevenuePct}% of item sales.`,
        evidence: `Together they made ${F.money(f.tailRevenue)} in ${s.weeks} weeks. Slowest: ${f.slowest.map((x) => `${x.name} (${F.count(x.units)} sold)`).join(", ")}. ${F.range(meta, "en")}.`,
        why: "Every item takes stock, space and time to keep on offer, even when it rarely sells.",
        action: "Pick two of the slowest that you don't keep for a reason (a regular's favourite, a seasonal item) and stop offering them for 2 weeks.",
        check: "See whether anyone asks for them, and whether your item sales change.",
      };
    },
    pairs(f, s, meta, F) {
      return {
        headline: `About 1 in ${f.oneIn} orders with ${f.anchor} also include ${f.addOn} (${f.withPct}%).`,
        evidence: `${F.count(f.both)} of ${F.count(f.anchorReceipts)} receipts with ${f.anchor} also had ${f.addOn}. Across all ${F.count(f.receipts)} receipts, ${f.basePct}% include ${f.addOn}. ${F.range(meta, "en")}.`,
        why: `That leaves ${F.count(f.withoutReceipts)} ${f.anchor} orders without it, which makes ${f.addOn} the most natural thing to suggest.`,
        action: `For 2 weeks, test it: have staff offer ${f.addOn} with every ${f.anchor}, or try the two as a bundle side by side.`,
        check: `Then see whether the share of ${f.anchor} orders that include ${f.addOn} moved from ${f.withPct}%.`,
      };
    },
    orderSize(f, s, meta, F) {
      return {
        headline: `${f.singlePct}% of your orders are a single item.`,
        evidence: `${F.count(f.singleReceipts)} of ${F.count(s.receipts)} receipts. Single-item orders average ${F.money(f.avgSingle)}; orders with more than one item average ${F.money(f.avgMulti)} (${F.count(f.multiReceipts)} receipts). Overall average order: ${F.money(f.avgOrder)}. ${F.range(meta, "en")}.`,
        why: "A second item on even some of those orders raises sales without needing a single new customer.",
        action: "Choose one low-priced add-on and have staff offer it at the till for 2 weeks.",
        check: `Then compare your single-item share with ${f.singlePct}% and your average order with ${F.money(f.avgOrder)}.`,
      };
    },
    recentTrend(f, s, meta, F) {
      const dir = { up: "up", down: "down" }[f.direction];
      const mover = f.moverName ? ` Biggest change: ${f.moverName}, ${f.moverDirection === "up" ? "up" : "down"} ${F.money(f.moverPerDay)} a day.` : "";
      return {
        headline: f.direction === "flat" ? "Sales per day have held steady over the last four weeks." : `Sales per day are ${dir} ${f.changePct}% over the last four weeks.`,
        evidence: `${F.date(f.recentFrom, "en")} to ${F.date(f.recentTo, "en")}: ${F.money(f.recentAvg)} a day over ${f.recentDays} selling days. ${F.date(f.priorFrom, "en")} to ${F.date(f.priorTo, "en")}: ${F.money(f.priorAvg)} a day over ${f.priorDays} selling days.${mover}`,
        why: { up: "It's worth knowing what is driving it, so you can keep doing it.", down: "A dip that lasts a month is worth a look before it becomes the new normal.", flat: "Steady is useful: it gives you a clean baseline for testing a change." }[f.direction],
        action: "Open Day Notes and write down anything that changed in that period: hours, prices, staff, a promotion, or something nearby.",
        check: "Look at this again in 2 weeks to see whether the direction holds.",
      };
    },
    seasonality(f, s, meta, F) {
      const best = F.month(f.bestMonth, "en"), slow = F.month(f.slowMonth, "en");
      return {
        headline: f.gapPct >= 100 ? `${best} was your strongest month and ${slow} your weakest: about ${f.times} times the sales per selling day.` : `${best} was your strongest month and ${slow} your weakest, ${f.gapPct}% apart per selling day.`,
        evidence: `${best}: ${F.money(f.bestAvg)} a day over ${f.bestDays} selling days. ${slow}: ${F.money(f.slowAvg)} a day over ${f.slowDays} selling days. ${f.monthsCompared} full months compared.`,
        why: "If the same months repeat next year, you can plan stock, opening hours and time off around them.",
        action: `Add a Day Note about what was different in ${slow} (closures, events, anything nearby) while you still remember.`,
        check: "Compare the same months next year.",
        caveat: f.underAYear ? "Less than a year of data, so this may be that particular year, not the season." : "",
      };
    },
    refunds(f, s, meta, F) {
      const rare = f.ratePct < 2;
      return {
        headline: rare ? `Refunds are rare: about ${f.per1000} in every 1,000 payments.` : `${f.ratePct}% of your payments are refunded.`,
        evidence: `${F.count(f.refunds)} refunds against ${F.count(f.payments)} payments, ${F.money(f.refundAmount)} in total (${f.amountPct}% of sales). ${F.range(meta, "en")}.`,
        why: rare ? "Nothing to fix here. A glance each month is enough to notice if it jumps." : "Each refund is a lost sale plus staff time, and a cluster of them often points to one recurring problem.",
        action: rare ? "No action needed this week." : "For the next 2 weeks, have staff jot down the reason for every refund.",
        check: rare ? "Look again next month." : "See whether one reason accounts for most of them.",
      };
    },
    discounts(f, s, meta, F) {
      return {
        headline: `Discounts took ${f.pctOfSales}% off your sales.`,
        evidence: `${F.count(f.discountedReceipts)} receipts (${f.receiptPct}% of all ${F.count(s.receipts)}) had a discount, ${F.money(f.amount)} in total. ${F.range(meta, "en")}.`,
        why: "A discount only pays for itself if it brings in sales you would not otherwise have had.",
        action: "Pick the discount you use most and pause it for 2 weeks.",
        check: "Then compare sales per day with the 2 weeks before.",
      };
    },
    channels(f, s, meta, F) {
      return {
        headline: `${f.highName} orders average ${f.gapPct}% more than ${f.lowName} orders.`,
        evidence: `${f.highName}: ${F.money(f.highAvg)} on average over ${F.count(f.highReceipts)} receipts. ${f.lowName}: ${F.money(f.lowAvg)} over ${F.count(f.lowReceipts)} receipts. ${F.range(meta, "en")}.`,
        why: "Knowing which side spends more shows where an extra suggestion or a menu change is worth trying first.",
        action: `Look at what ${f.highName} orders include that ${f.lowName} orders don't, and offer that one thing with ${f.lowName} orders for 2 weeks.`,
        check: `Then compare the ${f.lowName} average with ${F.money(f.lowAvg)}.`,
      };
    },
  },

  zh: {
    busiestWindow(f, s, meta, F) {
      const a = F.hour(f.startHour, "zh"), b = F.hour(f.endHour, "zh");
      return {
        headline: `${a}到${b}是你最赚钱的时段：占一天销售额的 ${f.sharePct}%。`,
        evidence: `平均每个营业日，这两个小时的销售额是 ${F.money(f.avgPerDay)}。`
          + (f.peakDow === null ? "" : `${F.dow(f.peakDow, "zh")}最强，平均 ${F.money(f.peakDowAvg)}（共 ${f.peakDowDays} 个${F.dow(f.peakDow, "zh")}）。`)
          + `依据：${F.count(s.sellingDays)} 个营业日，${F.range(meta, "zh")}。`,
        why: "如果这个时段人手不够，或者热销商品卖断货，损失会比一天中任何其他时间都大。",
        action: `这周，让手脚最快的员工从${a}开始上岗，并在这之前备好热销商品。`,
        check: `2 周后，把${a}到${b}的销售额和之前 2 周比一比。`,
      };
    },
    slowHours(f, s, meta, F) {
      const a = F.hour(f.startHour, "zh"), b = F.hour(f.endHour, "zh");
      return {
        headline: `${a}到${b}是你的清淡时段：比一般的两小时低约 ${f.belowPct}%。`,
        evidence: `这两小时平均每天 ${F.money(f.avgPerDay)}，而${F.hour(f.openHour, "zh")}到${F.hour(f.closeHour, "zh")}之间一般的两小时是 ${F.money(f.typicalAvgPerDay)}。依据：${F.count(s.sellingDays)} 个营业日，${F.range(meta, "zh")}。`,
        why: "这段时间人工和水电照样要付，而且这是最适合尝试新做法、又不会打乱高峰的时候。",
        action: "在这个时段试一个非高峰优惠，为期 2 周，比如饮品加小食的固定价格。",
        check: `然后把${a}到${b}的平均销售额和之前 2 周比一比。没有变化就取消。`,
      };
    },
    bestSlowDay(f, s, meta, F) {
      const best = F.dow(f.bestDow, "zh"), slow = F.dow(f.slowDow, "zh");
      return {
        headline: f.gapPct >= 100 ? `${best}的销售额大约是${slow}的 ${f.times} 倍。` : `${best}的销售额比${slow}高 ${f.gapPct}%。`,
        evidence: `${best}平均 ${F.money(f.bestAvg)}（共 ${f.bestDays} 个${best}）。${slow}平均 ${F.money(f.slowAvg)}（共 ${f.slowDays} 个${slow}）。每天相差 ${F.money(f.gapAmount)}，${F.range(meta, "zh")}。`,
        why: "每天都按同样的人手和备货来安排，结果不是淡的那天人太多，就是忙的那天人不够。",
        action: `这周，把${slow}的排班和备货清单跟${best}的放在一起对比，改一处。`,
        check: `2 周后，确认${slow}运转依然顺畅，并在“按星期”图表上比较这两天。`,
      };
    },
    topSellers(f, s, meta, F) {
      const names = f.top.map((x) => x.name);
      return {
        headline: `三件商品带来了 ${f.top3SharePct}% 的商品销售额：${names[0]}、${names[1]}和${names[2]}。`,
        evidence: f.top.map((x) => `${x.name}：${F.money(x.revenue)}（卖出 ${F.count(x.units)} 份，占 ${x.sharePct}%）。`).join("")
          + `共 ${f.distinctItems} 种商品、卖出 ${F.count(s.units)} 份，${F.range(meta, "zh")}。`,
        why: "这几样一旦断货或品质下降，对销售额的影响比其他任何商品都大。",
        action: "这周，每天早上先检查这三样的库存，确保不会断货。",
        check: "接下来 2 周，数一数它们有几天卖断货。",
      };
    },
    longTail(f, s, meta, F) {
      return {
        headline: `卖得较慢的那一半商品（${f.distinctItems} 种里的 ${f.tailItems} 种）只带来 ${f.tailRevenuePct}% 的商品销售额。`,
        evidence: `它们在 ${s.weeks} 周里一共卖了 ${F.money(f.tailRevenue)}。最慢的是：${f.slowest.map((x) => `${x.name}（卖出 ${F.count(x.units)} 份）`).join("、")}。${F.range(meta, "zh")}。`,
        why: "每一样商品都要占用库存、空间和时间，哪怕它很少卖出去。",
        action: "从最慢的里面挑两样没有特别理由保留的（不是老顾客的最爱，也不是季节限定），停售 2 周。",
        check: "看看有没有人问起，以及商品销售额有没有变化。",
      };
    },
    pairs(f, s, meta, F) {
      return {
        headline: `买${f.anchor}的订单里，大约每 ${f.oneIn} 笔就有 1 笔同时买了${f.addOn}（${f.withPct}%）。`, // ZH-REVIEW (changed)
        evidence: `${F.count(f.anchorReceipts)} 张含${f.anchor}的小票中，有 ${F.count(f.both)} 张同时含${f.addOn}。而在全部 ${F.count(f.receipts)} 张小票中，含${f.addOn}的占 ${f.basePct}%。${F.range(meta, "zh")}。`,
        why: `也就是说还有 ${F.count(f.withoutReceipts)} 张${f.anchor}的订单没有它，所以${f.addOn}是最自然的推荐。`,
        action: `接下来 2 周试一试：让员工在顾客点${f.anchor}时顺口推荐${f.addOn}，或者把两样搭配成套餐摆在一起。`, // ZH-REVIEW (changed)
        check: `然后看${f.anchor}订单中含${f.addOn}的比例有没有从 ${f.withPct}% 变化。`,
      };
    },
    orderSize(f, s, meta, F) {
      return {
        headline: `你有 ${f.singlePct}% 的订单只买了一件商品。`,
        evidence: `${F.count(s.receipts)} 张小票中有 ${F.count(f.singleReceipts)} 张。单件订单平均 ${F.money(f.avgSingle)}；多件订单平均 ${F.money(f.avgMulti)}（${F.count(f.multiReceipts)} 张）。整体平均客单价：${F.money(f.avgOrder)}。${F.range(meta, "zh")}。`,
        why: "哪怕只有一部分订单多加一件，销售额也会上升，而且不需要多一位新顾客。",
        action: "选一样价格不高的加购商品，让员工在收银时推荐，为期 2 周。",
        check: `然后把单件订单的比例和 ${f.singlePct}% 比较，把平均客单价和 ${F.money(f.avgOrder)} 比较。`,
      };
    },
    recentTrend(f, s, meta, F) {
      const dir = { up: "上升", down: "下降" }[f.direction];
      const mover = f.moverName ? `变化最大的是${f.moverName}，每天${f.moverDirection === "up" ? "增加" : "减少"} ${F.money(f.moverPerDay)}。` : "";
      return {
        headline: f.direction === "flat" ? "最近四周，每天的销售额保持平稳。" : `最近四周，每天的销售额${dir}了 ${f.changePct}%。`,
        evidence: `${F.date(f.recentFrom, "zh")}至${F.date(f.recentTo, "zh")}：平均每天 ${F.money(f.recentAvg)}，共 ${f.recentDays} 个营业日。${F.date(f.priorFrom, "zh")}至${F.date(f.priorTo, "zh")}：平均每天 ${F.money(f.priorAvg)}，共 ${f.priorDays} 个营业日。${mover}`,
        why: { up: "值得弄清楚是什么带动的，这样才能继续保持。", down: "持续一个月的下滑值得留意，别让它变成常态。", flat: "平稳也有用：它是测试任何改动的干净基准。" }[f.direction],
        action: "打开“每日备注”，记下这段时间里的任何变化：营业时间、价格、人手、促销，或者附近发生的事。",
        check: "2 周后再看一次，看这个方向是否持续。",
      };
    },
    seasonality(f, s, meta, F) {
      const best = F.month(f.bestMonth, "zh"), slow = F.month(f.slowMonth, "zh");
      return {
        headline: f.gapPct >= 100 ? `${best}是你最好的月份，${slow}最差：按每个营业日算，销售额大约是 ${f.times} 倍。` : `${best}是你最好的月份，${slow}最差，按每个营业日算相差 ${f.gapPct}%。`,
        evidence: `${best}：平均每天 ${F.money(f.bestAvg)}，共 ${f.bestDays} 个营业日。${slow}：平均每天 ${F.money(f.slowAvg)}，共 ${f.slowDays} 个营业日。共比较了 ${f.monthsCompared} 个完整月份。`,
        why: "如果明年同样的月份再次出现这种情况，你就可以据此安排库存、营业时间和休假。",
        action: `趁还记得，在“每日备注”里写下${slow}有什么不同（停业、活动、附近的情况）。`,
        check: "明年比较同样的月份。",
        caveat: f.underAYear ? "数据不到一年，所以这可能只是这一年的情况，不一定是季节规律。" : "",
      };
    },
    refunds(f, s, meta, F) {
      const rare = f.ratePct < 2;
      return {
        headline: rare ? `退款很少：每 1,000 笔付款中大约 ${f.per1000} 笔。` : `你有 ${f.ratePct}% 的付款被退款。`,
        evidence: `${F.count(f.payments)} 笔付款中有 ${F.count(f.refunds)} 笔退款，共 ${F.money(f.refundAmount)}（占销售额的 ${f.amountPct}%）。${F.range(meta, "zh")}。`,
        why: rare ? "这里没什么要改的。每个月看一眼，突然升高时能注意到就够了。" : "每一笔退款都是损失的销售加上员工的时间，而集中出现的退款往往指向同一个反复出现的问题。",
        action: rare ? "这周不需要采取行动。" : "接下来 2 周，让员工记下每一笔退款的原因。",
        check: rare ? "下个月再看一次。" : "看是不是某一个原因占了大多数。",
      };
    },
    discounts(f, s, meta, F) {
      return {
        headline: `折扣让你的销售额少了 ${f.pctOfSales}%。`,
        evidence: `${F.count(f.discountedReceipts)} 张小票（占全部 ${F.count(s.receipts)} 张的 ${f.receiptPct}%）用了折扣，共 ${F.money(f.amount)}。${F.range(meta, "zh")}。`,
        why: "只有当折扣带来了原本不会有的销售时，它才划算。",
        action: "选出你用得最多的那个折扣，暂停 2 周。",
        check: "然后把每天的销售额和之前 2 周比较。",
      };
    },
    channels(f, s, meta, F) {
      return {
        headline: `${f.highName}的订单平均比${f.lowName}的订单高 ${f.gapPct}%。`,
        evidence: `${f.highName}：平均 ${F.money(f.highAvg)}，共 ${F.count(f.highReceipts)} 张小票。${f.lowName}：平均 ${F.money(f.lowAvg)}，共 ${F.count(f.lowReceipts)} 张小票。${F.range(meta, "zh")}。`,
        why: "知道哪一边花得更多，就知道该先在哪里尝试多推荐一句，或者调整菜单。",
        action: `看看${f.highName}的订单里有什么是${f.lowName}的订单没有的，在${f.lowName}的订单上推荐这一样，为期 2 周。`,
        check: `然后把${f.lowName}的平均值和 ${F.money(f.lowAvg)} 比较。`,
      };
    },
  },
};

const INSIGHT_STRINGS = {
  en: {
    confidence: { high: "High", medium: "Medium", low: "Low" },
    basis: { sellingDays: "{n} selling days", receipts: "{n} receipts", units: "{n} items sold", months: "{n} full months", weeks: "{n} weeks of sales", pairReceipts: "{n} receipts with both items", refunds: "{n} refunds" },
    confidenceLine: "Confidence: {level} (based on {basis}).",
    caveat: "This is a pattern in past sales, not proof of what caused it.",
    link: "See the numbers behind this",
    top3Title: "Top 3 actions",
    cantTellTitle: "What this data can't tell you",
    notEnoughTitle: "Not enough data yet",
    labels: { evidence: "Evidence", why: "Why it matters", action: "Try this", check: "How to tell if it worked" },
    names: { busiestWindow: "Busiest hours", slowHours: "Quiet hours", bestSlowDay: "Best and slowest day", topSellers: "Top sellers", longTail: "Slow sellers", pairs: "Items bought together", orderSize: "Order size", recentTrend: "Recent trend", seasonality: "Strong and weak months", refunds: "Refunds", discounts: "Discounts", channels: "Channels and locations" },
    needs: {
      sellingDays: "needs {need} days with sales; you have {have}.",
      timedDays: "needs {need} selling days with a time of day; you have {have}.",
      regularHours: "needs at least {need} regular opening hours in the data; found {have}.",
      weekdayOccurrences: "needs at least {need} of each weekday; the most you have of one is {have}.",
      itemUnits: "needs {need} items sold; you have {have}.",
      distinctItems: "needs {need} different items; you have {have}.",
      weeks: "needs {need} weeks of sales; you have {have}.",
      receipts: "needs {need} receipts; you have {have}.",
      pairReceipts: "no two items appear together on {need} receipts yet (the most is {have}).",
      days: "needs {need} days of sales; you have {have}.",
      sellingDaysPerWindow: "needs {need} selling days in each four-week period; one has {have}.",
      months: "needs {need} full months; you have {have}.",
      discountedReceipts: "needs {need} discounted receipts; you have {have}.",
      groups: "needs {need} channels or locations with enough receipts; found {have}.",
      noDiscountColumn: "this data has no discount amounts.",
      noDiscounts: "no discounts were recorded in this period.",
      noRefunds: "no refunds were recorded in this period.",
      refundsNotSynced: "Connect Square doesn't bring in refunds yet. Upload a Square export to see them.",
      discountsNotSynced: "Connect Square doesn't bring in discount amounts yet. Upload a Square export to see them.",
      noClearPattern: "the data shows no clear difference here.",
    },
    cantTell: {
      profit: "Profit. Tally sees what things sold for, not what they cost you to make.",
      nonBuyers: "Who walked past or left without buying. Only completed sales are here.",
      cause: "Why. Each pattern is something to test, not an explanation.",
      labour: "Whether your staffing is right. There are no hours or wages in this data.",
      oneYear: "Seasons. With less than a year of data, a strong month may be that year, not the season.",
      discounts: "The effect of discounts. This data doesn't record them.",
      weather: "Weather. It's left out unless it shows a clear, strong pattern.",
    },
  },
  zh: {
    confidence: { high: "高", medium: "中", low: "低" },
    basis: { sellingDays: "{n} 个营业日", receipts: "{n} 张小票", units: "卖出 {n} 份商品", months: "{n} 个完整月份", weeks: "{n} 周的销售数据", pairReceipts: "{n} 张同时含这两样的小票", refunds: "{n} 笔退款" },
    confidenceLine: "可信度：{level}（依据 {basis}）。",
    caveat: "这是过去销售中的规律，不能证明原因。",
    link: "查看背后的数据",
    top3Title: "最值得做的三件事",
    cantTellTitle: "这些数据说明不了什么",
    notEnoughTitle: "数据还不够",
    labels: { evidence: "依据", why: "为什么重要", action: "可以试试", check: "怎么知道有没有用" },
    names: { busiestWindow: "最忙时段", slowHours: "清淡时段", bestSlowDay: "最好和最淡的一天", topSellers: "热销商品", longTail: "滞销商品", pairs: "一起购买的商品", orderSize: "订单大小", recentTrend: "近期趋势", seasonality: "旺月和淡月", refunds: "退款", discounts: "折扣", channels: "渠道和门店" },
    needs: {
      sellingDays: "需要 {need} 个有销售的日子，现在有 {have} 个。",
      timedDays: "需要 {need} 个带时间的营业日，现在有 {have} 个。",
      regularHours: "数据中至少需要 {need} 个固定营业小时，现在有 {have} 个。",
      weekdayOccurrences: "每个星期几至少需要 {need} 天，现在最多的只有 {have} 天。",
      itemUnits: "需要卖出 {need} 份商品，现在有 {have} 份。",
      distinctItems: "需要 {need} 种不同的商品，现在有 {have} 种。",
      weeks: "需要 {need} 周的销售数据，现在有 {have} 周。",
      receipts: "需要 {need} 张小票，现在有 {have} 张。",
      pairReceipts: "还没有两样商品同时出现在 {need} 张小票上（最多 {have} 张）。",
      days: "需要 {need} 天的销售数据，现在有 {have} 天。",
      sellingDaysPerWindow: "每个四周时段需要 {need} 个营业日，其中一个只有 {have} 个。",
      months: "需要 {need} 个完整月份，现在有 {have} 个。",
      discountedReceipts: "需要 {need} 张有折扣的小票，现在有 {have} 张。",
      groups: "需要 {need} 个有足够小票的渠道或门店，现在有 {have} 个。",
      noDiscountColumn: "这份数据里没有折扣金额。",
      noDiscounts: "这段时间没有记录到折扣。",
      noRefunds: "这段时间没有记录到退款。",
      refundsNotSynced: "“连接 Square”暂时不会导入退款。上传 Square 导出文件就能看到。",
      discountsNotSynced: "“连接 Square”暂时不会导入折扣金额。上传 Square 导出文件就能看到。",
      noClearPattern: "数据在这方面没有明显差别。",
    },
    cantTell: {
      profit: "利润。Tally 只看到商品卖了多少钱，看不到你的成本。",
      nonBuyers: "有谁路过或没买就走了。这里只有完成的销售。",
      cause: "原因。每一条规律都是可以去验证的事，而不是解释。",
      labour: "人手安排是否合适。这份数据里没有工时或工资。",
      oneYear: "季节性。数据不到一年，某个月好可能只是这一年的情况。",
      discounts: "折扣的效果。这份数据没有记录折扣。",
      weather: "天气。除非出现明显而强烈的规律，否则不纳入。",
    },
  },
};

function insightFill(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
}

// One insight (status "ok") as sentences.
function renderInsight(fact, meta, lang) {
  const L = INSIGHT_STRINGS[lang] ? lang : "en";
  const S = INSIGHT_STRINGS[L];
  const out = INSIGHT_TEMPLATES[L][fact.id](fact.facts, fact.sample, meta, InsightFmt);
  const basisKey = Object.keys(fact.sample)[0];
  return {
    id: fact.id,
    name: S.names[fact.id],
    headline: out.headline,
    evidence: out.evidence,
    why: out.why,
    action: out.action,
    check: out.check,
    confidenceLevel: fact.confidence,
    confidence: insightFill(S.confidenceLine, { level: S.confidence[fact.confidence], basis: insightFill(S.basis[basisKey], { n: InsightFmt.count(fact.sample[basisKey]) }) }),
    caveat: out.caveat || S.caveat,
    link: fact.link,
    linkLabel: S.link,
  };
}

// A rule that didn't have the data: "Refunds: no refunds were recorded...".
function renderNotEnough(fact, lang) {
  const L = INSIGHT_STRINGS[lang] ? lang : "en";
  const S = INSIGHT_STRINGS[L];
  return { id: fact.id, name: S.names[fact.id], text: insightFill(S.needs[fact.needs.what], fact.needs) };
}

// The whole memo: Top 3 first, every insight, what's missing, what it can't say.
function renderInsightMemo(result, lang) {
  const L = INSIGHT_STRINGS[lang] ? lang : "en";
  const S = INSIGHT_STRINGS[L];
  const insights = result.insights.map((x) => renderInsight(x, result.meta, L));
  const byId = new Map(insights.map((x) => [x.id, x]));
  return {
    titles: { top3: S.top3Title, cantTell: S.cantTellTitle, notEnough: S.notEnoughTitle },
    labels: S.labels,
    top3: result.top3.map((id) => ({ id, headline: byId.get(id).headline, action: byId.get(id).action })),
    insights,
    notEnough: result.notEnough.map((x) => renderNotEnough(x, L)),
    cantTell: result.cantTell.map((k) => S.cantTell[k]),
  };
}
