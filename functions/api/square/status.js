// GET /api/square/status
//
// Tells the page whether this browser is connected to Square:
//   { configured, connected, environment, businessName?, lastSyncedAt? }
// Never returns any token, encrypted or not.

import { describeError, json, missingConfig } from "../../../lib/square/http.js";
import { findSession, getConnectionInfo } from "../../../lib/square/store.js";

export async function onRequestGet({ request, env }) {
  if (missingConfig(env).length) return json({ configured: false, connected: false });
  const base = { configured: true, environment: env.SQUARE_ENVIRONMENT };
  try {
    const session = await findSession(env.DB, request);
    const info = session && (await getConnectionInfo(env.DB, session.merchantId));
    if (!info) return json({ ...base, connected: false });
    return json({
      ...base,
      connected: true,
      businessName: info.business_name || null,
      lastSyncedAt: info.last_synced_at ? new Date(info.last_synced_at * 1000).toISOString() : null,
    });
  } catch (err) {
    console.error("Square status failed:", describeError(err));
    return json({ ...base, connected: false, error: "status_failed" }, 500);
  }
}
