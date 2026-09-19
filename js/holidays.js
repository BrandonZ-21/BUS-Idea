// Computes US holiday dates with plain JavaScript date math -- no external
// service, no network call. Every holiday below is either a fixed
// month/day, or an "Nth weekday of month" / "last weekday of month" rule.

function nthWeekdayOfMonth(year, monthIndex0, weekday, n) {
  // weekday: 0=Sun .. 6=Sat. n: 1=first, 2=second, etc.
  const first = new Date(year, monthIndex0, 1);
  const firstWeekday = first.getDay();
  let day = 1 + ((7 + weekday - firstWeekday) % 7) + (n - 1) * 7;
  return new Date(year, monthIndex0, day);
}

function lastWeekdayOfMonth(year, monthIndex0, weekday) {
  const last = new Date(year, monthIndex0 + 1, 0); // last day of month
  const lastWeekday = last.getDay();
  const day = last.getDate() - ((7 + lastWeekday - weekday) % 7);
  return new Date(year, monthIndex0, day);
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Each rule returns a JS Date for the given year. nameKey looks up the
// holiday's display name in TRANSLATIONS (en/zh) -- see translations.js.
const HOLIDAY_RULES = [
  { key: "newYearsEve", nameKey: "holidayNewYearsEve", fn: (y) => new Date(y, 11, 31) },
  { key: "newYearsDay", nameKey: "holidayNewYearsDay", fn: (y) => new Date(y, 0, 1) },
  { key: "mlkDay", nameKey: "holidayMlkDay", fn: (y) => nthWeekdayOfMonth(y, 0, 1, 3) },
  { key: "valentinesDay", nameKey: "holidayValentinesDay", fn: (y) => new Date(y, 1, 14) },
  { key: "presidentsDay", nameKey: "holidayPresidentsDay", fn: (y) => nthWeekdayOfMonth(y, 1, 1, 3) },
  { key: "mothersDay", nameKey: "holidayMothersDay", fn: (y) => nthWeekdayOfMonth(y, 4, 0, 2) },
  { key: "memorialDay", nameKey: "holidayMemorialDay", fn: (y) => lastWeekdayOfMonth(y, 4, 1) },
  { key: "fathersDay", nameKey: "holidayFathersDay", fn: (y) => nthWeekdayOfMonth(y, 5, 0, 3) },
  { key: "juneteenth", nameKey: "holidayJuneteenth", fn: (y) => new Date(y, 5, 19) },
  { key: "independenceDay", nameKey: "holidayIndependenceDay", fn: (y) => new Date(y, 6, 4) },
  { key: "laborDay", nameKey: "holidayLaborDay", fn: (y) => nthWeekdayOfMonth(y, 8, 1, 1) },
  { key: "columbusDay", nameKey: "holidayColumbusDay", fn: (y) => nthWeekdayOfMonth(y, 9, 1, 2) },
  { key: "halloween", nameKey: "holidayHalloween", fn: (y) => new Date(y, 9, 31) },
  { key: "veteransDay", nameKey: "holidayVeteransDay", fn: (y) => new Date(y, 10, 11) },
  { key: "thanksgiving", nameKey: "holidayThanksgiving", fn: (y) => nthWeekdayOfMonth(y, 10, 4, 4) },
  { key: "christmasEve", nameKey: "holidayChristmasEve", fn: (y) => new Date(y, 11, 24) },
  { key: "christmasDay", nameKey: "holidayChristmasDay", fn: (y) => new Date(y, 11, 25) },
];

// Returns a Map of "YYYY-MM-DD" -> { key, nameKey } for every holiday in the
// given years (an array of 4-digit numbers).
function computeHolidays(years) {
  const map = new Map();
  const uniqueYears = Array.from(new Set(years));
  uniqueYears.forEach((year) => {
    HOLIDAY_RULES.forEach((rule) => {
      const d = rule.fn(year);
      map.set(toDateStr(d), { key: rule.key, nameKey: rule.nameKey });
    });
  });
  return map;
}

// Convenience: builds the holiday map covering every year present in `rows`
// (by their .date field) plus one year ahead, which is what every feature
// in this app needs (alerts/forecast look slightly into next year near
// December, and next year's holidays are shown on the dashboard).
function holidaysForRows(rows) {
  const years = new Set();
  const thisYear = new Date().getFullYear();
  years.add(thisYear);
  years.add(thisYear + 1);
  rows.forEach((r) => {
    const y = parseInt(r.date.slice(0, 4), 10);
    if (!isNaN(y)) {
      years.add(y);
      years.add(y + 1);
    }
  });
  return computeHolidays(Array.from(years));
}
