// GET /api/admin/check
//
// The only admin endpoint so far: answers { admin: true } for an admin and
// 401/403 for everyone else. It exists so the admin gate can be tested
// before the founder dashboard is built on it. Admins get NO access to
// anyone's saved reports or Square data -- there is deliberately no admin
// endpoint for that.

import { requireAdmin } from "../../../lib/account/auth.js";
import { describeError, json } from "../../../lib/square/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(env, request);
    if (auth.response) return auth.response;
    return json({ admin: true });
  } catch (err) {
    console.error("admin check failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}
