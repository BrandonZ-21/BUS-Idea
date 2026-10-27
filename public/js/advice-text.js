// Wording for the advice in js/advice.js, in English and Simplified Chinese.
// Same rules as js/insight-text.js: fixed templates only, no AI, and a
// template may only print numbers it was handed (tests/advice-test.html
// checks every digit). Short sentences, "you/your", about an 8th-grade
// reading level. Never a promised result, never a cause.
//
// Every Chinese string is marked ZH-REVIEW so it can be checked by a person
// (the full list is in ZH_REVIEW.md).

// Order channel names as stored -> display. "__none" = Square order with no
// pickup, delivery or shipment. Square has no dine-in flag, so it is NEVER
// called dine-in.
const ADVICE_CHANNEL_NAMES = {
  en: { __none: "In person or not marked" },
  zh: { __none: "店内或未标注", Pickup: "自取", Delivery: "外送", Shipping: "邮寄", "Dine In": "堂食", Takeout: "外带", "Take Out": "外带", "For Here": "堂食", "To Go": "外带" }, // ZH-REVIEW
};
// Common spellings in files ("Dine-In", "dine in", "TO GO"...) -> one Chinese name.
const ADVICE_CHANNEL_ZH_LOOSE = { dinein: "堂食", forhere: "堂食", takeout: "外带", togo: "外带", pickup: "自取", delivery: "外送", shipping: "邮寄", online: "网上订单" }; // ZH-REVIEW
function adviceChannelName(key, lang) {
  const names = ADVICE_CHANNEL_NAMES[lang] || ADVICE_CHANNEL_NAMES.en;
  if (names[key]) return names[key];
  if (key === "__none") return ADVICE_CHANNEL_NAMES.en.__none;
  if (lang === "zh") {
    const loose = ADVICE_CHANNEL_ZH_LOOSE[String(key).toLowerCase().replace(/[^a-z]/g, "")];
    if (loose) return loose;
  }
  return key;
}

const ADVICE_NOTE_TAGS = {
  en: { promo: "your promo", rainy: "a rainy day", festival: "a festival", shortStaffed: "a short-staffed day" },
  zh: { promo: "你的促销", rainy: "雨天", festival: "节日活动", shortStaffed: "人手不足的一天" }, // ZH-REVIEW
};

const ADVICE_EVENT_KINDS = {
  en: { finals: ["Finals week", "finals weeks"], break: ["A school break", "school breaks"], termStart: ["The first week of classes", "first weeks of classes"], summer: ["Summer break", "summer breaks"] },
  zh: { finals: ["期末考试周", "期末考试周"], break: ["学校假期", "学校假期"], termStart: ["开学第一周", "开学第一周"], summer: ["暑假", "暑假"] }, // ZH-REVIEW
};

function adviceRange(a, b, lang, F) {
  if (a === b) return F.date(a, lang);
  return lang === "zh" ? `${F.date(a, lang)}至${F.date(b, lang)}` : `${F.date(a, lang)} to ${F.date(b, lang)}`;
}

function adviceItemName(f) {
  return f.variation ? `${f.name} (${f.variation})` : f.name;
}

function adviceNoteLabel(r, lang) {
  if (r.label) return lang === "zh" ? `“${r.label}”` : `"${r.label}"`;
  return (ADVICE_NOTE_TAGS[lang] || {})[r.tag] || r.tag || (lang === "zh" ? "这条备注" : "this note"); // ZH-REVIEW
}

const ADVICE_TEMPLATES = {
  en: {
    noteImpact(f, s, meta, F) {
      const label = adviceNoteLabel(f, "en");
      const range = adviceRange(f.start, f.end, "en", F);
      const p = Math.abs(f.diffPct || 0);
      const head = p < 3 ? `During ${label} (${range}), sales were about the same as on similar days.`
        : `During ${label} (${range}), sales averaged ${p}% ${f.diffPct > 0 ? "more" : "less"} a day than on similar days.`;
      const others = f.others.length ? ` Other notes: ${f.others.map((o) => `${adviceNoteLabel(o, "en")} ${o.diffPct > 0 ? "+" : o.diffPct < 0 ? "-" : ""}${Math.abs(o.diffPct || 0)}% (${o.compDays} days compared)`).join("; ")}.` : "";
      return {
        headline: head,
        evidence: `${F.money(f.periodAvg)} a day over ${f.periodDays} selling days, against ${F.money(f.compAvg)} a day on ${f.compDays} similar days: the same weekdays, ${f.beforeDays} before and ${f.afterDays} after, skipping holidays and other noted days.${others}`,
        why: "Seeing which changes lined up with better days helps you decide what to repeat.",
        action: f.isPromo ? "If you run it again, change only one thing (the day, the offer, or where you post it) so you can compare." : "Add a Day Note each time you try something new, so Tally can compare it for you.",
        check: "In 2 weeks, open this card again. More days make the comparison steadier.",
        caveat: "This is a comparison, not proof. Weather, school dates or other things may have changed too.",
      };
    },
    priceChange(f, s, meta, F) {
      const item = adviceItemName(f);
      const u = f.unitsChangePct;
      const move = u === null || Math.abs(u) < 3 ? "about the same as before" : `${u > 0 ? "up" : "down"} ${Math.abs(u)}% from ${f.beforeUnitsPerDay} a day`;
      const orders = f.storeOrdersChangePct === null ? "" : Math.abs(f.storeOrdersChangePct) < 3 ? " Over the same time, your total orders per day stayed about the same." : ` Over the same time, your total orders per day went ${f.storeOrdersChangePct > 0 ? "up" : "down"} ${Math.abs(f.storeOrdersChangePct)}%.`;
      const market = f.marketPct === undefined ? "" : ` For context: restaurant prices across the U.S. ${f.marketPct >= 0 ? "rose" : "fell"} ${Math.abs(f.marketPct)}% in the year to ${F.month(f.marketMonth, "en")} (U.S. Bureau of Labor Statistics).`
        + (f.localPct === null || f.localPct === undefined ? "" : ` In the Boston area: ${Math.abs(f.localPct)}% ${f.localPct >= 0 ? "higher" : "lower"} (${F.month(f.localMonth, "en")}).`);
      return {
        headline: `The price of ${item} went from ${F.money(f.oldPrice)} to ${F.money(f.newPrice)} around ${F.date(f.changeDate, "en")}. Since then it sells ${f.afterUnitsPerDay} a day, ${move}.`,
        evidence: `Before: ${F.count(f.unitsBefore)} sold over ${f.beforeDays} selling days (${adviceRange(f.beforeFrom, f.beforeTo, "en", F)}). After: ${F.count(f.unitsAfter)} sold over ${f.afterDays} selling days (${adviceRange(f.afterFrom, f.afterTo, "en", F)}). It was ${f.shareBeforePct}% of all items sold before and ${f.shareAfterPct}% after.${orders}${market}`,
        why: "Units sold before and after show whether customers kept buying it at the new price.",
        action: "Keep an eye on this item's units each week, and ask your staff whether customers mention the price.",
        check: `In 2 weeks, check whether it is still about ${f.shareAfterPct}% of items sold.`,
        caveat: "Before and after is not proof. Seasons, weather and other changes move sales too.",
      };
    },
    concentration(f, s, meta, F) {
      const slow = f.barelyCount
        ? ` ${f.barelyCount} items sold less than once a week on average over ${f.weeks} weeks${f.barelyNames.length ? `, such as ${f.barelyNames.join(", ")}` : ""}.`
        : ` Every item sold at least once a week on average over ${f.weeks} weeks.`;
      return {
        headline: `Your top ${f.topCount} of ${f.distinctItems} items bring in ${f.topSharePct}% of your item sales.`,
        evidence: `The other ${f.restCount} items bring in ${f.restSharePct}%.${slow}`,
        why: "Your best sellers carry the business, so running out of them costs you the most. Items that rarely sell still take space, stock and prep time.",
        action: f.barelyCount ? `Look over the ${f.barelyCount} slow items with your team. Keep any that have a reason to stay, like a regular's favorite or a seasonal special.` : "Check stock for your top sellers first each morning.",
        check: "In 2 weeks, see whether anyone missed an item you changed, and whether a top seller ran out.",
        caveat: "This uses sales, not profit. A slow item can still be worth keeping.",
      };
    },
    returning(f, s, meta, F) {
      return {
        headline: `Customers who came back brought in ${f.repeatSalesPct}% of the sales that could be linked to a customer.`,
        evidence: `${f.coveragePct}% of your orders were linked to a customer. Of those ${F.count(f.customers)} customers, ${F.count(f.repeatCustomers)} (${f.repeatCustPct}%) bought on two or more different days.`,
        why: "Regulars are often the steadiest part of a small business.",
        action: "For 2 weeks, try one small thing for regulars, like a punch card or remembering their usual order.",
        check: `In 2 weeks, see whether the share from returning customers moved from ${f.repeatSalesPct}%.`,
        caveat: "Square (or your file) only links some orders to a customer, so this covers part of your sales, not all of it.",
      };
    },
    channelMix(f, s, meta, F) {
      const top = f.channels[0];
      const keep = f.feesEntered && f.feeTakeHome !== null ? ` For the channels you added a fee to, you keep about ${F.money(f.feeTakeHome)} of ${F.money(f.feeSales)}.` : "";
      return {
        headline: `${adviceChannelName(top.key, "en")} brings in ${top.sharePct}% of your sales.${keep}`,
        evidence: f.channels.map((c) => `${adviceChannelName(c.key, "en")}: ${F.money(c.sales)} (${c.sharePct}%, ${F.count(c.receipts)} orders, ${F.money(c.avgOrder)} average)${c.feePct === null ? "" : `, fee ${c.feePct}%, about ${F.money(c.takeHome)} kept`}.`).join(" "),
        why: f.feesEntered ? "Sales are not what you keep. Apps and card fees take a cut, so a big channel can be worth less than it looks." : "Sales are not what you keep. Add your fees and Tally can estimate what each channel leaves you.",
        action: f.feesEntered ? "Before you spend money promoting one channel, compare what you keep per order in each." : "Add each channel's fee % below (it stays on this device) to see what you really keep.",
        check: "In 2 weeks, check whether the mix between channels has shifted.",
        caveat: [
          f.channels.some((c) => c.key === "__none") ? "Square does not mark dine-in, so orders with no pickup or delivery show as \"in person or not marked\"." : "",
          f.feesEntered ? "Take-home is an estimate from the fees you entered." : "",
          "This compares sales, not profit.",
        ].filter(Boolean).join(" "),
      };
    },
    breakEven(f, s, meta, F) {
      const g = f.gapPct;
      return {
        headline: g === null || g >= 0 ? `Your recent sales are about ${Math.abs(g || 0)}% above the break-even point from your numbers.` : `Your recent sales are about ${Math.abs(g)}% below the break-even point from your numbers.`,
        evidence: `With ${F.money(f.fixedMonthly)} of fixed costs a month and ${f.costPct}% of sales going to other costs, you need about ${F.money(f.breakEvenMonthly)} a month. Over the last ${f.days} days you averaged about ${F.money(f.avgMonthly)} a month.`,
        why: "Your break-even shows how much room you have in a slow month.",
        action: "Update your fixed costs and cost % when they change, so this stays close to real life.",
        check: "In 2 weeks, see whether your monthly pace moved closer to or further from break-even.",
        caveat: "An estimate from the numbers you typed in. It is not accounting or tax advice.",
      };
    },
    weatherAhead(f, s, meta, F) {
      const dow = F.dow(f.dow, "en");
      const kind = f.kind === "snow" ? "Snow" : "Rain";
      const lower = f.diffPct < 0;
      return {
        headline: `${kind} is forecast for ${dow}, ${F.date(f.date, "en")}. Your past ${f.kind === "snow" ? "snowy or rainy" : "rainy"} ${dow}s averaged ${Math.abs(f.diffPct)}% ${lower ? "less" : "more"} than your dry ${dow}s.`,
        evidence: `Wet ${dow}s: ${F.money(f.wetAvg)} a day on average (${f.wetDays} days). Dry ${dow}s: ${F.money(f.dryAvg)} (${f.dryDays} days). Weather data by Open-Meteo.com.`,
        why: lower ? "A slower day is a chance to save on prep and staff hours." : "A busier day needs more prep and more hands.",
        action: lower ? "Think about prepping a bit less fresh food that day, and try one rainy-day offer, like a warm drink deal." : "Prep a bit more of your top sellers and check who is working.",
        check: "After that day, compare its sales with the averages on this card.",
        caveat: "Forecasts change, and past rainy days show a pattern, not a promise.",
      };
    },
    eventAhead(f, s, meta, F) {
      const [name, plural] = ADVICE_EVENT_KINDS.en[f.kind] || ["A local date", "these dates"];
      const lower = f.diffPct < 0;
      return {
        headline: `${name} starts ${F.date(f.start, "en")}. Your past ${plural} averaged ${Math.abs(f.diffPct)}% ${lower ? "less" : "more"} a day than the weeks just before.`,
        evidence: `${f.pastPeriods} past period${f.pastPeriods === 1 ? "" : "s"} with ${f.pastDays} selling days: ${F.money(f.inAvg)} a day, against ${F.money(f.baseAvg)} in the weeks before. Dates from the Brandeis Registrar's academic calendar, typed into Tally by hand.`,
        why: lower ? "Knowing a slow stretch is coming helps you plan prep, orders and staff hours." : "Knowing a busy stretch is coming helps you stock up and staff up.",
        action: lower ? "Plan lighter ordering and shorter shifts for those days, or try one offer aimed at the people still around." : "Order a bit more of your top sellers and line up extra help.",
        check: "When it's over, compare those days with this card.",
        caveat: "Past periods show a pattern, not a promise. Weather and other events matter too.",
      };
    },
    priceVsMarket(f, s, meta, F) {
      const dir = (p) => (p >= 0 ? "rose" : "fell");
      return {
        headline: `Your prices on the same items ${dir(f.ownPct)} about ${Math.abs(f.ownPct)}% in a year. Restaurant prices across the U.S. ${dir(f.marketPct)} ${Math.abs(f.marketPct)}%.`,
        evidence: `Yours: ${f.items} items sold in both ${F.month(f.ownBaseMonth, "en")} and ${F.month(f.ownMonth, "en")}. U.S.: Consumer Price Index, food away from home, ${F.month(f.marketMonth, "en")} compared with a year before (U.S. Bureau of Labor Statistics).`
          + (f.localPct === null ? "" : ` Boston area: ${Math.abs(f.localPct)}% ${f.localPct >= 0 ? "higher" : "lower"} (${F.month(f.localMonth, "en")}).`),
        why: "This is background only. Your own costs and customers matter more than a national average.",
        action: "Next time you review your menu, look at your own ingredient and supply costs next to this.",
        check: "Look at this card again when the next month's number comes out.",
        caveat: "BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.",
      };
    },
  },

  zh: {
    noteImpact(f, s, meta, F) { // ZH-REVIEW (whole template)
      const label = adviceNoteLabel(f, "zh");
      const range = adviceRange(f.start, f.end, "zh", F);
      const p = Math.abs(f.diffPct || 0);
      const head = p < 3 ? `在${label}期间（${range}），销售额和类似的日子差不多。`
        : `在${label}期间（${range}），平均每天的销售额比类似的日子${f.diffPct > 0 ? "多" : "少"} ${p}%。`;
      const others = f.others.length ? ` 其他备注：${f.others.map((o) => `${adviceNoteLabel(o, "zh")} ${o.diffPct > 0 ? "+" : o.diffPct < 0 ? "-" : ""}${Math.abs(o.diffPct || 0)}%（比较了 ${o.compDays} 天）`).join("；")}。` : "";
      return {
        headline: head,
        evidence: `${f.periodDays} 个营业日平均每天 ${F.money(f.periodAvg)}，而 ${f.compDays} 个类似的日子平均每天 ${F.money(f.compAvg)}。类似的日子指同一个星期几，之前 ${f.beforeDays} 天、之后 ${f.afterDays} 天，不含节假日和其他有备注的日子。${others}`,
        why: "看清哪些改变对应着更好的日子，能帮你决定哪些值得再做。",
        action: f.isPromo ? "如果再做一次，每次只改一样（日期、优惠或宣传渠道），这样才能比较。" : "每次尝试新做法时都加一条“每日备注”，Tally 就能帮你比较。",
        check: "2 周后再看这张卡片。天数越多，比较越稳定。",
        caveat: "这只是比较，不能证明原因。天气、学校日程或其他因素也可能有变化。",
      };
    },
    priceChange(f, s, meta, F) { // ZH-REVIEW (whole template)
      const item = adviceItemName(f);
      const u = f.unitsChangePct;
      const move = u === null || Math.abs(u) < 3 ? "和之前差不多" : `比之前的每天 ${f.beforeUnitsPerDay} 份${u > 0 ? "多" : "少"} ${Math.abs(u)}%`;
      const orders = f.storeOrdersChangePct === null ? "" : Math.abs(f.storeOrdersChangePct) < 3 ? " 同一时期，你每天的总订单数基本没变。" : ` 同一时期，你每天的总订单数${f.storeOrdersChangePct > 0 ? "增加" : "减少"}了 ${Math.abs(f.storeOrdersChangePct)}%。`;
      const market = f.marketPct === undefined ? "" : ` 作为参考：截至${F.month(f.marketMonth, "zh")}的一年里，全美餐馆价格${f.marketPct >= 0 ? "上涨" : "下降"}了 ${Math.abs(f.marketPct)}%（美国劳工统计局）。`
        + (f.localPct === null || f.localPct === undefined ? "" : ` 波士顿地区${f.localPct >= 0 ? "上涨" : "下降"}了 ${Math.abs(f.localPct)}%（${F.month(f.localMonth, "zh")}）。`);
      return {
        headline: `大约从${F.date(f.changeDate, "zh")}起，${item}的价格从 ${F.money(f.oldPrice)} 变成了 ${F.money(f.newPrice)}。之后每天卖出 ${f.afterUnitsPerDay} 份，${move}。`,
        evidence: `改价前：${f.beforeDays} 个营业日卖出 ${F.count(f.unitsBefore)} 份（${adviceRange(f.beforeFrom, f.beforeTo, "zh", F)}）。改价后：${f.afterDays} 个营业日卖出 ${F.count(f.unitsAfter)} 份（${adviceRange(f.afterFrom, f.afterTo, "zh", F)}）。它占所有售出商品的比例从 ${f.shareBeforePct}% 变为 ${f.shareAfterPct}%。${orders}${market}`,
        why: "比较改价前后的销量，可以看出顾客在新价格下是否还在买。",
        action: "每周留意这个商品的销量，并问问店员顾客有没有提到价格。",
        check: `2 周后，看看它是否仍占售出商品的 ${f.shareAfterPct}% 左右。`,
        caveat: "前后对比不能证明原因。季节、天气和其他改变也会影响销售。",
      };
    },
    concentration(f, s, meta, F) { // ZH-REVIEW (whole template)
      const slow = f.barelyCount
        ? ` 在 ${f.weeks} 周里，有 ${f.barelyCount} 种商品平均每周卖不到一份${f.barelyNames.length ? `，例如 ${f.barelyNames.join("、")}` : ""}。`
        : ` 在 ${f.weeks} 周里，每种商品平均每周至少卖出一份。`;
      return {
        headline: `你 ${f.distinctItems} 种商品中最好卖的 ${f.topCount} 种，占了商品销售额的 ${f.topSharePct}%。`,
        evidence: `其余 ${f.restCount} 种商品占 ${f.restSharePct}%。${slow}`,
        why: "热销商品撑起了你的生意，所以它们缺货的代价最大。很少卖出的商品依然占用空间、库存和备料时间。",
        action: f.barelyCount ? `和团队一起看看这 ${f.barelyCount} 种卖得慢的商品。有理由保留的（比如老顾客最爱或季节限定）就留下。` : "每天早上先检查热销商品的库存。",
        check: "2 周后，看看有没有人想念你调整过的商品，热销商品有没有缺货。",
        caveat: "这里看的是销售额，不是利润。卖得慢的商品也可能值得保留。",
      };
    },
    returning(f, s, meta, F) { // ZH-REVIEW (whole template)
      return {
        headline: `在能对应到顾客的销售额中，回头客贡献了 ${f.repeatSalesPct}%。`,
        evidence: `你有 ${f.coveragePct}% 的订单能对应到某位顾客。在这 ${F.count(f.customers)} 位顾客中，有 ${F.count(f.repeatCustomers)} 位（${f.repeatCustPct}%）在两天或更多天里来买过。`,
        why: "常客往往是小店最稳定的收入来源。",
        action: "试 2 周为常客做一件小事，比如集点卡，或者记住他们常点的东西。",
        check: `2 周后，看看回头客的销售占比是否不再是 ${f.repeatSalesPct}%。`,
        caveat: "Square（或你的文件）只能把部分订单对应到顾客，所以这里只反映部分销售额。",
      };
    },
    channelMix(f, s, meta, F) { // ZH-REVIEW (whole template)
      const top = f.channels[0];
      const keep = f.feesEntered && f.feeTakeHome !== null ? `在你填写了费率的渠道中，${F.money(f.feeSales)} 的销售额里你大约能留下 ${F.money(f.feeTakeHome)}。` : "";
      return {
        headline: `${adviceChannelName(top.key, "zh")}带来了你 ${top.sharePct}% 的销售额。${keep}`,
        evidence: f.channels.map((c) => `${adviceChannelName(c.key, "zh")}：${F.money(c.sales)}（${c.sharePct}%，${F.count(c.receipts)} 笔订单，平均 ${F.money(c.avgOrder)}）${c.feePct === null ? "" : `，费率 ${c.feePct}%，约留下 ${F.money(c.takeHome)}`}。`).join(" "),
        why: f.feesEntered ? "销售额不等于你能留下的钱。外卖平台和刷卡手续费会抽成，所以大渠道的实际价值可能没有看起来那么高。" : "销售额不等于你能留下的钱。填上各渠道的费率，Tally 就能估算每个渠道给你留下多少。",
        action: f.feesEntered ? "在花钱推广某个渠道之前，先比较每个渠道每笔订单能留下多少。" : "在下面填上各渠道的费率（只保存在这台设备上），看看你实际能留下多少。",
        check: "2 周后，看看各渠道的比例有没有变化。",
        caveat: [
          f.channels.some((c) => c.key === "__none") ? "Square 不会标注堂食，所以没有自取或外送的订单显示为“店内或未标注”。" : "",
          f.feesEntered ? "实际收入是根据你填的费率估算的。" : "",
          "这里比较的是销售额，不是利润。",
        ].filter(Boolean).join(""),
      };
    },
    breakEven(f, s, meta, F) { // ZH-REVIEW (whole template)
      const g = f.gapPct;
      return {
        headline: g === null || g >= 0 ? `按你填的数字，你近期的销售额比保本点高约 ${Math.abs(g || 0)}%。` : `按你填的数字，你近期的销售额比保本点低约 ${Math.abs(g)}%。`,
        evidence: `每月固定成本 ${F.money(f.fixedMonthly)}，另有 ${f.costPct}% 的销售额用于其他成本，所以每月需要约 ${F.money(f.breakEvenMonthly)} 的销售额。过去 ${f.days} 天你平均每月约 ${F.money(f.avgMonthly)}。`,
        why: "知道保本点，就知道淡季时你还有多少余地。",
        action: "固定成本或成本比例有变化时就更新，让这个数字贴近实际。",
        check: "2 周后，看看你每月的销售节奏离保本点是更近还是更远。",
        caveat: "这是根据你填写的数字做的估算，不是会计或税务建议。",
      };
    },
    weatherAhead(f, s, meta, F) { // ZH-REVIEW (whole template)
      const dow = F.dow(f.dow, "zh");
      const kind = f.kind === "snow" ? "雪" : "雨";
      const lower = f.diffPct < 0;
      return {
        headline: `天气预报说${F.date(f.date, "zh")}（${dow}）有${kind}。过去下${kind}的${dow}，你的平均销售额比天晴的${dow}${lower ? "少" : "多"} ${Math.abs(f.diffPct)}%。`,
        evidence: `下雨或下雪的${dow}：平均每天 ${F.money(f.wetAvg)}（${f.wetDays} 天）。天晴的${dow}：${F.money(f.dryAvg)}（${f.dryDays} 天）。天气数据来自 Open-Meteo.com。`,
        why: lower ? "生意较淡的日子，是节省备料和人工的机会。" : "生意较忙的日子，需要多备料、多些人手。",
        action: lower ? "那天可以考虑少准备一些新鲜食物，并试一个雨天优惠，比如热饮套餐。" : "多准备一些热销商品，并确认当天的排班。",
        check: "那天过后，把当天的销售额和这张卡片上的平均数比一比。",
        caveat: "天气预报会变，过去的雨天只说明规律，不是保证。",
      };
    },
    eventAhead(f, s, meta, F) { // ZH-REVIEW (whole template)
      const [name, plural] = ADVICE_EVENT_KINDS.zh[f.kind] || ["本地日程", "这些日子"];
      const lower = f.diffPct < 0;
      return {
        headline: `${name}从${F.date(f.start, "zh")}开始。在你的数据里，过去的${plural}平均每天比之前几周${lower ? "少" : "多"} ${Math.abs(f.diffPct)}%。`,
        evidence: `过去 ${f.pastPeriods} 个时段共 ${f.pastDays} 个营业日：平均每天 ${F.money(f.inAvg)}，之前几周平均每天 ${F.money(f.baseAvg)}。日期来自 Brandeis 教务处的校历，由 Tally 手动录入。`,
        why: lower ? "提前知道淡季要来，有助于安排备料、进货和排班。" : "提前知道旺季要来，有助于多备货、多排人手。",
        action: lower ? "那几天可以少进一点货、缩短班次，或者试一个面向留在附近的人的优惠。" : "多订一些热销商品，并安排额外人手。",
        check: "结束后，把那几天的销售额和这张卡片比一比。",
        caveat: "过去的时段只说明规律，不是保证。天气和其他活动也有影响。",
      };
    },
    priceVsMarket(f, s, meta, F) { // ZH-REVIEW (whole template)
      const dir = (p) => (p >= 0 ? "上涨" : "下降");
      return {
        headline: `一年来，你同样商品的价格${dir(f.ownPct)}了约 ${Math.abs(f.ownPct)}%。全美餐馆价格${dir(f.marketPct)}了 ${Math.abs(f.marketPct)}%。`,
        evidence: `你的数字：比较了在${F.month(f.ownBaseMonth, "zh")}和${F.month(f.ownMonth, "zh")}都有卖出的 ${f.items} 种商品。全美数字：消费者价格指数“在外饮食”类，${F.month(f.marketMonth, "zh")}与一年前相比（美国劳工统计局）。`
          + (f.localPct === null ? "" : ` 波士顿地区${dir(f.localPct)}了 ${Math.abs(f.localPct)}%（${F.month(f.localMonth, "zh")}）。`),
        why: "这只是背景信息。你自己的成本和顾客比全国平均数更重要。",
        action: "下次检查菜单时，把你自己的食材和用品成本和这个数字放在一起看。",
        check: "下个月的数字公布后，再看看这张卡片。",
        caveat: "BLS.gov 无法为数据取出后所做的数据或分析作担保。",
      };
    },
  },
};

Object.assign(INSIGHT_TEMPLATES.en, ADVICE_TEMPLATES.en);
Object.assign(INSIGHT_TEMPLATES.zh, ADVICE_TEMPLATES.zh);

Object.assign(INSIGHT_STRINGS.en.names, {
  noteImpact: "Did my change work?", priceChange: "Price change check", concentration: "Where your sales come from",
  returning: "Returning customers", channelMix: "Sales by channel", breakEven: "Break-even",
  weatherAhead: "Weather ahead", eventAhead: "Coming up nearby", priceVsMarket: "Your prices vs restaurant prices",
});
Object.assign(INSIGHT_STRINGS.zh.names, { // ZH-REVIEW
  noteImpact: "我的改变有用吗？", priceChange: "改价检查", concentration: "销售额从哪里来",
  returning: "回头客", channelMix: "各渠道销售额", breakEven: "保本点",
  weatherAhead: "未来天气", eventAhead: "附近即将发生", priceVsMarket: "你的价格和餐馆整体价格",
});
Object.assign(INSIGHT_STRINGS.en.basis, {
  compDays: "{n} days compared", days: "{n} selling days", customers: "{n} customers", wetDays: "{n} wet days",
  pastDays: "{n} past selling days", items: "{n} items",
});
Object.assign(INSIGHT_STRINGS.zh.basis, { // ZH-REVIEW
  compDays: "比较了 {n} 天", days: "{n} 个营业日", customers: "{n} 位顾客", wetDays: "{n} 个雨雪天",
  pastDays: "过去 {n} 个营业日", items: "{n} 种商品",
});
Object.assign(INSIGHT_STRINGS.en.needs, {
  noNotes: "add a Day Note (like a promo or a closure) and Tally will compare it with similar days.",
  noteComparison: "needs {need} similar days to compare a note with; the best note has {have}.",
  noPriceChange: "no price change of {need}% or more that lasted two weeks was found.",
  noCustomerCodes: "this data doesn't link orders to customers.",
  customerCoverage: "needs at least {need}% of orders linked to a customer; you have {have}%.",
  customers: "needs {need} different customers; you have {have}.",
  noChannels: "this data doesn't say pickup, delivery or other order types.",
  weatherDays: "needs {need} past rainy and {need} dry days of that weekday; you have {have}.",
  eventHistory: "needs {need} past selling days in the same kind of period; you have {have}.",
  commonItems: "needs {need} items sold in both months; you have {have}.",
  salesSpread: "your sales are spread across your menu, and every item sells at least once a week. Nothing to flag.",
  pairsNotStrong: "some items are often bought together, but no pair stands out from how often each one sells on its own.",
});
Object.assign(INSIGHT_STRINGS.zh.needs, { // ZH-REVIEW
  noNotes: "添加一条每日备注（比如促销或停业），Tally 就会把它和类似的日子作比较。",
  noteComparison: "需要 {need} 个类似的日子来比较一条备注，目前最多的只有 {have} 个。",
  noPriceChange: "没有发现幅度在 {need}% 以上、并持续两周的价格变化。",
  noCustomerCodes: "这份数据没有把订单对应到顾客。",
  customerCoverage: "至少需要 {need}% 的订单对应到顾客，现在是 {have}%。",
  customers: "需要 {need} 位不同的顾客，现在有 {have} 位。",
  noChannels: "这份数据没有标明自取、外送或其他订单类型。",
  weatherDays: "这个星期几需要过去至少 {need} 个雨天和 {need} 个晴天，现在只有 {have} 个。",
  eventHistory: "同类时段需要过去 {need} 个营业日，现在有 {have} 个。",
  commonItems: "需要 {need} 种两个月都有卖出的商品，现在有 {have} 种。",
  salesSpread: "你的销售额分布在整个菜单上，每种商品每周至少卖出一份，没有需要提醒的。",
  pairsNotStrong: "有些商品经常一起被买，但没有哪一对比它们各自单独的销量更突出。",
});

// Impact illustrations: always a range, always labeled.
const ADVICE_IMPACT_TEXT = {
  en: {
    label: "An illustration, not a prediction",
    range: "About {low} to {high} a month",
    pairs: "If 1 in {rate} of the orders without it added it, at its usual price of {price}.",
    slowHours: "If those quiet hours sold {pct}% more than they do now.",
  },
  zh: { // ZH-REVIEW
    label: "仅作举例，不是预测",
    range: "每月约 {low} 至 {high}",
    pairs: "假设没点它的订单中每 {rate} 笔有 1 笔加点，按它平常的价格 {price} 计算。",
    slowHours: "假设这段清淡时间的销售额比现在多 {pct}%。",
  },
};
