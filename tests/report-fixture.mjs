// A small, made-up report summary for tests (synthetic -- not anyone's real sales).
export function sampleReport(overrides = {}) {
  return {
    v: 1,
    source: "csv",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-28",
    totals: { sales: 12345.678, orders: 980, avgOrder: 12.6 },
    byWeekday: [400, 350, 360, 380, 420, 600, 650],
    byHour: Array.from({ length: 24 }, (_, h) => (h >= 7 && h <= 18 ? 40 : 0)),
    topItems: [{ name: "Latte", quantity: 300, revenue: 1500 }, { name: "Croissant", quantity: 120, revenue: 450 }],
    insights: [{ headline: "Saturdays are your best day.", action: "Staff up on Saturday mornings." }],
    ...overrides,
  };
}
