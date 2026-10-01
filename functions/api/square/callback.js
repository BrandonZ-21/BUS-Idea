// GET /api/square/callback   <- this is the Redirect URL registered in the Square Developer Console
//
// PLACEHOLDER -- not implemented yet.
//
// Will: check the `state` query param against the signed state cookie (reject on mismatch
// or if Square sent ?error=...), exchange `code` for tokens via POST /oauth2/token using
// env.SQUARE_APPLICATION_SECRET (server-side only), encrypt the access + refresh tokens with
// AES-GCM using env.TOKEN_ENCRYPTION_KEY (a fresh random IV per token), upsert the row in
// the `connections` table (env.DB), create a session (store only the SHA-256 hash of the
// session id in `sessions`), set the session cookie, and redirect back to the app.
//
// Must never: log or return the code, tokens, or secret.

export async function onRequestGet(context) {
  return Response.json(
    { ok: false, endpoint: "callback", status: "not_implemented" },
    { status: 501 }
  );
}
