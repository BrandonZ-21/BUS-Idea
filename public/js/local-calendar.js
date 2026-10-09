// Optional local calendars: nearby dates a register can't know about, shown
// next to the weekly comparison on the dashboard (see renderWeekCompareCard
// in app.js). Off until the owner turns one on from the Day Notes page.
//
// Unlike holidays, these never change an average or a baseline -- they are
// only listed as possible reasons a week looked different. No network call:
// the dates below were typed in by hand and need updating once a year.
//
// Brandeis University, 2026-27 academic year. Source (checked 2026-10-09):
// https://www.brandeis.edu/registrar/calendar/highlights-26-27.html
// "betweenTerms" isn't a row on that page: it's the gap between the last
// fall final exam and the first day of spring classes.
const LOCAL_CALENDARS = {
  brandeis: {
    academicYear: "2026-27",
    entries: [
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
};

// Entries of one calendar that overlap [startStr, endStr], each clipped to
// that window: [{ start, end, labelKey }]. Unknown calendar id -> [].
function localCalendarEventsBetween(calendarId, startStr, endStr) {
  const cal = LOCAL_CALENDARS[calendarId];
  if (!cal) return [];
  return cal.entries
    .filter((e) => e.start <= endStr && e.end >= startStr)
    .map((e) => ({ start: e.start < startStr ? startStr : e.start, end: e.end > endStr ? endStr : e.end, labelKey: e.labelKey }));
}
