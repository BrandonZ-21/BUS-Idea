// Every number that decides WHEN Tally gives a piece of advice lives in this
// one file, so it can be tuned without reading any other code. These are
// Tally's own judgment calls (how much data is "enough"), not statistics
// from an outside study. Change a number, reload the page, done.
//
// Loaded before js/insights.js and js/advice.js (see index.html and the
// test pages in tests/).

// ---- The original advice rules (js/insights.js) ----------------------------
const INSIGHT_MIN = {
  sellingDays: 14, // nothing at all is offered on less than two weeks of selling
  timedDays: 14, // selling days with a time of day, for any hour-based rule
  weekdayOccurrences: 4, // of EACH weekday being compared
  weekdaysCompared: 3,
  weekdayGapPct: 15,
  regularHours: 4,
  itemUnits: 50,
  distinctItems: 8,
  longTailItems: 12,
  longTailWeeks: 8,
  pairReceipts: 20, // receipts containing both items
  pairItemReceipts: 30, // receipts containing each item
  pairLift: 1.5,
  receipts: 200,
  singleItemSharePct: 40,
  trendWindowDays: 28,
  trendSellingDays: 14, // in each 28-day window
  months: 4,
  monthSellingDays: 15,
  monthGapPct: 20,
  refundPayments: 200,
  groupReceipts: 50, // per channel or location being compared
};

const ADVICE_CONFIG = {
  // ONE SWITCH for every outside source (BLS prices, weather tips, local
  // dates). false = all outside-data cards disappear; nothing else changes.
  // There is also an instant switch on the Founder page (no deploy needed).
  outsideData: true,

  // ---- New advice rules (js/advice.js) -------------------------------------
  min: {
    // "Did my change work?" (a Day Note or promo vs similar days)
    noteComparisonDays: 4, // same-weekday days to compare against, at least
    noteLookbackWeeks: 6, // how far back (and forward) to look for those days
    noteMaxCards: 3, // notes listed in the details; the newest one is the headline

    // Price change check
    priceChangePct: 5, // a price move smaller than this is ignored
    priceStableDays: 14, // the old and the new price must each last this many days
    priceUnitsEachSide: 30, // units sold before AND after, at least
    priceWindowDays: 56, // compare at most this many days on each side

    // Concentration
    concentrationItems: 8, // different items needed
    concentrationWeeks: 4,
    barelySellsPerWeek: 1, // under 1 sold a week = "barely sells"

    // Returning customers
    customerCoveragePct: 20, // share of receipts that carry a customer code
    customers: 30, // different customers seen

    // Channels
    channelReceipts: 30, // receipts in a channel before it's listed on its own

    // Weather-ahead tip (needs weather turned on)
    weatherDaysEach: 4, // past wet AND dry days of that weekday
    weatherGapPct: 10, // smaller differences aren't worth a tip

    // Local-dates tip (finals week, breaks...)
    eventPastPeriods: 1, // past periods of the same kind in the data
    eventSellingDays: 5, // selling days inside those past periods
    eventGapPct: 10,
    eventLookaheadDays: 10, // how far ahead a coming period is mentioned

    // Your prices vs restaurant prices (needs a year of data)
    priceVsMarketItems: 5, // items sold both this month and a year ago
  },

  // Impact ranges are an ILLUSTRATION: a simple estimate, widened by this
  // much on each side (0.5 = from half to one and a half times the estimate).
  impactSpread: 0.5,
  impactAddOnRate: 0.1, // "if 1 in 10 of the orders without it added it"
  impactQuietLiftPct: 10, // "if your quiet two hours sold 10% more"

  // Auto-sync from Square when the app opens, if the last sync is older than this.
  autoSyncHours: 6,

  // ---- Outside data freshness --------------------------------------------
  // A value older than this (days since its "as of" date or last review) is
  // hidden from owners and flagged on the Founder page. The server uses the
  // same numbers (lib/outside/config.js) -- keep both in step.
  staleDays: {
    blsNational: 75, // monthly; each month comes out ~2 weeks after it ends
    blsBoston: 110, // published every other month
    localDatesReview: 180, // the hand-typed Brandeis dates (js/local-calendar.js)
    ideasReview: 365, // Ideas library entries (data/ideas.js)
  },
};
