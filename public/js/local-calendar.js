// Optional local calendars: nearby dates a register can't know about.
//   - Listed next to the weekly comparison on the dashboard (renderWeekCompareCard).
//   - Used by the "Coming up nearby" tip (js/advice.js adviceEventAhead), but
//     only when the owner's own past sales in the same kind of period differ.
// On when the owner turns it on from the Day Notes page, or when the shop's
// location is within ~5 km of campus (js/advice-view.js adviceLocalDatesOn).
//
// Unlike holidays, these never change an average or a baseline. No network
// call: the dates below are TYPED IN BY HAND from the official page (no
// scraping), and must be checked once a year -- the Founder page flags this
// file when `reviewedAt` is older than ADVICE_CONFIG.staleDays.localDatesReview.
//
// Why not the Registrar's live calendar feed? It exists (a public Google
// Calendar .ics linked from brandeis.edu/registrar/calendar/howtosubscribe.html)
// but its page says "members of the Brandeis community may subscribe" and
// gives no reuse terms, so Tally doesn't fetch it (decision 2026-10-27).
//
// "betweenTerms" isn't a row on those pages: it's the gap between the last
// fall final exam and the first day of spring classes.
const LOCAL_CALENDARS = {
  brandeis: {
    sourceUrl: "https://www.brandeis.edu/registrar/calendar/",
    academicYear: "2024-25, 2025-26, 2026-27", // shown on the Day Notes toggle
    reviewedAt: "2026-10-27", // update this date each time you re-check the dates below
    years: {
      // https://www.brandeis.edu/registrar/calendar/highlights-24-25.html (added 2026-10-27; please double-check)
      "2024-25": [
        { start: "2024-08-28", end: "2024-08-28", labelKey: "localCalFirstDay" },
        { start: "2024-11-27", end: "2024-11-29", labelKey: "localCalNoClasses" },
        { start: "2024-12-10", end: "2024-12-10", labelKey: "localCalLastDay" },
        { start: "2024-12-11", end: "2024-12-11", labelKey: "localCalStudyDays" },
        { start: "2024-12-12", end: "2024-12-20", labelKey: "localCalFinals" },
        { start: "2024-12-21", end: "2025-01-13", labelKey: "localCalBetweenTerms" },
        { start: "2025-01-14", end: "2025-01-14", labelKey: "localCalFirstDay" },
        { start: "2025-02-17", end: "2025-02-21", labelKey: "localCalNoClasses" },
        { start: "2025-04-14", end: "2025-04-18", labelKey: "localCalNoClasses" },
        { start: "2025-04-30", end: "2025-04-30", labelKey: "localCalLastDay" },
        { start: "2025-05-01", end: "2025-05-01", labelKey: "localCalStudyDays" },
        { start: "2025-05-02", end: "2025-05-13", labelKey: "localCalFinals" },
        { start: "2025-05-18", end: "2025-05-18", labelKey: "localCalCommencement" },
      ],
      // https://www.brandeis.edu/registrar/calendar/highlights-25-26.html (added 2026-10-27; please double-check)
      "2025-26": [
        { start: "2025-08-27", end: "2025-08-27", labelKey: "localCalFirstDay" },
        { start: "2025-11-26", end: "2025-11-28", labelKey: "localCalNoClasses" },
        { start: "2025-12-11", end: "2025-12-11", labelKey: "localCalLastDay" },
        { start: "2025-12-12", end: "2025-12-12", labelKey: "localCalStudyDays" },
        { start: "2025-12-15", end: "2025-12-22", labelKey: "localCalFinals" },
        { start: "2025-12-23", end: "2026-01-11", labelKey: "localCalBetweenTerms" },
        { start: "2026-01-12", end: "2026-01-12", labelKey: "localCalFirstDay" },
        { start: "2026-02-16", end: "2026-02-20", labelKey: "localCalNoClasses" },
        { start: "2026-04-01", end: "2026-04-09", labelKey: "localCalNoClasses" },
        { start: "2026-04-29", end: "2026-04-29", labelKey: "localCalLastDay" },
        { start: "2026-04-30", end: "2026-04-30", labelKey: "localCalStudyDays" },
        { start: "2026-05-01", end: "2026-05-12", labelKey: "localCalFinals" },
        { start: "2026-05-17", end: "2026-05-17", labelKey: "localCalCommencement" },
      ],
      // https://www.brandeis.edu/registrar/calendar/highlights-26-27.html (checked 2026-10-09)
      "2026-27": [
        { start: "2026-08-26", end: "2026-08-26", labelKey: "localCalFirstDay" },
        { start: "2026-09-07", end: "2026-09-07", labelKey: "localCalNoClasses" },
        { start: "2026-09-11", end: "2026-09-11", labelKey: "localCalNoClasses" },
        { start: "2026-09-21", end: "2026-09-21", labelKey: "localCalNoClasses" },
        { start: "2026-10-12", end: "2026-10-12", labelKey: "localCalNoClasses" },
        { start: "2026-11-25", end: "2026-11-27", labelKey: "localCalNoClasses" },
        { start: "2026-12-03", end: "2026-12-03", labelKey: "localCalLastDay" },
        { start: "2026-12-04", end: "2026-12-07", labelKey: "localCalStudyDays" },
        { start: "2026-12-08", end: "2026-12-16", labelKey: "localCalFinals" },
        { start: "2026-12-17", end: "2027-01-18", labelKey: "localCalBetweenTerms" },
        { start: "2027-01-19", end: "2027-01-19", labelKey: "localCalFirstDay" },
        { start: "2027-02-15", end: "2027-02-19", labelKey: "localCalNoClasses" },
        { start: "2027-03-26", end: "2027-03-26", labelKey: "localCalNoClasses" },
        { start: "2027-04-21", end: "2027-04-29", labelKey: "localCalNoClasses" },
        { start: "2027-05-06", end: "2027-05-06", labelKey: "localCalLastDay" },
        { start: "2027-05-07", end: "2027-05-07", labelKey: "localCalStudyDays" },
        { start: "2027-05-10", end: "2027-05-18", labelKey: "localCalFinals" },
        { start: "2027-05-23", end: "2027-05-23", labelKey: "localCalCommencement" },
      ],
    },
  },
};

function localCalendarEntries(calendarId) {
  const cal = LOCAL_CALENDARS[calendarId];
  if (!cal) return [];
  return Object.values(cal.years).flat().sort((a, b) => (a.start < b.start ? -1 : 1));
}

// Entries of one calendar that overlap [startStr, endStr], each clipped to
// that window: [{ start, end, labelKey }]. Unknown calendar id -> [].
function localCalendarEventsBetween(calendarId, startStr, endStr) {
  return localCalendarEntries(calendarId)
    .filter((e) => e.start <= endStr && e.end >= startStr)
    .map((e) => ({ start: e.start < startStr ? startStr : e.start, end: e.end > endStr ? endStr : e.end, labelKey: e.labelKey }));
}

function localCalShift(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// The same dates as periods of a few kinds the advice can compare across
// years: [{ start, end, kind: "finals" | "break" | "termStart" | "summer" }].
//   finals     the final exam period
//   break      the gap between terms, and any no-class stretch of 3+ days
//   termStart  the first 7 days of a term
//   summer     after spring finals until the fall term starts
function localCalendarPeriods(calendarId) {
  const entries = localCalendarEntries(calendarId);
  const out = [];
  const days = (e) => Math.round((new Date(e.end) - new Date(e.start)) / 86400000) + 1;
  entries.forEach((e, i) => {
    if (e.labelKey === "localCalFinals") {
      out.push({ start: e.start, end: e.end, kind: "finals" });
      // Spring finals (May) -> summer, until the next fall first day.
      if (e.start.slice(5, 7) === "05") {
        const nextFirst = entries.slice(i + 1).find((x) => x.labelKey === "localCalFirstDay");
        if (nextFirst) out.push({ start: localCalShift(e.end, 1), end: localCalShift(nextFirst.start, -1), kind: "summer" });
      }
    } else if (e.labelKey === "localCalBetweenTerms" || (e.labelKey === "localCalNoClasses" && days(e) >= 3)) {
      out.push({ start: e.start, end: e.end, kind: "break" });
    } else if (e.labelKey === "localCalFirstDay") {
      out.push({ start: e.start, end: localCalShift(e.start, 6), kind: "termStart" });
    }
  });
  return out;
}
