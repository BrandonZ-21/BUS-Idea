// Very small hash router. Each route maps to a render function on window.App.
// The browser's own Back/Forward buttons work because we only ever change
// location.hash, never history.pushState.
const ROUTES = {
  "": "renderDashboard",
  "#/home": "renderHome",
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
  "#/customers": "renderCustomers",
  "#/grow": "renderGrow",
  "#/founder": "renderFounder", // admin only -- enforced by /api/admin/usage, not by this table
};

// Returns the current hash if it's a real route, or null if it's empty/
// unrecognized -- distinct from "" (the empty hash IS a valid route, mapped
// to the dashboard), which is why this can't just be a falsy check.
function currentRouteName() {
  const hash = window.location.hash || "";
  return Object.prototype.hasOwnProperty.call(ROUTES, hash) ? hash : null;
}

// #/home (the landing/marketing page) is reachable at all times, with or
// without saved data -- it is never forced back to the dashboard just
// because data exists. Every OTHER page needs at least one saved row to
// render anything meaningful, so with zero rows saved, every route except
// #/home redirects to it instead.
function dispatchRoute() {
  if (typeof App === "undefined" || !App.allRows) return;
  const hasData = App.allRows.length > 0;
  let route = currentRouteName();
  if (route === null) route = hasData ? "" : "#/home";
  // The founder dashboard shows site-wide counts, so it works without sales on this device.
  if (!hasData && route !== "#/home" && route !== "#/founder") route = "#/home";

  if (window.location.hash !== route) {
    window.location.hash = route; // triggers another hashchange -> dispatchRoute runs again with the corrected hash
    return;
  }

  App.showAppShell(hasData);
  window.scrollTo(0, 0);
  const fn = ROUTES[route];
  if (App[fn]) App[fn]();
  App.updateActiveNav(route);
}

window.addEventListener("hashchange", dispatchRoute);
