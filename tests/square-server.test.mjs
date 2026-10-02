// Unit tests for lib/square/* (the server side of "Connect Square").
// Run:  npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  bytesToBase64, decryptString, encryptString, importEncryptionKey, importSigningKey,
  randomId, safeEqual, sha256Hex, signValue, verifySignedValue,
} from "../lib/square/crypto.js";
import { SCOPES, authorizeUrl, squareBase } from "../lib/square/api.js";
import { clearSessionCookies, describeError, isSameOrigin, missingConfig, parseCookies, sessionCookie } from "../lib/square/http.js";
import { localDateTime, ordersToRows } from "../lib/square/orders.js";

const testKey = () => bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));

// ---------- crypto ----------

test("token encryption round-trips, with a new IV every time", async () => {
  const key = await importEncryptionKey(testKey());
  const a = await encryptString(key, "EAAA-test-token", "access:M1");
  const b = await encryptString(key, "EAAA-test-token", "access:M1");
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.ok(!a.ciphertext.includes("EAAA"));
  assert.equal(await decryptString(key, a.ciphertext, a.iv, "access:M1"), "EAAA-test-token");
});

test("a ciphertext moved to another merchant or column won't decrypt", async () => {
  const key = await importEncryptionKey(testKey());
  const a = await encryptString(key, "secret", "access:M1");
  await assert.rejects(decryptString(key, a.ciphertext, a.iv, "access:M2"));
  await assert.rejects(decryptString(key, a.ciphertext, a.iv, "refresh:M1"));
});

test("a different key or a tampered ciphertext won't decrypt", async () => {
  const a = await encryptString(await importEncryptionKey(testKey()), "secret", "x");
  await assert.rejects(decryptString(await importEncryptionKey(testKey()), a.ciphertext, a.iv, "x"));
  const key = await importEncryptionKey(testKey());
  const b = await encryptString(key, "secret", "x");
  const bytes = Uint8Array.from(atob(b.ciphertext), (c) => c.charCodeAt(0));
  bytes[0] ^= 1;
  await assert.rejects(decryptString(key, bytesToBase64(bytes), b.iv, "x"));
});

test("keys must be 32 bytes of base64", async () => {
  await assert.rejects(importEncryptionKey(""), /TOKEN_ENCRYPTION_KEY/);
  await assert.rejects(importEncryptionKey(bytesToBase64(new Uint8Array(16))), /32 bytes/);
  await assert.rejects(importSigningKey("not base64!!"), /STATE_SIGNING_KEY/);
});

test("signed values verify, and any change is rejected", async () => {
  const key = await importSigningKey(testKey());
  const signed = await signValue(key, "abc~123");
  assert.equal(await verifySignedValue(key, signed), "abc~123");
  assert.equal(await verifySignedValue(key, signed.replace("abc", "abd")), null);
  assert.equal(await verifySignedValue(key, signed.slice(0, -2) + "AA"), null);
  assert.equal(await verifySignedValue(await importSigningKey(testKey()), signed), null);
  assert.equal(await verifySignedValue(key, ""), null);
  assert.equal(await verifySignedValue(key, "no-signature"), null);
});

test("random ids are url-safe and unique; hashing and safeEqual behave", async () => {
  const a = randomId(32);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, randomId(32));
  assert.match(await sha256Hex("x"), /^[0-9a-f]{64}$/);
  assert.ok(safeEqual("abc", "abc"));
  assert.ok(!safeEqual("abc", "abd"));
  assert.ok(!safeEqual("abc", "abcd"));
});

// ---------- http ----------

const fullEnv = {
  SQUARE_APPLICATION_ID: "sandbox-sq0idb-test", SQUARE_APPLICATION_SECRET: "s", TOKEN_ENCRYPTION_KEY: "k",
  STATE_SIGNING_KEY: "k", SQUARE_ENVIRONMENT: "sandbox", DB: {},
};

test("missingConfig names what's missing and refuses an unknown environment", () => {
  assert.deepEqual(missingConfig(fullEnv), []);
  assert.deepEqual(missingConfig({ ...fullEnv, SQUARE_APPLICATION_SECRET: " " }), ["SQUARE_APPLICATION_SECRET"]);
  assert.deepEqual(missingConfig({ ...fullEnv, SQUARE_ENVIRONMENT: "" }), ['SQUARE_ENVIRONMENT ("sandbox" or "production")']);
  assert.deepEqual(missingConfig({ ...fullEnv, SQUARE_ENVIRONMENT: "prod" }), ['SQUARE_ENVIRONMENT ("sandbox" or "production")']);
});

test("missingConfig allows production only with a production app id, and sandbox only with a sandbox one", () => {
  const prodEnv = { ...fullEnv, SQUARE_ENVIRONMENT: "production", SQUARE_APPLICATION_ID: "sq0idp-test" };
  assert.deepEqual(missingConfig(prodEnv), []);
  assert.deepEqual(missingConfig({ ...prodEnv, SQUARE_APPLICATION_ID: "sandbox-sq0idb-test" }), ["SQUARE_APPLICATION_ID (doesn't match SQUARE_ENVIRONMENT)"]);
  assert.deepEqual(missingConfig({ ...fullEnv, SQUARE_APPLICATION_ID: "sq0idp-test" }), ["SQUARE_APPLICATION_ID (doesn't match SQUARE_ENVIRONMENT)"]);
});

test("cookies: parsing, flags, and Secure only on https", () => {
  const req = new Request("http://localhost:8788/x", { headers: { Cookie: "a=1; tally_session=abc%2Bd; bad=%E0%A4%A" } });
  assert.deepEqual(parseCookies(req), { a: "1", tally_session: "abc+d" });
  const local = sessionCookie(new Request("http://localhost:8788/"), "sid");
  assert.match(local, /HttpOnly/);
  assert.match(local, /SameSite=Lax/);
  assert.match(local, /Path=\/api;/);
  assert.doesNotMatch(local, /Secure/);
  assert.match(sessionCookie(new Request("https://bus-idea.pages.dev/"), "sid"), /Secure/);
  const cleared = clearSessionCookies(new Request("https://bus-idea.pages.dev/"));
  assert.deepEqual(cleared.map((c) => c.match(/Path=([^;]+)/)[1]), ["/api", "/api/square"], "also clears the old /api/square cookie");
  assert.ok(cleared.every((c) => /Max-Age=0/.test(c)));
});

test("same-origin check for POSTs", () => {
  const url = "http://localhost:8788/api/square/sync";
  assert.ok(isSameOrigin(new Request(url, { method: "POST", headers: { Origin: "http://localhost:8788" } })));
  assert.ok(!isSameOrigin(new Request(url, { method: "POST", headers: { Origin: "https://evil.example" } })));
  assert.ok(!isSameOrigin(new Request(url, { method: "POST" })));
});

test("describeError never includes a message body", () => {
  const e = new Error("token EAAA-secret leaked");
  assert.equal(describeError(e), "Error");
});

// ---------- api ----------

test("authorize URL: sandbox host, read-only scopes only, state, session=false", () => {
  const u = new URL(authorizeUrl(fullEnv, "STATE123"));
  assert.equal(u.origin, "https://connect.squareupsandbox.com");
  assert.equal(u.pathname, "/oauth2/authorize");
  assert.equal(u.searchParams.get("client_id"), "sandbox-sq0idb-test");
  assert.equal(u.searchParams.get("state"), "STATE123");
  assert.equal(u.searchParams.get("session"), "false");
  const scopes = u.searchParams.get("scope").split(" ");
  assert.deepEqual(scopes, SCOPES);
  assert.ok(scopes.every((s) => s.endsWith("_READ")));
});

test("the API base can only be overridden to a localhost test server", () => {
  assert.equal(squareBase({}), "https://connect.squareupsandbox.com");
  assert.equal(squareBase({ SQUARE_API_BASE_OVERRIDE: "http://127.0.0.1:8799" }), "http://127.0.0.1:8799");
  assert.equal(squareBase({ SQUARE_API_BASE_OVERRIDE: "https://evil.example" }), "https://connect.squareupsandbox.com");
  assert.equal(squareBase({ SQUARE_API_BASE_OVERRIDE: "http://localhost.evil.example:80" }), "https://connect.squareupsandbox.com");
});

test("real Square only when SQUARE_ENVIRONMENT is exactly production", () => {
  assert.equal(squareBase({ SQUARE_ENVIRONMENT: "production" }), "https://connect.squareup.com");
  assert.equal(squareBase({ SQUARE_ENVIRONMENT: "sandbox" }), "https://connect.squareupsandbox.com");
  assert.equal(squareBase({ SQUARE_ENVIRONMENT: "Production" }), "https://connect.squareupsandbox.com");
  const u = new URL(authorizeUrl({ ...fullEnv, SQUARE_ENVIRONMENT: "production", SQUARE_APPLICATION_ID: "sq0idp-x" }, "S"));
  assert.equal(u.origin, "https://connect.squareup.com");
  assert.equal(u.searchParams.get("session"), "false");
});

// ---------- orders -> rows ----------

test("localDateTime converts to the location's time zone (incl. DST and date rollover)", () => {
  assert.deepEqual(localDateTime("2026-07-01T02:30:00Z", "America/New_York"), { date: "2026-06-30", time: "22:30" });
  assert.deepEqual(localDateTime("2026-12-01T15:05:00Z", "America/New_York"), { date: "2026-12-01", time: "10:05" });
  assert.deepEqual(localDateTime("2026-12-01T15:05:00Z", "Not/AZone"), { date: "2026-12-01", time: "15:05" });
});

const money = (amount) => ({ amount, currency: "USD" });

test("ordersToRows: one row per line, unit gross price, variation, custom amounts, fulfillment", () => {
  const rows = ordersToRows(
    [
      {
        id: "O1", location_id: "L1", state: "COMPLETED", closed_at: "2026-09-15T17:45:10Z",
        fulfillments: [{ type: "PICKUP" }],
        line_items: [
          { name: "Latte", variation_name: "Large", quantity: "2", gross_sales_money: money(1100), item_type: "ITEM" },
          { name: "Jane's birthday note", quantity: "1", gross_sales_money: money(500), item_type: "CUSTOM_AMOUNT" },
          { name: "Coffee beans", variation_name: "", quantity: "0.5", gross_sales_money: money(899) },
          { name: "  Cookie  ", quantity: "3", base_price_money: money(250) },
        ],
      },
      { id: "O2", location_id: "L1", state: "OPEN", closed_at: "2026-09-15T18:00:00Z", line_items: [] },
      { id: "O3", location_id: "L1", state: "COMPLETED", closed_at: "2026-09-15T19:00:00Z", total_money: money(1234) },
    ],
    { L1: "America/New_York" }
  );
  assert.deepEqual(rows, [
    { date: "2026-09-15", time: "13:45", orderType: "Pickup", orderId: "O1", item: "Latte", variation: "Large", quantity: 2, price: 5.5, kind: "product" },
    { date: "2026-09-15", time: "13:45", orderType: "Pickup", orderId: "O1", item: "Custom Amount", variation: null, quantity: 1, price: 5, kind: "custom" },
    { date: "2026-09-15", time: "13:45", orderType: "Pickup", orderId: "O1", item: "Coffee beans", variation: null, quantity: 1, price: 8.99, kind: "product" },
    { date: "2026-09-15", time: "13:45", orderType: "Pickup", orderId: "O1", item: "Cookie", variation: null, quantity: 3, price: 2.5, kind: "product" },
    { date: "2026-09-15", time: "15:00", orderType: null, orderId: "O3", item: "Payment", variation: null, quantity: 1, price: 12.34, kind: "custom" },
  ]);
});

test("ordersToRows is deterministic (re-syncs must fingerprint the same)", () => {
  const order = { id: "O9", location_id: "L1", state: "COMPLETED", closed_at: "2026-09-01T12:00:00Z", line_items: [{ name: "Tea", quantity: "1", gross_sales_money: money(300) }] };
  assert.deepEqual(ordersToRows([order], { L1: "UTC" }), ordersToRows([order], { L1: "UTC" }));
});
