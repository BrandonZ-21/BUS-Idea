// /api/reports -- the signed-in owner's saved report summaries.
//
//   GET     -> { reports: [ { id, savedAt, source, periodStart, periodEnd, totalSales, orders } ] }
//   POST    -> save one summary (see lib/account/reports.js for the shape) -> 201 { id }
//   DELETE  -> "Delete all my saved data" -> { deleted: n }
//
// The owner always comes from the session, never from the request body.

import { requireUser } from "../../../lib/account/auth.js";
import {
  MAX_REPORT_BYTES, deleteAllReports, insertReport, listReports, validateReport,
} from "../../../lib/account/reports.js";
import { describeError, isSameOrigin, json, readJsonBody } from "../../../lib/square/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireUser(env, request);
    if (auth.response) return auth.response;
    return json({ reports: await listReports(env.DB, auth.user.merchantId) });
  } catch (err) {
    console.error("reports list failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    const auth = await requireUser(env, request);
    if (auth.response) return auth.response;
    const body = await readJsonBody(request, MAX_REPORT_BYTES);
    if (!body.ok) return json({ error: body.error }, body.status);
    const checked = validateReport(body.value);
    if (!checked.ok) return json({ error: "invalid_report", field: checked.field }, 400);
    const id = await insertReport(env.DB, auth.user.merchantId, checked.report);
    if (!id) return json({ error: "limit_reached" }, 409);
    return json({ id }, 201);
  } catch (err) {
    console.error("report save failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    const auth = await requireUser(env, request);
    if (auth.response) return auth.response;
    return json({ deleted: await deleteAllReports(env.DB, auth.user.merchantId) });
  } catch (err) {
    console.error("reports delete-all failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}
