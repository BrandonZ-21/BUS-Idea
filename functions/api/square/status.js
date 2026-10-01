// GET /api/square/status
//
// PLACEHOLDER -- not implemented yet.
//
// Will: report whether the caller's session is linked to a Square connection, e.g.
// { connected: true, merchantId, lastSyncedAt } -- never any token, even encrypted.

export async function onRequestGet(context) {
  return Response.json(
    { ok: false, endpoint: "status", status: "not_implemented", connected: false },
    { status: 501 }
  );
}
