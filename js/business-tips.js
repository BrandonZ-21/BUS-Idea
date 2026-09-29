// "Grow Your Business" logic: business-type detection from menu items, the
// menu-engineering matrix, and a curated, data-gated tip bank. Everything
// here is pure calculation (no DOM, no network, no AI) -- it takes rows (and
// a small context object built by app.js from stats it already computed)
// and returns plain data. app.js is responsible for turning tip ids into
// translated text.
//
// Deliberately NOT here: any lookup of real competitor businesses. There is
// no reliable free data source for "what similar businesses actually do,"
// and guessing would mean stating unverified things about real businesses.
// Instead this teaches general, well-known small-business concepts (menu
// engineering, customer lifetime value, demand variability, etc.) and only
// shows a tip when the user's OWN data actually supports it.

const BUSINESS_TYPE_KEYWORDS = {
  cafe: ["latte", "espresso", "cappuccino", "mocha", "macchiato", "americano", "cold brew", "drip coffee", "matcha", "chai", "croissant", "muffin", "scone", "bagel", "coffee", "iced tea"],
  bakery: ["bread", "loaf", "cake", "cupcake", "cookie", "pastry", "danish", "donut", "doughnut", "pie", "tart", "baguette", "sourdough", "cinnamon roll", "brownie", "biscotti"],
  bar: ["beer", "ipa", "lager", "cocktail", "wine", "margarita", "whiskey", "vodka", "gin", "rum", "tequila", "draft", "pint", "mojito", "martini", "sangria"],
  restaurant: ["entree", "steak", "salmon", "pasta", "burger", "sandwich", "salad", "soup", "appetizer", "burrito", "taco", "pizza", "chicken", "fries", "panini", "wrap"],
};

// Scores each business type by how many DISTINCT item names contain one of
// its keywords, and returns the type with the highest score, or "general"
// if nothing scores above zero (or it's a tie at zero).
function detectBusinessType(rows) {
  const distinctItems = Array.from(new Set(rows.map((r) => (r.item || "").toLowerCase())));
  const scores = { cafe: 0, bakery: 0, bar: 0, restaurant: 0 };
  distinctItems.forEach((item) => {
    Object.keys(BUSINESS_TYPE_KEYWORDS).forEach((type) => {
      if (BUSINESS_TYPE_KEYWORDS[type].some((kw) => item.includes(kw))) scores[type]++;
    });
  });
  let best = "general", bestScore = 0;
  Object.keys(scores).forEach((type) => {
    if (scores[type] > bestScore) { best = type; bestScore = scores[type]; }
  });
  return best;
}

function median(nums) {
  const sorted = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Classic hospitality-management "menu engineering" matrix: each item is
// plotted by popularity (units sold) vs. price into four quadrants. This is
// a PRICE-based proxy for the real version of this framework, which uses
// profit margin per item -- this app has no ingredient-cost data, so price
// stands in for it. Returns null if there aren't enough distinct items for
// a median split to mean anything.
function computeMenuEngineering(rows) {
  const byItem = new Map();
  rows.forEach((r) => {
    const cur = byItem.get(r.item) || { item: r.item, quantity: 0, revenue: 0, priceSum: 0, priceCount: 0 };
    cur.quantity += r.quantity;
    cur.revenue += r.price * r.quantity;
    cur.priceSum += r.price;
    cur.priceCount += 1;
    byItem.set(r.item, cur);
  });
  const items = Array.from(byItem.values()).map((x) => ({
    item: x.item, quantity: x.quantity, revenue: x.revenue, avgPrice: x.priceSum / x.priceCount,
  }));
  if (items.length < 4) return null;

  const medianQty = median(items.map((x) => x.quantity));
  const medianPrice = median(items.map((x) => x.avgPrice));

  items.forEach((x) => {
    const popular = x.quantity >= medianQty;
    const pricey = x.avgPrice >= medianPrice;
    x.quadrant = popular && pricey ? "star" : popular && !pricey ? "plowhorse" : !popular && pricey ? "puzzle" : "dog";
  });

  return { items: items.sort((a, b) => b.quantity - a.quantity), medianQty, medianPrice };
}

// Each rule reads a small pre-computed context (built by app.js from stats
// it already has elsewhere -- repeat rate, order-type split, top-item
// share, etc.) and either returns null (doesn't apply / not enough
// evidence) or { id, vars } for app.js to render with translated text.
// Thresholds here are this app's own editorial judgment calls (same as
// FACTOR_MIN_PCT_DIFF elsewhere), not a cited external statistic.
const TIP_RULES = [
  // Low 30-day repeat rate -> loyalty program nudge (customer lifetime value).
  (ctx) => {
    if (!ctx.hasCustomerData || ctx.repeatRate30 === null) return null;
    if (ctx.repeatRate30 < 35) return { id: "loyaltyProgram", vars: { pct: ctx.repeatRate30 } };
    return null;
  },
  // High repeat rate -> positive reinforcement + protect-it framing.
  (ctx) => {
    if (!ctx.hasCustomerData || ctx.repeatRate30 === null) return null;
    if (ctx.repeatRate30 >= 55) return { id: "strongRepeat", vars: { pct: ctx.repeatRate30 } };
    return null;
  },
  // Very low delivery share -> channel-diversification nudge (not for bars).
  (ctx) => {
    if (!ctx.hasOrderTypeData || ctx.businessType === "bar" || ctx.deliveryPct === null) return null;
    if (ctx.deliveryPct < 10) return { id: "deliveryGap", vars: { pct: Math.round(ctx.deliveryPct) } };
    return null;
  },
  // One item dominates revenue -> concentration risk / cross-sell nudge.
  (ctx) => {
    if (ctx.topItemPct === null) return null;
    if (ctx.topItemPct >= 25) return { id: "menuConcentrationRisk", vars: { pct: Math.round(ctx.topItemPct) } };
    return null;
  },
  // A large share of the menu rarely sells -> menu-engineering trim nudge.
  (ctx) => {
    if (ctx.distinctItemCount < 8 || ctx.rareItemRatio === null) return null;
    if (ctx.rareItemRatio >= 0.3) return { id: "manyRareItems", vars: { pct: Math.round(ctx.rareItemRatio * 100) } };
    return null;
  },
  // Big best-day/worst-day gap -> demand variability & staffing nudge.
  (ctx) => {
    if (ctx.dowGapPct === null) return null;
    if (ctx.dowGapPct >= 40) return { id: "weekdayWeekendGap", vars: { pct: Math.round(ctx.dowGapPct) } };
    return null;
  },
  // Reuses the dashboard's own weather-comparison insight, if it fired.
  (ctx) => (ctx.hasWeatherInsight ? { id: "weatherSensitive", vars: {} } : null),
  // Reuses the dashboard's own daylight/sunset insight, if it fired.
  (ctx) => (ctx.hasDaylightInsight ? { id: "daylightSensitive", vars: {} } : null),
  // Reuses the dashboard's own holiday-impact insight, if it fired.
  (ctx) => (ctx.hasHolidayInsight ? { id: "holidayPlanning", vars: {} } : null),
  // Plenty of history but no Marketing/Promo notes logged yet -> nudge to try one.
  (ctx) => {
    if (ctx.hasPromoNotes || ctx.weeks < 8) return null;
    return { id: "noPromosLogged", vars: {} };
  },
  // Business-type-specific tips, to show the detection actually changes content.
  (ctx) => (ctx.businessType === "bar" ? { id: "barHappyHour", vars: {} } : null),
  (ctx) => (ctx.businessType === "bakery" ? { id: "bakeryPerishables", vars: {} } : null),
];

function generateBusinessTips(ctx) {
  return TIP_RULES.map((rule) => rule(ctx)).filter(Boolean);
}
