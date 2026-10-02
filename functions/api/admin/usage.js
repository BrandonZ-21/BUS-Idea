// GET /api/admin/usage?mode=live|demo&days=7|28 -- founder dashboard data.
//
// Admin only (role re-read from D1 on every request). Returns counts of
// anonymous usage steps -- never sales data, saved reports or Square data.
// mode=demo answers from made-up events generated in memory (lib/usage/demo.js)
// and never touches the usage table.

import { requireAdmin } from "../../../lib/account/auth.js";
import { describeError, json } from "../../../lib/square/http.js";
import { demoData } from "../../../lib/usage/demo.js";
import { loadLiveData } from "../../../lib/usage/events.js";
import { summarize } from "../../../lib/usage/summary.js";

const WINDOWS = [7, 28];

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(env, request);
    if (auth.response) return auth.response;
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") === "demo" ? "demo" : "live";
    const days = WINDOWS.includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 28;
    const nowSec = Math.floor(Date.now() / 1000);
    const collecting = env.USAGE_EVENTS === "on";
    const data = mode === "demo" ? demoData(nowSec) : await loadLiveData(env.DB, nowSec - days * 86400);
    return json(summarize(data, { days, nowSec, mode, collecting }));
  } catch (err) {
    console.error("admin usage failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}
