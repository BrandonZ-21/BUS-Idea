// POST /api/square/sync
//
// PLACEHOLDER -- not implemented yet.
//
// Will: look up the caller's session (hash the session cookie, find it in `sessions`),
// load + decrypt that merchant's tokens from `connections`, refresh them if expires_at is
// near, then READ new payments/orders from Square starting at `sync_cursor` and return them
// to the browser (which keeps storing sales locally in IndexedDB, as today). Saves the new
// cursor afterwards.
//
// Must never: call any Square endpoint that creates, updates or deletes anything.

export async function onRequestPost(context) {
  return Response.json(
    { ok: false, endpoint: "sync", status: "not_implemented" },
    { status: 501 }
  );
}
