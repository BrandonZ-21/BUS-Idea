// POST /api/account/signout
//
// Signs THIS browser out: deletes its session on the server (so the old
// cookie stops working everywhere) and clears the cookie. The Square
// connection, other browsers' sessions and saved reports are untouched.

import { clearSessionCookies, describeError, isSameOrigin, json, setCookieHeaders } from "../../../lib/square/http.js";
import { deleteSession } from "../../../lib/square/store.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "bad_origin" }, 403);
  const headers = setCookieHeaders(clearSessionCookies(request));
  if (!env.DB) return json({ signedOut: true }, 200, headers);
  try {
    await deleteSession(env.DB, request);
    return json({ signedOut: true }, 200, headers);
  } catch (err) {
    console.error("account/signout failed:", describeError(err));
    return json({ error: "server_error" }, 500, headers);
  }
}
