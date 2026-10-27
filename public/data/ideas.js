// IDEAS LIBRARY -- hand-curated general ideas, edited by Brandon.
//
// These are NOT from the owner's data. They appear in the section
// "General ideas (not from your data)", with their source and date, and only
// when the owner's data matches the entry's `when` rule.
//
// An entry is hidden from owners when:
//   - placeholder is true (every starter entry below, until you replace it), or
//   - lastReviewed is more than 12 months ago (ADVICE_CONFIG.staleDays.ideasReview), or
//   - sourceUrl is missing or doesn't start with https://
// Hidden entries are listed on the Founder page as your monthly review list.
//
// HOW TO ADD OR FIX AN ENTRY
//   1. Find a real, public source you have read yourself (a trade group,
//      government small-business page, university extension, etc.).
//   2. Write the idea in your own words (do not copy the source's text).
//   3. Fill in every field, set placeholder: false, set lastReviewed to today.
//   4. Chinese text: write it or leave the English (it shows as a fallback).
//
// FIELDS
//   id            short unique code, letters and dashes
//   title / description   { en, zh } -- one sentence each, plain words
//   when          one of: always, quietHoursFound, pairsFound,
//                 manySingleItemOrders, highDeliveryShare, lowRepeatShare,
//                 manySlowItems, bigWeekdayGap, priceChanged
//   businessTypes ["all"] or any of: cafe, bakery, bar, restaurant, general
//   sourceName / sourceUrl   where the idea comes from
//   lastReviewed  "YYYY-MM-DD" -- the day you last checked the source
//   placeholder   true = not shown to owners

const TALLY_IDEAS = [
  {
    id: "quiet-hour-offer",
    title: { en: "A small offer for your quiet hours", zh: "为清淡时段准备一个小优惠" }, // ZH-REVIEW
    description: { en: "Some shops add a simple set price (a drink and a snack) only during their slowest hours.", zh: "有些店只在最清淡的时段推出简单的套餐价（一杯饮料加一份小食）。" }, // ZH-REVIEW
    when: "quietHoursFound",
    businessTypes: ["all"],
    sourceName: "TO BE VERIFIED BY BRANDON",
    sourceUrl: "",
    lastReviewed: "",
    placeholder: true,
  },
  {
    id: "suggest-the-pair",
    title: { en: "Train staff to suggest one add-on", zh: "培训员工推荐一样加购" }, // ZH-REVIEW
    description: { en: "Asking one short question at the register (\"Would you like a muffin with that?\") is a common way to test add-on sales.", zh: "在收银时问一句简短的话（“要不要配一个松饼？”）是测试加购的常见方法。" }, // ZH-REVIEW
    when: "pairsFound",
    businessTypes: ["all"],
    sourceName: "TO BE VERIFIED BY BRANDON",
    sourceUrl: "",
    lastReviewed: "",
    placeholder: true,
  },
  {
    id: "delivery-menu",
    title: { en: "A shorter menu for delivery apps", zh: "为外卖平台准备精简菜单" }, // ZH-REVIEW
    description: { en: "Some restaurants list fewer items on delivery apps, choosing ones that travel well.", zh: "有些餐馆在外卖平台上只列出较少的商品，挑选适合外送的品种。" }, // ZH-REVIEW
    when: "highDeliveryShare",
    businessTypes: ["restaurant", "cafe", "general"],
    sourceName: "TO BE VERIFIED BY BRANDON",
    sourceUrl: "",
    lastReviewed: "",
    placeholder: true,
  },
  {
    id: "simple-loyalty",
    title: { en: "A simple punch card", zh: "简单的集点卡" }, // ZH-REVIEW
    description: { en: "A paper or digital punch card is a low-cost way small cafes try to bring first-time customers back.", zh: "纸质或电子集点卡是小咖啡店吸引首次顾客再次光临的低成本方法。" }, // ZH-REVIEW
    when: "lowRepeatShare",
    businessTypes: ["cafe", "bakery", "general"],
    sourceName: "TO BE VERIFIED BY BRANDON",
    sourceUrl: "",
    lastReviewed: "",
    placeholder: true,
  },
  {
    id: "menu-review-routine",
    title: { en: "Review the menu on a schedule", zh: "定期检查菜单" }, // ZH-REVIEW
    description: { en: "Many owners look over slow items once a season instead of all at once, keeping favorites with a reason to stay.", zh: "很多店主每季检查一次卖得慢的商品，而不是一次全改，有理由保留的就留下。" }, // ZH-REVIEW
    when: "manySlowItems",
    businessTypes: ["all"],
    sourceName: "TO BE VERIFIED BY BRANDON",
    sourceUrl: "",
    lastReviewed: "",
    placeholder: true,
  },
  {
    id: "slow-day-event",
    title: { en: "Give your slow day a reason to visit", zh: "给生意淡的那一天一个来店的理由" }, // ZH-REVIEW
    description: { en: "A weekly theme on the slowest weekday (a special, a study night, a local group) is a common small-business test.", zh: "在最淡的那一天办一个每周主题（特价、自习夜、本地社团活动）是小商家常见的尝试。" }, // ZH-REVIEW
    when: "bigWeekdayGap",
    businessTypes: ["all"],
    sourceName: "TO BE VERIFIED BY BRANDON",
    sourceUrl: "",
    lastReviewed: "",
    placeholder: true,
  },
  {
    id: "price-change-signage",
    title: { en: "Explain a price change on the menu board", zh: "在菜单板上说明价格调整" }, // ZH-REVIEW
    description: { en: "Some shops post a short, honest note when prices change (for example, rising ingredient costs).", zh: "有些店在调价时会贴一段简短、诚恳的说明（例如食材成本上涨）。" }, // ZH-REVIEW
    when: "priceChanged",
    businessTypes: ["all"],
    sourceName: "TO BE VERIFIED BY BRANDON",
    sourceUrl: "",
    lastReviewed: "",
    placeholder: true,
  },
  {
    id: "bundle-for-single-orders",
    title: { en: "A combo for one-item orders", zh: "为只点一样的顾客准备组合" }, // ZH-REVIEW
    description: { en: "When most orders are one item, a clearly priced combo near the register is a common thing to test.", zh: "如果大多数订单只有一样商品，在收银台附近放一个标价清楚的组合是常见的尝试。" }, // ZH-REVIEW
    when: "manySingleItemOrders",
    businessTypes: ["all"],
    sourceName: "TO BE VERIFIED BY BRANDON",
    sourceUrl: "",
    lastReviewed: "",
    placeholder: true,
  },
];
