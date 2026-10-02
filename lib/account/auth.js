// Who is making this request, decided only on the server: the session cookie
// is looked up (by hash) in D1, and the role is read from the accounts table
// on every request -- so signing out, disconnecting or a role change takes
// effect immediately. Nothing the browser sends (a "role" or "merchantId"
// field, a header) is ever trusted.

import { json, missingConfig } from "../square/http.js";
import { ensureAccount, findSession, getRole } from "../square/store.js";

// Returns { user: { merchantId, role } } or { response } to send back as-is.
export async function requireUser(env, request) {
  if (missingConfig(env).length) return { response: json({ error: "not_configured" }, 503) };
  const session = await findSession(env.DB, request);
  if (!session) return { response: json({ error: "not_signed_in" }, 401) };
  let role = await getRole(env.DB, session.merchantId);
  if (!role) {
    // Session from before accounts existed: create the account as a user.
    await ensureAccount(env.DB, session.merchantId);
    role = await getRole(env.DB, session.merchantId);
  }
  return { user: { merchantId: session.merchantId, role } };
}

export async function requireAdmin(env, request) {
  const auth = await requireUser(env, request);
  if (auth.response) return auth;
  if (auth.user.role !== "admin") return { response: json({ error: "forbidden" }, 403) };
  return auth;
}
