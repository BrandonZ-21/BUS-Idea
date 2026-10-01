// GET /api/square/connect
//
// PLACEHOLDER -- not implemented yet.
//
// Will: create a random OAuth `state`, sign it with env.STATE_SIGNING_KEY and set it
// in a short-lived HttpOnly cookie, then redirect the browser to Square's authorize page
// (Sandbox: https://connect.squareupsandbox.com/oauth2/authorize) with
// client_id = env.SQUARE_APPLICATION_ID, READ-ONLY scopes only (e.g. MERCHANT_PROFILE_READ,
// PAYMENTS_READ, ORDERS_READ, ITEMS_READ), session=false, and that state.
//
// Must never: request any *_WRITE scope, or log the state / cookie values.

export async function onRequestGet(context) {
  return Response.json(
    { ok: false, endpoint: "connect", status: "not_implemented" },
    { status: 501 }
  );
}
