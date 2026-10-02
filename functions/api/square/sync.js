// POST /api/square/sync
//
// Returns one page of completed Square orders, already converted to sales
// rows, for the browser to save locally (IndexedDB) like an uploaded file.
// Nothing about the sales is stored on the server.
//
// Request body (JSON):
//   {}                        -> new sync: everything since the last sync
//   { full: true }            -> new sync: the last 90 days
//   { cursor, start, end }    -> next page of the sync in progress (copied from `next`)
// Response:
//   { rows, orders, done, next: { cursor, start, end } | null }
// Small pages keep each request well under the free plan's CPU limit; the
// page loops until done. The saved sync position only moves once the last
// page has been sent, and each new sync re-reads a 2-day overlap (orders
// taken offline can arrive late) -- duplicates are skipped by the browser.

import { listLocations, refreshAccessToken, searchOrders } from "../../../lib/square/api.js";
import { importEncryptionKey } from "../../../lib/square/crypto.js";
import { describeError, isSameOrigin, json, missingConfig } from "../../../lib/square/http.js";
import { ordersToRows } from "../../../lib/square/orders.js";
import { finishSync, findSession, loadConnection, updateAccessToken } from "../../../lib/square/store.js";

const PAGE_SIZE = 100;
const FIRST_SYNC_DAYS = 90;
const OVERLAP_MS = 2 * 86400 * 1000;
const REFRESH_WHEN_DAYS_LEFT = 7;
const MAX_LOCATIONS = 10; // Square's limit per orders search

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "bad_origin" }, 403);
  if (missingConfig(env).length) return json({ error: "not_configured" }, 503);

  try {
    const session = await findSession(env.DB, request);
    if (!session) return json({ error: "not_connected" }, 401);
    const encKey = await importEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
    let conn = await loadConnection(env.DB, encKey, session.merchantId);
    if (!conn) return json({ error: "not_connected" }, 401);

    // Access tokens last 30 days; renew a week early.
    if (conn.refreshToken && conn.expiresAt - Date.now() / 1000 < REFRESH_WHEN_DAYS_LEFT * 86400) {
      const token = await refreshAccessToken(env, conn.refreshToken);
      await updateAccessToken(env.DB, encKey, conn.merchantId, token);
      conn = { ...conn, accessToken: token.access_token };
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // empty body = a normal sync
    }
    const page = continuation(body) || newWindow(body, conn.syncCursor);

    const locations = (await listLocations(env, conn.accessToken)).slice(0, MAX_LOCATIONS);
    if (!locations.length) {
      await finishSync(env.DB, conn.merchantId, page.end);
      return json({ rows: [], orders: 0, done: true, next: null });
    }
    const timeZones = Object.fromEntries(locations.map((l) => [l.id, l.timezone]));

    const result = await searchOrders(env, conn.accessToken, {
      locationIds: locations.map((l) => l.id),
      startAt: page.start,
      endAt: page.end,
      cursor: page.cursor,
      limit: PAGE_SIZE,
    });
    const orders = result.orders || [];
    const done = !result.cursor;
    if (done) await finishSync(env.DB, conn.merchantId, page.end);

    return json({
      rows: ordersToRows(orders, timeZones),
      orders: orders.length,
      done,
      next: done ? null : { cursor: result.cursor, start: page.start, end: page.end },
    });
  } catch (err) {
    console.error("Square sync failed:", describeError(err));
    // 401 from Square = the seller revoked access from their Square Dashboard.
    if (err.name === "SquareError" && err.status === 401) return json({ error: "square_access_revoked" }, 401);
    return json({ error: "sync_failed" }, 502);
  }
}

function newWindow(body, syncCursor) {
  const now = Date.now();
  const since = body.full ? null : Date.parse(syncCursor || "");
  const start = Number.isFinite(since) ? since - OVERLAP_MS : now - FIRST_SYNC_DAYS * 86400 * 1000;
  return { start: new Date(start).toISOString(), end: new Date(now).toISOString(), cursor: null };
}

// Accepts the `next` object from the previous page, within sane bounds.
function continuation(body) {
  if (!body || typeof body.cursor !== "string" || !body.cursor || body.cursor.length > 4096) return null;
  const start = Date.parse(body.start);
  const end = Date.parse(body.end);
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null;
  if (start < now - 400 * 86400 * 1000 || end > now + 3600 * 1000) return null;
  return { cursor: body.cursor, start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}
