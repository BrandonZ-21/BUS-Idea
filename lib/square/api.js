// Thin client for the handful of Square endpoints Tally uses. READ-ONLY:
// nothing here creates, changes or deletes anything in a Square account
// (revoke only ends Tally's own access).

// Pinned so Square's response shapes can't change under us.
// https://developer.squareup.com/docs/changelog/connect
export const SQUARE_VERSION = "2026-09-16";

// Only what the app needs: business name + locations (time zones), and orders.
export const SCOPES = ["MERCHANT_PROFILE_READ", "ORDERS_READ"];

const SANDBOX_BASE = "https://connect.squareupsandbox.com";
const PRODUCTION_BASE = "https://connect.squareup.com";

export class SquareError extends Error {
  constructor(status, code) {
    super(`Square API error ${status}${code ? ` ${code}` : ""}`);
    this.name = "SquareError";
    this.status = status;
    this.code = code || null;
  }
}

// SQUARE_API_BASE_OVERRIDE exists only so tests can point at a fake Square
// running on this computer (tests/mock-square.mjs); anything else is ignored.
// Real sellers only when SQUARE_ENVIRONMENT is exactly "production".
export function squareBase(env) {
  const override = String(env.SQUARE_API_BASE_OVERRIDE || "");
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(override)) return override;
  return env.SQUARE_ENVIRONMENT === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
}

export function authorizeUrl(env, state) {
  const url = new URL("/oauth2/authorize", squareBase(env));
  url.searchParams.set("client_id", env.SQUARE_APPLICATION_ID);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  // Must be false in production so sellers sign in to the right account;
  // Square ignores it in Sandbox.
  url.searchParams.set("session", "false");
  return url.toString();
}

async function call(env, path, { method = "GET", accessToken, authorization, body } = {}) {
  const headers = { "Square-Version": SQUARE_VERSION, Accept: "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (authorization) headers.Authorization = authorization;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(squareBase(env) + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON error page; handled below
  }
  if (!res.ok) {
    const code = data && Array.isArray(data.errors) && data.errors[0] ? data.errors[0].code : data && data.type;
    throw new SquareError(res.status, code);
  }
  return data || {};
}

// ---------- OAuth ----------

export function exchangeCode(env, code) {
  return call(env, "/oauth2/token", {
    method: "POST",
    body: {
      client_id: env.SQUARE_APPLICATION_ID,
      client_secret: env.SQUARE_APPLICATION_SECRET,
      code,
      grant_type: "authorization_code",
    },
  });
}

// Code-flow refresh tokens don't expire; Square returns the same one back.
export function refreshAccessToken(env, refreshToken) {
  return call(env, "/oauth2/token", {
    method: "POST",
    body: {
      client_id: env.SQUARE_APPLICATION_ID,
      client_secret: env.SQUARE_APPLICATION_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
  });
}

// Ends Tally's whole authorization for this seller (all its tokens).
export function revokeAuthorization(env, merchantId) {
  return call(env, "/oauth2/revoke", {
    method: "POST",
    authorization: `Client ${env.SQUARE_APPLICATION_SECRET}`,
    body: { client_id: env.SQUARE_APPLICATION_ID, merchant_id: merchantId },
  });
}

// ---------- Data (read-only) ----------

export async function retrieveMerchant(env, accessToken, merchantId) {
  const data = await call(env, `/v2/merchants/${encodeURIComponent(merchantId)}`, { accessToken });
  return data.merchant || null;
}

export async function listLocations(env, accessToken) {
  const data = await call(env, "/v2/locations", { accessToken });
  return data.locations || [];
}

// One page of COMPLETED orders closed in [startAt, endAt), oldest first.
// Square needs the identical query again when a cursor is passed.
export function searchOrders(env, accessToken, { locationIds, startAt, endAt, cursor, limit }) {
  return call(env, "/v2/orders/search", {
    method: "POST",
    accessToken,
    body: {
      location_ids: locationIds,
      cursor: cursor || undefined,
      limit,
      return_entries: false,
      query: {
        filter: {
          state_filter: { states: ["COMPLETED"] },
          date_time_filter: { closed_at: { start_at: startAt, end_at: endAt } },
        },
        sort: { sort_field: "CLOSED_AT", sort_order: "ASC" },
      },
    },
  });
}
