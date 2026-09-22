// Very small hash router. Each route maps to a render function on window.App.
// The browser's own Back/Forward buttons work because we only ever change
// location.hash, never history.pushState.
const ROUTES = {
  "": "renderDashboard",
  "#/dashboard": "renderDashboard",
  "#/data": "renderData",
  "#/hours": "renderHoursDetail",
  "#/days": "renderDaysDetail",
  "#/items": "renderItemsDetail",
  "#/trend": "renderTrendDetail",
  "#/order-types": "renderOrderTypesDetail",
  "#/heatmap": "renderHeatmapDetail",
  "#/notes": "renderNotes",
  "#/ask": "renderAsk",
};

function currentRouteName() {
  const hash = window.location.hash || "";
  return ROUTES[hash] ? hash : "#/dashboard";
}

function dispatchRoute() {
  if (typeof App === "undefined" || !App.allRows) return;
  if (App.allRows.length === 0) {
    App.showEmptyState();
    return;
  }
  App.showAppShell();
  const route = currentRouteName();
  const fn = ROUTES[route];
  window.scrollTo(0, 0);
  if (App[fn]) App[fn]();
  App.updateActiveNav(route);
}

window.addEventListener("hashchange", dispatchRoute);
