// POST /api/square/disconnect
//
// "Disconnect Square & delete my account": asks Square to revoke the
// authorization, then deletes the stored (encrypted) tokens, every session,
// every saved report and the account itself, and clears this browser's
// cookie. Sales already synced stay in the browser.

import { revokeAuthorization } from "../../../lib/square/api.js";
import { clearSessionCookies, describeError, isSameOrigin, json, missingConfig, setCookieHeaders } from "../../../lib/square/http.js";
import { deleteMerchant, deleteSession, findSession } from "../../../lib/square/store.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "bad_origin" }, 403);
  if (missingConfig(env).length) return json({ error: "not_configured" }, 503);
  const headers = setCookieHeaders(clearSessionCookies(request));

  try {
    const session = await findSession(env.DB, request);
    if (!session) return json({ disconnected: true, wasConnected: false }, 200, headers);

    let revokedAtSquare = true;
    try {
      await revokeAuthorization(env, session.merchantId);
    } catch (err) {
      // Still forget the tokens locally; the seller can also remove the app
      // from their Square Dashboard.
      revokedAtSquare = false;
      console.error("Square revoke failed:", describeError(err));
    }
    await deleteMerchant(env.DB, session.merchantId);
    return json({ disconnected: true, wasConnected: true, revokedAtSquare }, 200, headers);
  } catch (err) {
    console.error("Square disconnect failed:", describeError(err));
    await deleteSession(env.DB, request).catch(() => {});
    return json({ error: "disconnect_failed" }, 500, headers);
  }
}
