// GET /api/square/callback   <- the Redirect URL registered in the Square Developer Console
//
// Square sends the seller back here after they approve (or cancel). This
// checks `state` against the signed cookie from connect.js, swaps the one-time
// `code` for tokens (server-side, with the app secret), stores the tokens
// encrypted in D1, starts a session for this browser, and returns to the app
// at /?square=connected (or /?square=error&reason=...).

import { SCOPES, exchangeCode, retrieveMerchant } from "../../../lib/square/api.js";
import { importEncryptionKey, importSigningKey, safeEqual, verifySignedValue } from "../../../lib/square/crypto.js";
import { STATE_COOKIE, cookie, describeError, missingConfig, parseCookies, redirectHome, sessionCookie } from "../../../lib/square/http.js";
import { createSession, saveConnection } from "../../../lib/square/store.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clearState = cookie(request, STATE_COOKIE, "", { path: "/api/square/callback", maxAge: 0 });
  const fail = (reason) => redirectHome(request, `/?square=error&reason=${reason}`, [clearState]);

  const missing = missingConfig(env);
  if (missing.length) {
    console.error("Square callback: missing settings:", missing.join(", "));
    return fail("config");
  }

  try {
    // 1. The state must match the one this browser was given, and be fresh.
    const signed = parseCookies(request)[STATE_COOKIE];
    const payload = signed ? await verifySignedValue(await importSigningKey(env.STATE_SIGNING_KEY), signed) : null;
    const [expectedState, expires] = payload ? payload.split("~") : [];
    const returnedState = url.searchParams.get("state") || "";
    if (!payload || !(Number(expires) > Date.now() / 1000) || !safeEqual(expectedState, returnedState)) {
      return fail("state");
    }

    // 2. The seller pressed Cancel, or Square reported a problem.
    if (url.searchParams.get("error")) {
      return fail(url.searchParams.get("error") === "access_denied" ? "denied" : "square");
    }
    const code = url.searchParams.get("code");
    if (!code) return fail("square");

    // 3. Exchange the one-time code for tokens.
    const token = await exchangeCode(env, code);
    if (!token.access_token || !token.merchant_id) return fail("exchange");

    // Nice-to-have only: a failure here shouldn't block connecting.
    let businessName = null;
    try {
      const merchant = await retrieveMerchant(env, token.access_token, token.merchant_id);
      businessName = merchant && merchant.business_name;
    } catch (err) {
      console.error("Square callback: couldn't read business name:", describeError(err));
    }

    // 4. Store tokens encrypted, start this browser's session.
    await saveConnection(env.DB, await importEncryptionKey(env.TOKEN_ENCRYPTION_KEY), token, { scopes: SCOPES, businessName });
    const sessionId = await createSession(env.DB, token.merchant_id);
    return redirectHome(request, "/?square=connected", [clearState, sessionCookie(request, sessionId)]);
  } catch (err) {
    console.error("Square callback failed:", describeError(err));
    return fail("exchange");
  }
}
