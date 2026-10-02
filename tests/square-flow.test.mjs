// End-to-end test of Connect -> Sync -> Disconnect against a FAKE Square
// (tests/mock-square.mjs). It copies the site + functions into a temporary
// folder with its own throwaway .dev.vars and database, and runs a separate
// dev server there on 127.0.0.1:8789 -- so it never reads your real
// .dev.vars, never talks to Square, and never touches your local D1 data.
// (wrangler always prefers a project's .dev.vars over --env-file, hence the copy.)
// Run:  npm run test:flow
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { startMockSquare, TEST_APP_ID, TEST_APP_SECRET, ORDER_COUNT } from "./mock-square.mjs";

const SITE = "http://127.0.0.1:8789";
const MOCK_PORT = 8799;
const WRANGLER = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");

let tmp, project, mock, dev;
const jar = new Map();

function wrangler(args) {
  return execFileSync(process.execPath, [WRANGLER, ...args], { cwd: project, encoding: "utf8", env: { ...process.env, CI: "1" } });
}

function query(sql) {
  const out = wrangler(["d1", "execute", "counter-db", "--local", "--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

async function get(path, { cookies = true, origin } = {}) {
  return request(path, { method: "GET", cookies, origin });
}

async function request(path, { method = "GET", body, cookies = true, origin } = {}) {
  const headers = {};
  if (cookies && jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const send = () => fetch(path.startsWith("http") ? path : SITE + path, {
    method, headers, redirect: "manual", body: body === undefined ? undefined : JSON.stringify(body),
  });
  let res;
  try {
    res = await send();
  } catch (err) {
    // After a pause (the database checks), Node may reuse a keep-alive
    // connection the dev server already closed. Retry that once.
    if (err.cause && err.cause.code === "ECONNRESET") res = await send();
    else throw err;
  }
  for (const c of res.headers.getSetCookie()) {
    const [pair, ...attrs] = c.split(";");
    const name = pair.slice(0, pair.indexOf("="));
    if (attrs.some((a) => a.trim() === "Max-Age=0")) jar.delete(name);
    else jar.set(name, pair.slice(pair.indexOf("=") + 1));
  }
  return res;
}

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "tally-square-flow-"));
  project = join(tmp, "project");
  for (const p of ["wrangler.jsonc", "package.json", "functions", "lib", "migrations", "public/index.html", "public/js", "public/css"]) {
    cpSync(join(process.cwd(), p), join(project, p), { recursive: true });
  }
  writeFileSync(join(project, ".dev.vars"), [
    `SQUARE_APPLICATION_ID=${TEST_APP_ID}`,
    `SQUARE_APPLICATION_SECRET=${TEST_APP_SECRET}`,
    `TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`,
    `STATE_SIGNING_KEY=${randomBytes(32).toString("base64")}`,
    `SQUARE_API_BASE_OVERRIDE=http://127.0.0.1:${MOCK_PORT}`,
  ].join("\n"));
  wrangler(["d1", "migrations", "apply", "counter-db", "--local"]);
  mock = await startMockSquare({ port: MOCK_PORT, callbackUrl: `${SITE}/api/square/callback` });
  dev = spawn(process.execPath, [WRANGLER, "pages", "dev", "--ip", "127.0.0.1", "--port", "8789", "--inspector-port", "9339",
    "--show-interactive-dev-session=false"], { cwd: project, stdio: "ignore", env: { ...process.env, CI: "1" } });
  let up = false;
  for (let i = 0; i < 120 && !up; i++) {
    try {
      const r = await fetch(`${SITE}/api/square/status`);
      up = (r.headers.get("content-type") || "").includes("json");
    } catch { /* not up yet */ }
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) throw new Error("dev server didn't start");
  // Safety: stop unless the server is wired to the fake Square.
  const probe = await fetch(`${SITE}/api/square/connect`, { redirect: "manual" });
  if (!String(probe.headers.get("location")).startsWith(`http://127.0.0.1:${MOCK_PORT}/`)) {
    throw new Error("test server isn't using the fake Square -- aborting");
  }
});

after(() => {
  if (dev) dev.kill();
  if (mock) mock.close();
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* files may still be locked on Windows */ }
});

test("full connect -> sync -> disconnect flow", async (t) => {
  await t.test("status before connecting", async () => {
    const s = await (await get("/api/square/status")).json();
    assert.deepEqual(s, { configured: true, environment: "sandbox", connected: false });
  });

  let authorizeUrl;
  await t.test("connect redirects to Square with read-only scopes and sets a state cookie", async () => {
    const res = await get("/api/square/connect");
    assert.equal(res.status, 302);
    authorizeUrl = new URL(res.headers.get("location"));
    assert.equal(authorizeUrl.origin, `http://127.0.0.1:${MOCK_PORT}`);
    assert.equal(authorizeUrl.searchParams.get("scope"), "MERCHANT_PROFILE_READ ORDERS_READ");
    assert.ok(jar.has("tally_oauth_state"));
    const cookie = res.headers.getSetCookie().join("\n");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Path=\/api\/square\/callback/);
  });

  await t.test("a callback with the wrong state is rejected", async () => {
    const res = await get("/api/square/callback?code=MOCK_CODE&state=WRONG");
    assert.equal(new URL(res.headers.get("location")).search, "?square=error&reason=state");
    assert.ok(!jar.has("tally_session"));
  });

  await t.test("cancelling on Square's page comes back as 'denied'", async () => {
    const deny = new URL(authorizeUrl);
    deny.searchParams.set("state", new URL((await get("/api/square/connect")).headers.get("location")).searchParams.get("state"));
    deny.searchParams.set("deny", "1");
    const back = await get(deny.toString(), { cookies: false });
    const res = await get(back.headers.get("location"));
    assert.equal(new URL(res.headers.get("location")).search, "?square=error&reason=denied");
  });

  await t.test("approving connects: tokens exchanged with the app secret, session cookie set", async () => {
    const start = await get("/api/square/connect");
    const back = await get(start.headers.get("location"), { cookies: false });
    const res = await get(back.headers.get("location"));
    assert.equal(res.status, 302);
    assert.equal(new URL(res.headers.get("location")).search, "?square=connected");
    assert.ok(jar.has("tally_session"));
    assert.ok(!jar.has("tally_oauth_state"), "state cookie is cleared");
    const exchange = mock.calls.token.find((c) => c.grant === "authorization_code");
    assert.ok(exchange.usedTestCredentials, "used the test app id/secret, not .dev.vars");
    assert.ok(exchange.versionOk, "sent the pinned Square-Version");
  });

  await t.test("the state can't be replayed", async () => {
    const replay = await get("/api/square/callback?code=MOCK_CODE&state=anything");
    assert.equal(new URL(replay.headers.get("location")).search, "?square=error&reason=state");
  });

  await t.test("database holds only encrypted tokens and a hashed session id", () => {
    const [row] = query("SELECT * FROM connections");
    assert.equal(row.merchant_id, "MOCK_MERCHANT");
    assert.equal(row.business_name, "Mock Cafe");
    const stored = JSON.stringify(row);
    assert.ok(!stored.includes("MOCK_ACCESS") && !stored.includes("MOCK_REFRESH"), "no plaintext tokens");
    assert.notEqual(row.access_token_iv, row.refresh_token_iv);
    const [session] = query("SELECT * FROM sessions");
    assert.match(session.session_id_hash, /^[0-9a-f]{64}$/);
    assert.notEqual(session.session_id_hash, jar.get("tally_session"));
  });

  await t.test("status shows the business name", async () => {
    const s = await (await get("/api/square/status")).json();
    assert.equal(s.connected, true);
    assert.equal(s.businessName, "Mock Cafe");
    assert.equal(s.lastSyncedAt, null);
    assert.ok(!JSON.stringify(s).includes("MOCK_ACCESS"));
  });

  await t.test("sync and disconnect refuse cross-site POSTs", async () => {
    assert.equal((await request("/api/square/sync", { method: "POST", body: {} })).status, 403);
    assert.equal((await request("/api/square/sync", { method: "POST", body: {}, origin: "https://evil.example" })).status, 403);
    assert.equal((await request("/api/square/disconnect", { method: "POST", body: {}, origin: "https://evil.example" })).status, 403);
  });

  await t.test("sync without a session is refused", async () => {
    const res = await request("/api/square/sync", { method: "POST", body: {}, cookies: false, origin: SITE });
    assert.equal(res.status, 401);
  });

  await t.test("full sync pages through every order and refreshes the expiring token", async () => {
    let body = { full: true };
    const rows = [];
    let pages = 0;
    for (;;) {
      const res = await request("/api/square/sync", { method: "POST", body, origin: SITE });
      assert.equal(res.status, 200);
      const data = await res.json();
      rows.push(...data.rows);
      pages++;
      if (data.done) break;
      body = data.next;
    }
    assert.equal(pages, 3, "250 orders in pages of 100");
    assert.equal(rows.length, ORDER_COUNT + ORDER_COUNT / 10, "one row per line item");
    assert.equal(new Set(rows.map((r) => r.orderId)).size, ORDER_COUNT);
    assert.ok(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && /^\d{2}:\d{2}$/.test(r.time)));
    assert.deepEqual(rows.find((r) => r.item === "Croissant"), { ...rows.find((r) => r.item === "Croissant"), quantity: 2, price: 3.75 });
    assert.ok(mock.calls.token.some((c) => c.grant === "refresh_token" && c.usedTestCredentials), "token was refreshed");
    assert.ok(mock.calls.search.every((c) => c.token === "refreshed" && c.completedOnly && c.sortOk && c.versionOk && c.limit === 100));
    assert.equal(mock.calls.search[0].spanDays, 90);
    const [row] = query("SELECT sync_cursor, last_synced_at FROM connections");
    assert.ok(row.sync_cursor && row.last_synced_at);
    // Square's opaque customer id rides along (for the browser to scramble) but is never stored server-side.
    assert.equal(new Set(rows.filter((r) => r.customerId).map((r) => r.orderId)).size, Math.ceil(ORDER_COUNT / 3));
    assert.ok(rows.every((r) => r.customerId === null || /^MOCKCUST\d+$/.test(r.customerId)));
    for (const table of ["connections", "sessions"]) assert.ok(!JSON.stringify(query(`SELECT * FROM ${table}`)).includes("MOCKCUST"), table);
  });

  await t.test("the next sync only asks for the last couple of days", async () => {
    const before = mock.calls.search.length;
    const res = await request("/api/square/sync", { method: "POST", body: {}, origin: SITE });
    const data = await res.json();
    assert.equal(data.done, true);
    assert.equal(mock.calls.search[before].spanDays, 2);
    assert.ok(data.rows.length > 0 && data.rows.length < 40, "only the 2-day overlap");
  });

  await t.test("disconnect revokes at Square and deletes everything", async () => {
    const res = await request("/api/square/disconnect", { method: "POST", body: {}, origin: SITE });
    assert.deepEqual(await res.json(), { disconnected: true, wasConnected: true, revokedAtSquare: true });
    assert.ok(!jar.has("tally_session"));
    assert.deepEqual(mock.calls.revoke, [{ clientHeaderOk: true, merchant: true, clientId: true }]);
    assert.deepEqual(query("SELECT COUNT(*) AS n FROM connections"), [{ n: 0 }]);
    assert.deepEqual(query("SELECT COUNT(*) AS n FROM sessions"), [{ n: 0 }]);
    const s = await (await get("/api/square/status")).json();
    assert.equal(s.connected, false);
  });
});
