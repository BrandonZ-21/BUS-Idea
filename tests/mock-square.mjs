// A tiny fake of the Square endpoints Tally uses, for tests/square-flow.test.mjs.
// Runs only on 127.0.0.1. Never logs or stores request bodies or headers --
// it just records yes/no facts about each call for the test to check.
import http from "node:http";

export const TEST_APP_ID = "sandbox-sq0idb-TESTAPPID0000000000";
export const TEST_APP_SECRET = "sandbox-sq0csb-TEST-SECRET";
export const MERCHANT_ID = "MOCK_MERCHANT";
// A second seller, for tests that need two accounts (add as=B to the authorize URL).
export const MERCHANT_ID_B = "MOCK_MERCHANT_B";
export const ORDER_COUNT = 250;

const ACCESS_1 = "MOCK_ACCESS_FIRST";
const ACCESS_2 = "MOCK_ACCESS_REFRESHED";
const REFRESH = "MOCK_REFRESH";
const ACCESS_B = "MOCK_ACCESS_B";

// 250 completed orders spread over the last 20 days; every 10th has 2 lines;
// every 3rd is linked to one of 20 (fake) Square customer ids.
function makeOrders() {
  const now = Date.now();
  return Array.from({ length: ORDER_COUNT }, (_, i) => ({
    id: `ORDER_${String(i).padStart(4, "0")}`,
    location_id: "L1",
    state: "COMPLETED",
    closed_at: new Date(now - (ORDER_COUNT - i) * 1.9 * 3600 * 1000).toISOString(),
    ...(i % 3 === 0 ? { customer_id: `MOCKCUST${i % 20}` } : {}),
    line_items: [
      { name: "Latte", variation_name: i % 2 ? "Large" : "Small", quantity: "1", gross_sales_money: { amount: i % 2 ? 550 : 450, currency: "USD" }, item_type: "ITEM" },
      ...(i % 10 === 0 ? [{ name: "Croissant", quantity: "2", gross_sales_money: { amount: 750, currency: "USD" }, item_type: "ITEM" }] : []),
    ],
  }));
}

export function startMockSquare({ port, callbackUrl }) {
  const orders = makeOrders();
  const calls = { authorize: [], token: [], merchant: [], locations: [], search: [], revoke: [] };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    const auth = req.headers.authorization || "";
    const send = (status, obj, headers = {}) => {
      res.writeHead(status, { "Content-Type": "application/json", ...headers });
      res.end(obj === null ? "" : JSON.stringify(obj));
    };
    const versionOk = req.headers["square-version"] === "2026-09-16";

    if (req.method === "GET" && url.pathname === "/oauth2/authorize") {
      calls.authorize.push({ clientId: url.searchParams.get("client_id"), scope: url.searchParams.get("scope"), session: url.searchParams.get("session") });
      // Pretend the seller pressed "Allow" (or "Deny" when asked to).
      const back = new URL(callbackUrl);
      if (url.searchParams.get("deny")) back.searchParams.set("error", "access_denied");
      else back.searchParams.set("code", url.searchParams.get("as") === "B" ? "MOCK_CODE_B" : "MOCK_CODE");
      back.searchParams.set("state", url.searchParams.get("state"));
      return send(302, null, { Location: back.toString() });
    }
    if (req.method === "POST" && url.pathname === "/oauth2/token") {
      const ok = data.client_id === TEST_APP_ID && data.client_secret === TEST_APP_SECRET;
      calls.token.push({ grant: data.grant_type, usedTestCredentials: ok, versionOk });
      if (!ok) return send(401, { errors: [{ code: "UNAUTHORIZED" }] });
      if (data.grant_type === "authorization_code" && data.code === "MOCK_CODE") {
        // Expires in 3 days, so the first sync has to refresh it.
        return send(200, { access_token: ACCESS_1, token_type: "bearer", expires_at: new Date(Date.now() + 3 * 86400e3).toISOString(), merchant_id: MERCHANT_ID, refresh_token: REFRESH });
      }
      if (data.grant_type === "authorization_code" && data.code === "MOCK_CODE_B") {
        return send(200, { access_token: ACCESS_B, token_type: "bearer", expires_at: new Date(Date.now() + 30 * 86400e3).toISOString(), merchant_id: MERCHANT_ID_B, refresh_token: "MOCK_REFRESH_B" });
      }
      if (data.grant_type === "refresh_token" && data.refresh_token === REFRESH) {
        return send(200, { access_token: ACCESS_2, token_type: "bearer", expires_at: new Date(Date.now() + 30 * 86400e3).toISOString(), merchant_id: MERCHANT_ID, refresh_token: REFRESH });
      }
      return send(400, { errors: [{ code: "BAD_REQUEST" }] });
    }
    if (req.method === "POST" && url.pathname === "/oauth2/revoke") {
      calls.revoke.push({ clientHeaderOk: auth === `Client ${TEST_APP_SECRET}`, merchant: data.merchant_id === MERCHANT_ID, clientId: data.client_id === TEST_APP_ID });
      return send(200, { success: true });
    }

    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token === ACCESS_B && req.method === "GET" && url.pathname === `/v2/merchants/${MERCHANT_ID_B}`) {
      return send(200, { merchant: { id: MERCHANT_ID_B, business_name: "Second Mock Bakery" } });
    }
    if (token !== ACCESS_1 && token !== ACCESS_2) return send(401, { errors: [{ code: "UNAUTHORIZED" }] });
    const which = token === ACCESS_1 ? "first" : "refreshed";

    if (req.method === "GET" && url.pathname === `/v2/merchants/${MERCHANT_ID}`) {
      calls.merchant.push({ token: which });
      return send(200, { merchant: { id: MERCHANT_ID, business_name: "Mock Cafe" } });
    }
    if (req.method === "GET" && url.pathname === "/v2/locations") {
      calls.locations.push({ token: which });
      return send(200, { locations: [{ id: "L1", timezone: "America/New_York" }] });
    }
    if (req.method === "POST" && url.pathname === "/v2/orders/search") {
      const q = data.query || {};
      const range = q.filter && q.filter.date_time_filter && q.filter.date_time_filter.closed_at;
      const start = Date.parse(range && range.start_at);
      const end = Date.parse(range && range.end_at);
      calls.search.push({
        token: which, limit: data.limit, hasCursor: !!data.cursor, versionOk,
        completedOnly: JSON.stringify(q.filter && q.filter.state_filter) === '{"states":["COMPLETED"]}',
        sortOk: q.sort && q.sort.sort_field === "CLOSED_AT" && q.sort.sort_order === "ASC",
        spanDays: Math.round((end - start) / 86400e3),
      });
      const matching = orders.filter((o) => Date.parse(o.closed_at) >= start && Date.parse(o.closed_at) < end);
      const offset = data.cursor ? Number(data.cursor) : 0;
      const page = matching.slice(offset, offset + data.limit);
      const next = offset + data.limit < matching.length ? String(offset + data.limit) : undefined;
      return send(200, { orders: page, cursor: next });
    }
    return send(404, { errors: [{ code: "NOT_FOUND" }] });
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ calls, close: () => server.close() })));
}
