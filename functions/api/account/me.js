// GET /api/account/me
//
// Who this browser is signed in as:
//   { signedIn: false }  or  { signedIn: true, merchantId, businessName, role }
// The role is shown so the owner can confirm their admin setup; the server
// never trusts it coming back -- every admin endpoint re-reads it from D1.

import { requireUser } from "../../../lib/account/auth.js";
import { describeError, json } from "../../../lib/square/http.js";
import { getConnectionInfo } from "../../../lib/square/store.js";

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireUser(env, request);
    if (auth.response) {
      return auth.response.status === 401 ? json({ signedIn: false }) : auth.response;
    }
    const info = await getConnectionInfo(env.DB, auth.user.merchantId);
    return json({
      signedIn: true,
      merchantId: auth.user.merchantId,
      businessName: (info && info.business_name) || null,
      role: auth.user.role,
    });
  } catch (err) {
    console.error("account/me failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}
