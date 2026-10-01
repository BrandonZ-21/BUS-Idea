// POST /api/square/disconnect
//
// PLACEHOLDER -- not implemented yet.
//
// Will: find the caller's session, revoke the merchant's access with Square
// (POST /oauth2/revoke), delete their row from `connections` and all their `sessions`,
// and clear the session cookie.

export async function onRequestPost(context) {
  return Response.json(
    { ok: false, endpoint: "disconnect", status: "not_implemented" },
    { status: 501 }
  );
}
