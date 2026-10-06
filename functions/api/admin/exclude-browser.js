// POST /api/admin/exclude-browser   body: { browserId, excluded: true | false }
//
// Admin only. Marks one browser (by its random usage id) as "don't count":
// its past steps drop out of every founder-dashboard number and new ones
// aren't stored. Used so the admin's own devices don't inflate the counts.
// Nothing is deleted, so it can be undone with excluded: false.

import { requireAdmin } from "../../../lib/account/auth.js";
import { describeError, isSameOrigin, json, readJsonBody } from "../../../lib/square/http.js";
import { MAX_EVENT_BYTES, isBrowserId, setBrowserExcluded } from "../../../lib/usage/events.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    const auth = await requireAdmin(env, request);
    if (auth.response) return auth.response;
    const body = await readJsonBody(request, MAX_EVENT_BYTES);
    if (!body.ok) return json({ error: body.error }, body.status);
    const { browserId, excluded } = body.value || {};
    if (!isBrowserId(browserId) || typeof excluded !== "boolean") return json({ error: "invalid_request" }, 400);
    await setBrowserExcluded(env.DB, browserId, excluded);
    return json({ browserId, excluded });
  } catch (err) {
    console.error("admin exclude-browser failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}
