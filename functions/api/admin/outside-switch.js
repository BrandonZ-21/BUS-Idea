// POST /api/admin/outside-switch   body: { on: true | false }
//
// Admin only. The instant "outside data off" switch: no deploy needed. When
// off, /api/outside returns nothing (outside-data cards disappear within the
// hour as caches expire) and the scheduled job stops fetching. The core app
// is unaffected.

import { requireAdmin } from "../../../lib/account/auth.js";
import { setOutsideDataSwitch } from "../../../lib/outside/store.js";
import { describeError, isSameOrigin, json, readJsonBody } from "../../../lib/square/http.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    const auth = await requireAdmin(env, request);
    if (auth.response) return auth.response;
    const body = await readJsonBody(request, 256);
    if (!body.ok) return json({ error: body.error }, body.status);
    const on = body.value && body.value.on;
    if (typeof on !== "boolean") return json({ error: "invalid_request" }, 400);
    await setOutsideDataSwitch(env.DB, on);
    if (typeof caches !== "undefined") await caches.default.delete(new Request(new URL("/api/outside", request.url).toString()));
    return json({ on });
  } catch (err) {
    console.error("admin outside-switch failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}
