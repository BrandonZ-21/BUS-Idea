// /api/reports/:id -- one of the signed-in owner's saved reports.
//
//   GET     -> { id, savedAt, report }
//   DELETE  -> { deleted: true }
//
// Someone else's report id gets the same 404 as a made-up one, so ids
// can't be probed.

import { requireUser } from "../../../lib/account/auth.js";
import { deleteReport, getReport, isReportId } from "../../../lib/account/reports.js";
import { describeError, isSameOrigin, json } from "../../../lib/square/http.js";

export async function onRequestGet({ request, env, params }) {
  try {
    const auth = await requireUser(env, request);
    if (auth.response) return auth.response;
    const found = isReportId(params.id) ? await getReport(env.DB, auth.user.merchantId, params.id) : null;
    return found ? json(found) : json({ error: "not_found" }, 404);
  } catch (err) {
    console.error("report get failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}

export async function onRequestDelete({ request, env, params }) {
  if (!isSameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    const auth = await requireUser(env, request);
    if (auth.response) return auth.response;
    const deleted = isReportId(params.id) ? await deleteReport(env.DB, auth.user.merchantId, params.id) : 0;
    return deleted ? json({ deleted: true }) : json({ error: "not_found" }, 404);
  } catch (err) {
    console.error("report delete failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}
