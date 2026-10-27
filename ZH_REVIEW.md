# Chinese strings to review (advice upgrade, 2026-10-27)

Every Chinese string written or changed for the advice upgrade, by file and line. In the code each one is marked `ZH-REVIEW` (on the line or on the block it sits in). `{name}` parts are filled in by the app (numbers, item names, dates); keep them as they are. Please check meaning and tone (plain, friendly, about an 8th-grade level) and fix anything that reads like a machine translation.

Regenerate this list after edits by asking Claude, or search the code for ZH-REVIEW.

## public/js/advice-text.js (96)

| Line | Text |
|---|---|
| 15 | zh: { __none: "店内或未标注", Pickup: "自取", Delivery: "外送", Shipping: "邮寄", "Dine In": "堂食", Takeout: "外带", "Take Out": "外带", "For Here": "堂食", "To Go": "外带" },  |
| 18 | const ADVICE_CHANNEL_ZH_LOOSE = { dinein: "堂食", forhere: "堂食", takeout: "外带", togo: "外带", pickup: "自取", delivery: "外送", shipping: "邮寄", online: "网上订单" };  |
| 32 | zh: { promo: "你的促销", rainy: "雨天", festival: "节日活动", shortStaffed: "人手不足的一天" },  |
| 37 | zh: { finals: ["期末考试周", "期末考试周"], break: ["学校假期", "学校假期"], termStart: ["开学第一周", "开学第一周"], summer: ["暑假", "暑假"] },  |
| 42 | return lang === "zh" ? `${F.date(a, lang)}至${F.date(b, lang)}` : `${F.date(a, lang)} to ${F.date(b, lang)}`; |
| 51 | return (ADVICE_NOTE_TAGS[lang] \|\| {})[r.tag] \|\| r.tag \|\| (lang === "zh" ? "这条备注" : "this note");  |
| 182 | const head = p < 3 ? `在${label}期间（${range}），销售额和类似的日子差不多。` |
| 183 | : `在${label}期间（${range}），平均每天的销售额比类似的日子${f.diffPct > 0 ? "多" : "少"} ${p}%。`; |
| 184 | const others = f.others.length ? ` 其他备注：${f.others.map((o) => `${adviceNoteLabel(o, "zh")} ${o.diffPct > 0 ? "+" : o.diffPct < 0 ? "-" : ""}${Math.abs(o.diffPct \|\| 0)}%（比较了 ${o.compDays} 天）`).join("；")}。` : ""; |
| 187 | evidence: `${f.periodDays} 个营业日平均每天 ${F.money(f.periodAvg)}，而 ${f.compDays} 个类似的日子平均每天 ${F.money(f.compAvg)}。类似的日子指同一个星期几，之前 ${f.beforeDays} 天、之后 ${f.afterDays} 天，不含节假日和其他有备注的日子。${others}`, |
| 188 | why: "看清哪些改变对应着更好的日子，能帮你决定哪些值得再做。", |
| 189 | action: f.isPromo ? "如果再做一次，每次只改一样（日期、优惠或宣传渠道），这样才能比较。" : "每次尝试新做法时都加一条“每日备注”，Tally 就能帮你比较。", |
| 190 | check: "2 周后再看这张卡片。天数越多，比较越稳定。", |
| 191 | caveat: "这只是比较，不能证明原因。天气、学校日程或其他因素也可能有变化。", |
| 197 | const move = u === null \|\| Math.abs(u) < 3 ? "和之前差不多" : `比之前的每天 ${f.beforeUnitsPerDay} 份${u > 0 ? "多" : "少"} ${Math.abs(u)}%`; |
| 198 | const orders = f.storeOrdersChangePct === null ? "" : Math.abs(f.storeOrdersChangePct) < 3 ? " 同一时期，你每天的总订单数基本没变。" : ` 同一时期，你每天的总订单数${f.storeOrdersChangePct > 0 ? "增加" : "减少"}了 ${Math.abs(f.storeOrdersChangePct)}%。`; |
| 199 | const market = f.marketPct === undefined ? "" : ` 作为参考：截至${F.month(f.marketMonth, "zh")}的一年里，全美餐馆价格${f.marketPct >= 0 ? "上涨" : "下降"}了 ${Math.abs(f.marketPct)}%（美国劳工统计局）。` |
| 200 | + (f.localPct === null \|\| f.localPct === undefined ? "" : ` 波士顿地区${f.localPct >= 0 ? "上涨" : "下降"}了 ${Math.abs(f.localPct)}%（${F.month(f.localMonth, "zh")}）。`); |
| 202 | headline: `大约从${F.date(f.changeDate, "zh")}起，${item}的价格从 ${F.money(f.oldPrice)} 变成了 ${F.money(f.newPrice)}。之后每天卖出 ${f.afterUnitsPerDay} 份，${move}。`, |
| 203 | evidence: `改价前：${f.beforeDays} 个营业日卖出 ${F.count(f.unitsBefore)} 份（${adviceRange(f.beforeFrom, f.beforeTo, "zh", F)}）。改价后：${f.afterDays} 个营业日卖出 ${F.count(f.unitsAfter)} 份（${adviceRange(f.afterFrom, f.afterTo, "zh", F)}）。它占所有售出商品的比例从 ${f.shareBeforePct}% 变为 ${f.shareAfterPct}%。${orders}${market}`, |
| 204 | why: "比较改价前后的销量，可以看出顾客在新价格下是否还在买。", |
| 205 | action: "每周留意这个商品的销量，并问问店员顾客有没有提到价格。", |
| 206 | check: `2 周后，看看它是否仍占售出商品的 ${f.shareAfterPct}% 左右。`, |
| 207 | caveat: "前后对比不能证明原因。季节、天气和其他改变也会影响销售。", |
| 212 | ? ` 在 ${f.weeks} 周里，有 ${f.barelyCount} 种商品平均每周卖不到一份${f.barelyNames.length ? `，例如 ${f.barelyNames.join("、")}` : ""}。` |
| 213 | : ` 在 ${f.weeks} 周里，每种商品平均每周至少卖出一份。`; |
| 215 | headline: `你 ${f.distinctItems} 种商品中最好卖的 ${f.topCount} 种，占了商品销售额的 ${f.topSharePct}%。`, |
| 216 | evidence: `其余 ${f.restCount} 种商品占 ${f.restSharePct}%。${slow}`, |
| 217 | why: "热销商品撑起了你的生意，所以它们缺货的代价最大。很少卖出的商品依然占用空间、库存和备料时间。", |
| 218 | action: f.barelyCount ? `和团队一起看看这 ${f.barelyCount} 种卖得慢的商品。有理由保留的（比如老顾客最爱或季节限定）就留下。` : "每天早上先检查热销商品的库存。", |
| 219 | check: "2 周后，看看有没有人想念你调整过的商品，热销商品有没有缺货。", |
| 220 | caveat: "这里看的是销售额，不是利润。卖得慢的商品也可能值得保留。", |
| 225 | headline: `在能对应到顾客的销售额中，回头客贡献了 ${f.repeatSalesPct}%。`, |
| 226 | evidence: `你有 ${f.coveragePct}% 的订单能对应到某位顾客。在这 ${F.count(f.customers)} 位顾客中，有 ${F.count(f.repeatCustomers)} 位（${f.repeatCustPct}%）在两天或更多天里来买过。`, |
| 227 | why: "常客往往是小店最稳定的收入来源。", |
| 228 | action: "试 2 周为常客做一件小事，比如集点卡，或者记住他们常点的东西。", |
| 229 | check: `2 周后，看看回头客的销售占比是否不再是 ${f.repeatSalesPct}%。`, |
| 230 | caveat: "Square（或你的文件）只能把部分订单对应到顾客，所以这里只反映部分销售额。", |
| 235 | const keep = f.feesEntered && f.feeTakeHome !== null ? `在你填写了费率的渠道中，${F.money(f.feeSales)} 的销售额里你大约能留下 ${F.money(f.feeTakeHome)}。` : ""; |
| 237 | headline: `${adviceChannelName(top.key, "zh")}带来了你 ${top.sharePct}% 的销售额。${keep}`, |
| 238 | evidence: f.channels.map((c) => `${adviceChannelName(c.key, "zh")}：${F.money(c.sales)}（${c.sharePct}%，${F.count(c.receipts)} 笔订单，平均 ${F.money(c.avgOrder)}）${c.feePct === null ? "" : `，费率 ${c.feePct}%，约留下 ${F.money(c.takeHome)}`}。`).join(" "), |
| 239 | why: f.feesEntered ? "销售额不等于你能留下的钱。外卖平台和刷卡手续费会抽成，所以大渠道的实际价值可能没有看起来那么高。" : "销售额不等于你能留下的钱。填上各渠道的费率，Tally 就能估算每个渠道给你留下多少。", |
| 240 | action: f.feesEntered ? "在花钱推广某个渠道之前，先比较每个渠道每笔订单能留下多少。" : "在下面填上各渠道的费率（只保存在这台设备上），看看你实际能留下多少。", |
| 241 | check: "2 周后，看看各渠道的比例有没有变化。", |
| 243 | f.channels.some((c) => c.key === "__none") ? "Square 不会标注堂食，所以没有自取或外送的订单显示为“店内或未标注”。" : "", |
| 244 | f.feesEntered ? "实际收入是根据你填的费率估算的。" : "", |
| 245 | "这里比较的是销售额，不是利润。", |
| 252 | headline: g === null \|\| g >= 0 ? `按你填的数字，你近期的销售额比保本点高约 ${Math.abs(g \|\| 0)}%。` : `按你填的数字，你近期的销售额比保本点低约 ${Math.abs(g)}%。`, |
| 253 | evidence: `每月固定成本 ${F.money(f.fixedMonthly)}，另有 ${f.costPct}% 的销售额用于其他成本，所以每月需要约 ${F.money(f.breakEvenMonthly)} 的销售额。过去 ${f.days} 天你平均每月约 ${F.money(f.avgMonthly)}。`, |
| 254 | why: "知道保本点，就知道淡季时你还有多少余地。", |
| 255 | action: "固定成本或成本比例有变化时就更新，让这个数字贴近实际。", |
| 256 | check: "2 周后，看看你每月的销售节奏离保本点是更近还是更远。", |
| 257 | caveat: "这是根据你填写的数字做的估算，不是会计或税务建议。", |
| 262 | const kind = f.kind === "snow" ? "雪" : "雨"; |
| 265 | headline: `天气预报说${F.date(f.date, "zh")}（${dow}）有${kind}。过去下${kind}的${dow}，你的平均销售额比天晴的${dow}${lower ? "少" : "多"} ${Math.abs(f.diffPct)}%。`, |
| 266 | evidence: `下雨或下雪的${dow}：平均每天 ${F.money(f.wetAvg)}（${f.wetDays} 天）。天晴的${dow}：${F.money(f.dryAvg)}（${f.dryDays} 天）。天气数据来自 Open-Meteo.com。`, |
| 267 | why: lower ? "生意较淡的日子，是节省备料和人工的机会。" : "生意较忙的日子，需要多备料、多些人手。", |
| 268 | action: lower ? "那天可以考虑少准备一些新鲜食物，并试一个雨天优惠，比如热饮套餐。" : "多准备一些热销商品，并确认当天的排班。", |
| 269 | check: "那天过后，把当天的销售额和这张卡片上的平均数比一比。", |
| 270 | caveat: "天气预报会变，过去的雨天只说明规律，不是保证。", |
| 274 | const [name, plural] = ADVICE_EVENT_KINDS.zh[f.kind] \|\| ["本地日程", "这些日子"]; |
| 277 | headline: `${name}从${F.date(f.start, "zh")}开始。在你的数据里，过去的${plural}平均每天比之前几周${lower ? "少" : "多"} ${Math.abs(f.diffPct)}%。`, |
| 278 | evidence: `过去 ${f.pastPeriods} 个时段共 ${f.pastDays} 个营业日：平均每天 ${F.money(f.inAvg)}，之前几周平均每天 ${F.money(f.baseAvg)}。日期来自 Brandeis 教务处的校历，由 Tally 手动录入。`, |
| 279 | why: lower ? "提前知道淡季要来，有助于安排备料、进货和排班。" : "提前知道旺季要来，有助于多备货、多排人手。", |
| 280 | action: lower ? "那几天可以少进一点货、缩短班次，或者试一个面向留在附近的人的优惠。" : "多订一些热销商品，并安排额外人手。", |
| 281 | check: "结束后，把那几天的销售额和这张卡片比一比。", |
| 282 | caveat: "过去的时段只说明规律，不是保证。天气和其他活动也有影响。", |
| 286 | const dir = (p) => (p >= 0 ? "上涨" : "下降"); |
| 288 | headline: `一年来，你同样商品的价格${dir(f.ownPct)}了约 ${Math.abs(f.ownPct)}%。全美餐馆价格${dir(f.marketPct)}了 ${Math.abs(f.marketPct)}%。`, |
| 289 | evidence: `你的数字：比较了在${F.month(f.ownBaseMonth, "zh")}和${F.month(f.ownMonth, "zh")}都有卖出的 ${f.items} 种商品。全美数字：消费者价格指数“在外饮食”类，${F.month(f.marketMonth, "zh")}与一年前相比（美国劳工统计局）。` |
| 290 | + (f.localPct === null ? "" : ` 波士顿地区${dir(f.localPct)}了 ${Math.abs(f.localPct)}%（${F.month(f.localMonth, "zh")}）。`), |
| 291 | why: "这只是背景信息。你自己的成本和顾客比全国平均数更重要。", |
| 292 | action: "下次检查菜单时，把你自己的食材和用品成本和这个数字放在一起看。", |
| 293 | check: "下个月的数字公布后，再看看这张卡片。", |
| 294 | caveat: "BLS.gov 无法为数据取出后所做的数据或分析作担保。", |
| 309 | noteImpact: "我的改变有用吗？", priceChange: "改价检查", concentration: "销售额从哪里来", |
| 310 | returning: "回头客", channelMix: "各渠道销售额", breakEven: "保本点", |
| 311 | weatherAhead: "未来天气", eventAhead: "附近即将发生", priceVsMarket: "你的价格和餐馆整体价格", |
| 318 | compDays: "比较了 {n} 天", days: "{n} 个营业日", customers: "{n} 位顾客", wetDays: "{n} 个雨雪天", |
| 319 | pastDays: "过去 {n} 个营业日", items: "{n} 种商品", |
| 336 | noNotes: "添加一条每日备注（比如促销或停业），Tally 就会把它和类似的日子作比较。", |
| 337 | noteComparison: "需要 {need} 个类似的日子来比较一条备注，目前最多的只有 {have} 个。", |
| 338 | noPriceChange: "没有发现幅度在 {need}% 以上、并持续两周的价格变化。", |
| 339 | noCustomerCodes: "这份数据没有把订单对应到顾客。", |
| 340 | customerCoverage: "至少需要 {need}% 的订单对应到顾客，现在是 {have}%。", |
| 341 | customers: "需要 {need} 位不同的顾客，现在有 {have} 位。", |
| 342 | noChannels: "这份数据没有标明自取、外送或其他订单类型。", |
| 343 | weatherDays: "这个星期几需要过去至少 {need} 个雨天和 {need} 个晴天，现在只有 {have} 个。", |
| 344 | eventHistory: "同类时段需要过去 {need} 个营业日，现在有 {have} 个。", |
| 345 | commonItems: "需要 {need} 种两个月都有卖出的商品，现在有 {have} 种。", |
| 346 | salesSpread: "你的销售额分布在整个菜单上，每种商品每周至少卖出一份，没有需要提醒的。", |
| 347 | pairsNotStrong: "有些商品经常一起被买，但没有哪一对比它们各自单独的销量更突出。", |
| 359 | label: "仅作举例，不是预测", |
| 360 | range: "每月约 {low} 至 {high}", |
| 361 | pairs: "假设没点它的订单中每 {rate} 笔有 1 笔加点，按它平常的价格 {price} 计算。", |
| 362 | slowHours: "假设这段清淡时间的销售额比现在多 {pct}%。", |

## public/js/advice-view.js (63)

| Line | Text |
|---|---|
| 76 | startHereTitle: "从这里开始", |
| 77 | startHereIntro: "根据你自己的销售数据，本周最值得花时间的三件事。", |
| 78 | adviceSeeWhy: "查看原因", |
| 79 | advicePartSaw: "我们看到的", |
| 80 | advicePartWhy: "为什么重要", |
| 81 | advicePartTry: "可以试一件事", |
| 82 | advicePartCheck: "2 周后检查", |
| 83 | advicePartSure: "我们有多确定", |
| 84 | adviceUsefulQ: "这条建议有用吗？", |
| 85 | adviceUsefulYes: "有用", |
| 86 | adviceUsefulNo: "没用", |
| 87 | adviceUsefulThanks: "谢谢，这能帮助我们改进 Tally。", |
| 88 | adviceOutsideBadge: "使用外部数据", |
| 89 | adviceSourceBls: "来源：美国劳工统计局，消费者价格指数（CPI-U），在外饮食类。获取日期：{date}。", |
| 90 | adviceSourceOpenMeteo: "天气数据来自 Open-Meteo.com（CC BY 4.0）。", |
| 91 | adviceSourceLocalDates: "日期：Brandeis 大学教务处校历，人工录入；最后核对：{date}。", |
| 92 | adviceChartCompare: "类似的日子", adviceChartPeriod: "备注的日子", |
| 93 | adviceChartBefore: "改价前（每天）", adviceChartAfter: "改价后（每天）", |
| 94 | adviceChartTop: "热销商品", adviceChartRest: "其他所有商品", |
| 95 | adviceChartRepeat: "回头客", adviceChartOnce: "只来过一次的顾客", |
| 96 | adviceChartNeeded: "保本点", adviceChartActual: "你的节奏", |
| 97 | adviceChartDry: "晴天", adviceChartWet: "雨雪天", |
| 98 | adviceChartUsual: "之前几周", adviceChartPeriodDays: "这段时间内", |
| 99 | adviceChartYou: "你的价格", adviceChartMarket: "全美餐馆", |
| 100 | adviceChartWindow: "这两个小时", adviceChartRestOfDay: "一天中其他时间", |
| 101 | adviceChartTypical: "一般的两小时", adviceChartQuiet: "清淡的两小时", |
| 102 | adviceChartSlowHalf: "卖得慢的一半商品", adviceChartFastHalf: "卖得快的一半", |
| 103 | adviceChartAll: "所有订单", adviceChartWith: "含{item}的订单", |
| 104 | adviceChartSingle: "只有一样的订单", adviceChartMulti: "多样的订单", |
| 105 | adviceChartPrior: "之前 4 周", adviceChartRecent: "最近 4 周", |
| 106 | adviceFeesTitle: "填上费率，看看你实际能留下多少", |
| 107 | adviceFeesHint: "每个渠道从一笔销售中抽取的百分比（外卖平台佣金、刷卡手续费）。请用你自己合同或账单上的数字。仅作举例：如果平台每一美元抽走 20 美分，就填 20。只保存在这台设备上。", |
| 108 | adviceFeesSave: "保存费率", |
| 109 | adviceFeesClear: "清除", |
| 110 | adviceBreakEvenTitle: "填两个数字，看看你的保本点", |
| 111 | adviceBreakEvenHint: "固定成本是不随销售变化的开支，比如房租和保险。成本比例是每笔销售中用于食材、用品和手续费的部分。只保存在这台设备上。", |
| 112 | adviceBreakEvenFixed: "每月固定成本（美元）", |
| 113 | adviceBreakEvenCost: "成本占销售额的百分比", |
| 114 | adviceBreakEvenSave: "显示我的保本点", |
| 115 | adviceInputSaved: "已保存在这台设备上。", |
| 116 | adviceMoreTitle: "你的数据里还有这些", |
| 117 | adviceNotEnoughTitle: "数据还不够", |
| 118 | ideasTitle: "一般性建议（不是来自你的数据）", |
| 119 | ideasIntro: "其他小餐饮店常用的做法。我们会挑选和你的数据情况相符的建议，但建议本身来自列出的来源，而不是你的销售数据。", |
| 120 | ideasSource: "来源：{source}。最后核对：{date}。", |
| 121 | ideasLink: "查看来源", |
| 122 | weatherOneTapTitle: "天气提示", |
| 123 | weatherOneTapBody: "开启天气功能后，如果过去的雨天对你来说生意偏淡（或偏忙），Tally 会提前提醒你。Tally 会把一个大致位置（约 1 公里范围）发送给免费的 Open-Meteo 服务，绝不会发送你的销售数据。", |
| 124 | weatherOneTapSquare: "为{place}开启天气", |
| 125 | weatherOneTapPlace: "你的 Square 店铺位置", |
| 126 | weatherOneTapZip: "添加城市或邮政编码", |
| 127 | weatherZipWhy: "只用来查询你附近的天气。只保存在这台设备上，不会存到 Tally 的服务器。", |
| 128 | dataNotesTitle: "关于这些数字", |
| 129 | dataNoteSquareRefunds: "“连接 Square”导入的销售额不包含退款，所以总数可能略高。上传 Square 导出文件即可看到退款。", |
| 130 | dataNoteFileRefunds: "你上传的文件中的退款已从总数中扣除，但部分退款没有扣除。", |
| 131 | dataNoteGross: "销售额为折扣前的金额，不含税和小费。", |
| 132 | dataNoteOverlap: "有 {days} 天（{first} 至 {last}）同时有“连接 Square”和上传文件的销售记录，所以这些天被计算了两次。", |
| 133 | dataNoteOverlapFix: "这些天只保留 Square 的记录", |
| 134 | dataNoteOverlapDone: "完成。这些天现在只使用你的 Square 销售记录。", |
| 135 | dataNoteMenuPrice: "“发展”页上的菜单图按价格而不是利润给商品排序，因为 Tally 不知道你的成本。", |
| 136 | overlapKeepSquare: "这些天使用 Square 的销售记录", |
| 137 | growMenuEngByPrice: "按价格，不是利润", |
| 138 | weatherUseSquare: "使用我在 Square 上的店铺位置", |

## public/data/ideas.js (16)

| Line | Text |
|---|---|
| 34 | title: { en: "A small offer for your quiet hours", zh: "为清淡时段准备一个小优惠" },  |
| 35 | description: { en: "Some shops add a simple set price (a drink and a snack) only during their slowest hours.", zh: "有些店只在最清淡的时段推出简单的套餐价（一杯饮料加一份小食）。" },  |
| 45 | title: { en: "Train staff to suggest one add-on", zh: "培训员工推荐一样加购" },  |
| 46 | description: { en: "Asking one short question at the register (\"Would you like a muffin with that?\") is a common way to test add-on sales.", zh: "在收银时问一句简短的话（“要不要配一个松饼？”）是测试加购的常见方法。" },  |
| 56 | title: { en: "A shorter menu for delivery apps", zh: "为外卖平台准备精简菜单" },  |
| 57 | description: { en: "Some restaurants list fewer items on delivery apps, choosing ones that travel well.", zh: "有些餐馆在外卖平台上只列出较少的商品，挑选适合外送的品种。" },  |
| 67 | title: { en: "A simple punch card", zh: "简单的集点卡" },  |
| 68 | description: { en: "A paper or digital punch card is a low-cost way small cafes try to bring first-time customers back.", zh: "纸质或电子集点卡是小咖啡店吸引首次顾客再次光临的低成本方法。" },  |
| 78 | title: { en: "Review the menu on a schedule", zh: "定期检查菜单" },  |
| 79 | description: { en: "Many owners look over slow items once a season instead of all at once, keeping favorites with a reason to stay.", zh: "很多店主每季检查一次卖得慢的商品，而不是一次全改，有理由保留的就留下。" },  |
| 89 | title: { en: "Give your slow day a reason to visit", zh: "给生意淡的那一天一个来店的理由" },  |
| 90 | description: { en: "A weekly theme on the slowest weekday (a special, a study night, a local group) is a common small-business test.", zh: "在最淡的那一天办一个每周主题（特价、自习夜、本地社团活动）是小商家常见的尝试。" },  |
| 100 | title: { en: "Explain a price change on the menu board", zh: "在菜单板上说明价格调整" },  |
| 101 | description: { en: "Some shops post a short, honest note when prices change (for example, rising ingredient costs).", zh: "有些店在调价时会贴一段简短、诚恳的说明（例如食材成本上涨）。" },  |
| 111 | title: { en: "A combo for one-item orders", zh: "为只点一样的顾客准备组合" },  |
| 112 | description: { en: "When most orders are one item, a clearly priced combo near the register is a common thing to test.", zh: "如果大多数订单只有一样商品，在收银台附近放一个标价清楚的组合是常见的尝试。" },  |

## public/js/translations.js (4)

| Line | Text |
|---|---|
| 811 | landingFeatureBilingualBody: "图表、建议和菜单（包括隐私说明页面）都可以随时一键切换中英文。",  |
| 974 | localCalIntro: "可选。在每周对比旁边列出附近学校的日期；如果期末考试或假期对你来说生意偏淡或偏忙，还会提前提醒你。它不会改变任何平均值。如果你的店在校园附近，会自动开启。",  |
| 1422 | settingOutsideDataExplain: "开启后，你的浏览器会把一个大致位置（纬度和经度四舍五入到小数点后两位，约 1 公里范围）和日期范围直接发送给免费的 Open-Meteo 天气服务，这样你的仪表盘就能在销售数据旁显示天气，并在过去生意偏淡的雨天之前提醒你。你的销售数字、商品名称和店名永远不会被发送出去。默认是关闭的。",  |
| 1461 | squareCardPrivacy: "工作方式：连接 Square 的同时也会登录你的 Tally 账户。你的 Square 登录密钥会加密保存在 Tally 的服务器上，这样你点击“立即同步”时，或在距离上次同步超过 6 小时后打开 Tally 时，才能读取销售记录。销售数据本身会直接传到这个浏览器，只保存在本设备上——除非你主动把报告摘要保存到账户。你店铺的大致位置（约 1 公里范围，没有街道地址）也会传到这个浏览器，用于一键开启天气；Tally 的服务器不保存它。",  |

## public/js/insight-text.js (2)

| Line | Text |
|---|---|
| 225 | headline: `买${f.anchor}的订单里，大约每 ${f.oneIn} 笔就有 1 笔同时买了${f.addOn}（${f.withPct}%）。`,  |
| 228 | action: `接下来 2 周试一试：让员工在顾客点${f.anchor}时顺口推荐${f.addOn}，或者把两样搭配成套餐摆在一起。`,  |

## public/privacy.html, Chinese section (58)

| Line | Text |
|---|---|
| 116 | 隐私：Tally 读取、保存和显示什么 |
| 117 | Tally 是一个由学生开发的销售分析工具，面向小餐馆和咖啡店。本页如实说明这个应用目前的做法。最后更新：2026年10月27日。 |
| 119 | 你的销售数据留在你的浏览器里 |
| 121 | 所有图表、分析和建议都是在你的浏览器里按 Tally 写好的固定规则算出来的。你的销售数据绝不会发送给 AI 服务或任何其他外部公司。 |
| 122 | Tally 的服务器从不保存你的销售数据。 |
| 125 | 如果你只是上传文件 |
| 127 | 你的销售文件只在这台设备的这个浏览器里读取和保存，不会上传到 Tally。 |
| 128 | 如果你选择了顾客列（电话、邮箱、会员号、姓名或 Square 顾客 ID），这些内容会先在你的设备上被打乱，然后才保存。只保留打乱后的代码，用来统计新顾客和回头客。 |
| 129 | 不需要账户，也没有广告。唯一会被统计的是下面“匿名步骤统计”中说明的匿名步骤，其中绝不包含你的销售数据。 |
| 132 | 如果你连接 Square |
| 133 | 连接 Square 的同时也会登录一个 Tally 账户。Tally 向 Square 申请的是只读权限：你的商家名称和门店，以及已完成的订单。它永远不能收款、退款或更改 Square 里的任何东西。 |
| 134 | 保存在 Tally 服务器（一个 Cloudflare 数据库）上的内容： |
| 136 | 你的 Square 商家 ID 和商家名称。 |
| 137 | Square 为你的账户发放的访问密钥，已加密。 |
| 138 | 你上次同步的时间，以及你的登录会话（以打乱的形式保存，所以拿到数据库副本也无法冒充你登录）。 |
| 140 | 你的销售数据本身只是经过服务器传到你的浏览器，并且只保存在你的设备上，和上传文件一样。如果 Square 把某笔订单关联到了某位顾客，它的匿名顾客 ID（一个代码，不是姓名）会在你的设备上被打乱，只保留打乱后的代码，用于“回头客”页面。 |
| 141 | Tally 从每笔订单中保留的内容：日期、时间、商品名称、数量、价格、订单类型（例如自取）、Square 的订单 ID 和上面说的打乱后的顾客代码。没有别的。 |
| 142 | 你的店铺位置：同步时，Tally 的服务器还会把你第一家 Square 门店所在的城镇和地图位置传给你的浏览器，位置精确到约 1 公里（没有街道地址）。它只保存在你的浏览器里，让你一键开启天气提示；如果你在 Brandeis 附近，还能看到校历相关的提示。Tally 的服务器不保存它。 |
| 143 | 打开 Tally 时同步：如果距离上次同步已超过 6 小时，打开 Tally 时会自动获取新订单，和按“同步”按钮一样。Tally 关闭时不会在后台同步，也不会发送电子邮件。 |
| 144 | 丢弃的内容：Tally 不会读取你的 Square 顾客名录。但 Square 发来的订单信息可能多于 Tally 需要的，例如自取或外送订单上的姓名和联系方式，或付款的卡品牌和卡号后四位。Tally 的服务器会跳过并立即丢弃这些内容：它们从不被保存、显示或发送到你的浏览器。 |
| 146 | 你自己选择填写的数字 |
| 147 | 有些建议允许你填一个数字，例如外卖平台的费率、每月固定成本，或用于天气的城市或邮政编码。这些都是可选的，并且只保存在这个浏览器里，绝不会发送到 Tally 的服务器。（你输入的城市或邮政编码会发送给 Open-Meteo 的地点搜索，见下文。） |
| 149 | 外部服务 |
| 151 | 天气（Open-Meteo），在你开启之前一直关闭。开启后，你的浏览器会把精确到约 1 公里的位置和所需的日期范围发送给免费的天气服务 Open-Meteo（如果你搜索地点，还会发送你输入的城市或邮政编码）。绝不会发送你的销售额、商品或商家名称。和访问任何网站一样，Open-Meteo 也能看到你设备的网络地址。天气数据来自 Open-Meteo.com（CC BY 4.0）。 |
| 152 | 餐馆价格指数（美国劳工统计局）。Tally 的服务器定期下载这项公开统计数据并保存一份副本。你的浏览器再向 Tally 的服务器索取，这个请求不包含任何关于你的信息：没有销售数据、没有位置、没有账户。美国劳工统计局不会知道你的任何信息。来源：bls.gov。 |
| 153 | 学校日期（Brandeis 大学）。根据教务处公开的校历手动录入 Tally，不会联网查询。 |
| 154 | “一般性建议（不是来自你的数据）”。由 Tally 运营者编写的一个简短列表，每条都注明来源。挑选显示哪些建议是在你的浏览器里完成的。 |
| 157 | 如果你选择“把这份报告保存到我的账户” |
| 158 | 保存是可选的，在你按下按钮之前不会保存。每份保存的报告只包含一份摘要： |
| 160 | 日期范围、总销售额、订单数和平均订单金额。 |
| 161 | 每个星期几和每个小时的平均销售额。 |
| 162 | 你的前 10 名商品（名称、卖出数量、销售额）。 |
| 163 | 仪表盘上显示的分析句子。 |
| 165 | 它绝不包含单笔销售、小票、顾客信息或银行卡信息。 |
| 167 | 匿名步骤统计 |
| 168 | 为了了解 Tally 哪里让人困惑，它可以统计一些步骤，例如“打开了 Tally”、“查看了商品页”、“点击了加载示例数据”、“文件无法识别：日期”、“连接了 Square”、“看到了报告”或“2 分钟后仍在页面上”。只有在网站开启这项功能后才会统计，之前没有任何记录。 |
| 170 | 每个步骤只保存一个固定名称、时间和一个由你的浏览器生成的随机 ID。这个 ID 不是设备指纹，使用删除我的所有数据后会更换。 |
| 171 | 页面和按钮按 Tally 代码给它们起的名字记录（例如 “items” 或 “chooseFileBtn”），绝不记录屏幕上的内容或你输入的任何内容。 |
| 172 | 对于建议卡片，会记录显示了哪些类型的卡片（例如“一起购买的商品”，每天一次），以及你对“这条建议有用吗？”的有用／没用回答。绝不记录卡片上的文字或数字。 |
| 173 | 你打开 Tally 时，还会记录：把你带到这里的网站（只有网站名，例如 “reddit.com”，不含具体页面）、链接中的标签（如果有，例如 ?ref=reddit）、大致的设备类型（手机、平板或电脑，根据屏幕宽度判断），以及 Cloudflare 根据连接判断出的国家。你的 IP 地址本身不会被保存。 |
| 174 | 它绝不包含你的销售额、商品名称、金额、文件内容、商家名称、你输入的任何内容、你的 IP 地址或你的位置。 |
| 175 | 只有 Tally 的管理员能在一个私密页面上看到这些数据，形式是计数和匿名的逐步访问记录（“访客 12 打开了商品页”）。这些数据绝不出售或分享。 |
| 176 | 如果你的浏览器发送“全球隐私控制”或“请勿跟踪”信号，就什么都不统计。你也可以在任何设备上打开一次 bus-idea.pages.dev/?notrack=1 来关闭统计。 |
| 179 | “提供反馈”链接 |
| 180 | 反馈链接和它的二维码会在新标签页中打开一个 Google 表单。这个链接对每个人都一样：Tally 不会在里面添加任何内容，也不会把你的销售、商家或账户信息发送给表单。二维码是在你的浏览器里生成的，不经过在线服务。你在表单里填写的内容会交给 Google 和 Tally 的运营者，并受 Google 自己的隐私政策约束，所以请不要填写你不想分享的内容。 |
| 182 | 谁能看到 |
| 184 | 你自己，在任何一个用 Square 登录的浏览器上。 |
| 185 | Tally 没有任何页面或功能能让其他人（包括 Tally 的管理员）读取你保存的报告或你的 Square 数据。 |
| 186 | 坦白地说：Tally 的运营者管理着这个数据库所在的 Cloudflare 账户，技术上可以打开它。我们不会这样做，而且 Square 密钥是加密保存的。如果你无法接受这一点，可以继续使用 Tally，但不连接 Square、不保存报告，其他功能都一样。 |
| 189 | 删除你的数据 |
| 191 | 在“我的数据”页面的账户卡片中，可以删除一份保存的报告，或删除我保存的所有报告。 |
| 192 | 退出登录会结束该浏览器中的会话，你保存的报告仍然保留。 |
| 193 | 断开连接并删除账户会撤销 Tally 的 Square 访问权限，并删除你保存的密钥、会话、报告和账户。 |
| 194 | 你也可以随时在 Square 后台的“应用”部分移除 Tally。 |
| 195 | 保存在这个浏览器里的销售数据、备注、你填写的数字、大致位置和天气数据，可以在“我的数据”页面用删除我的所有数据一并删除。 |
| 198 | ← 返回 Tally |
| 210 | btn.textContent = isZh ? "English" : "中文"; |
| 211 | document.title = isZh ? "Tally 隐私说明" : "Tally privacy"; |
