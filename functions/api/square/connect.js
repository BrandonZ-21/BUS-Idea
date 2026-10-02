// GET /api/square/connect
//
// Starts "Connect Square": makes a random OAuth `state`, keeps a signed,
// 10-minute copy in an HttpOnly cookie (checked again in callback.js), then
// sends the browser to Square's authorize page asking for READ-ONLY scopes.

import { authorizeUrl } from "../../../lib/square/api.js";
import { importSigningKey, randomId, signValue } from "../../../lib/square/crypto.js";
import { STATE_COOKIE, cookie, describeError, missingConfig, redirectHome } from "../../../lib/square/http.js";

const STATE_TTL_SECONDS = 600;

export async function onRequestGet({ request, env }) {
  const missing = missingConfig(env);
  if (missing.length) {
    console.error("Square connect: missing settings:", missing.join(", "));
    return redirectHome(request, "/?square=error&reason=config");
  }
  try {
    const state = randomId(24);
    const expires = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
    const signed = await signValue(await importSigningKey(env.STATE_SIGNING_KEY), `${state}~${expires}`);
    const h = new Headers({ Location: authorizeUrl(env, state), "Cache-Control": "no-store" });
    h.append("Set-Cookie", cookie(request, STATE_COOKIE, signed, { path: "/api/square/callback", maxAge: STATE_TTL_SECONDS }));
    return new Response(null, { status: 302, headers: h });
  } catch (err) {
    console.error("Square connect failed:", describeError(err));
    return redirectHome(request, "/?square=error&reason=config");
  }
}
