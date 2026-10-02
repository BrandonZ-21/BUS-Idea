// End-to-end test of accounts, saved reports and the admin gate, against a
// FAKE Square (tests/mock-square.mjs) with two fake sellers. Like
// square-flow.test.mjs it copies the project into a temporary folder with
// its own throwaway .dev.vars and database, on 127.0.0.1:8790 -- it never
// reads your real .dev.vars, never talks to Square, never touches your local
// or remote D1 data. All accounts and reports here are synthetic fixtures.
// Run:  npm run test:accounts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { startMockSquare, TEST_APP_ID, TEST_APP_SECRET, MERCHANT_ID, MERCHANT_ID_B } from "./mock-square.mjs";
import { sampleReport } from "./report-fixture.mjs";

const SITE = "http://127.0.0.1:8790";
const MOCK_PORT = 8800;
const REPO = process.cwd();
const WRANGLER = join(REPO, "node_modules", "wrangler", "bin", "wrangler.js");

let tmp, project, mock, dev;

function wrangler(args) {
  return execFileSync(process.execPath, [WRANGLER, ...args], { cwd: project, encoding: "utf8", env: { ...process.env, CI: "1" } });
}

function query(sql) {
  const out = wrangler(["d1", "execute", "counter-db", "--local", "--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

// The owner's role script, run exactly as documented, against the temp database.
function setRole(...args) {
  try {
    return { ok: true, out: execFileSync(process.execPath, [join(REPO, "scripts", "set-role.mjs"), ...args], { cwd: project, encoding: "utf8", stdio: "pipe" }) };
  } catch (err) {
    return { ok: false, out: String(err.stderr || "") };
  }
}

// One browser: its own cookie jar.
class Browser {
  constructor() {
    this.jar = new Map();
  }

  async request(path, { method = "GET", body, rawBody, origin = method === "GET" ? undefined : SITE, contentType, cookies = true } = {}) {
    const headers = {};
    if (cookies && this.jar.size) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (origin) headers.Origin = origin;
    if (body !== undefined || rawBody !== undefined) headers["Content-Type"] = contentType || "application/json";
    const send = () => fetch(path.startsWith("http") ? path : SITE + path, {
      method, headers, redirect: "manual", body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
    });
    let res;
    try {
      res = await send();
    } catch (err) {
      if (err.cause && err.cause.code === "ECONNRESET") res = await send();
      else throw err;
    }
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(";");
      const name = pair.slice(0, pair.indexOf("="));
      if (attrs.some((a) => a.trim() === "Max-Age=0")) this.jar.delete(name);
      else this.jar.set(name, pair.slice(pair.indexOf("=") + 1));
    }
    return res;
  }

  async json(path, opts) {
    const res = await this.request(path, opts);
    return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
  }

  // Connect Square (fake) as seller A or B.
  async signIn(as) {
    const start = await this.request("/api/square/connect");
    const authorize = new URL(start.headers.get("location"));
    if (as === "B") authorize.searchParams.set("as", "B");
    const back = await fetch(authorize, { redirect: "manual" });
    const done = await this.request(back.headers.get("location"));
    assert.equal(new URL(done.headers.get("location")).search, "?square=connected");
  }
}

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "tally-accounts-flow-"));
  project = join(tmp, "project");
  for (const p of ["wrangler.jsonc", "package.json", "functions", "lib", "migrations", "public/index.html", "public/js", "public/css"]) {
    cpSync(join(REPO, p), join(project, p), { recursive: true });
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
  dev = spawn(process.execPath, [WRANGLER, "pages", "dev", "--ip", "127.0.0.1", "--port", "8790", "--inspector-port", "9340",
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

test("accounts, saved reports and the admin gate", async (t) => {
  const visitor = new Browser();
  const a = new Browser();
  const b = new Browser();
  const a2 = new Browser(); // User A on a second browser/device
  let reportA;

  await t.test("visitor: not signed in, and every private endpoint refuses", async () => {
    assert.deepEqual((await visitor.json("/api/account/me")).data, { signedIn: false });
    assert.equal((await visitor.json("/api/reports")).status, 401);
    assert.equal((await visitor.json("/api/reports", { method: "POST", body: sampleReport() })).status, 401);
    assert.equal((await visitor.json("/api/reports", { method: "DELETE" })).status, 401);
    assert.equal((await visitor.json("/api/admin/check")).status, 401);
    // A made-up session cookie is just "not signed in".
    visitor.jar.set("tally_session", "forged-session-value");
    assert.equal((await visitor.json("/api/reports")).status, 401);
    assert.equal((await visitor.json("/api/admin/check")).status, 401);
  });

  await t.test("the public app still loads without signing in", async () => {
    const res = await fetch(`${SITE}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /js\/account\.js/);
  });

  await t.test("User A signs in with Square and starts as an ordinary user", async () => {
    await a.signIn("A");
    const me = await a.json("/api/account/me");
    assert.deepEqual(me.data, { signedIn: true, merchantId: MERCHANT_ID, businessName: "Mock Cafe", role: "user" });
    assert.equal(me.headers.get("cache-control"), "no-store");
    assert.equal((await a.json("/api/admin/check")).status, 403);
    assert.deepEqual(query("SELECT merchant_id, role FROM accounts"), [{ merchant_id: MERCHANT_ID, role: "user" }]);
  });

  await t.test("the session cookie is HttpOnly, SameSite=Lax and scoped to /api", async () => {
    const c = new Browser();
    const start = await c.request("/api/square/connect");
    const back = await fetch(start.headers.get("location"), { redirect: "manual" });
    const done = await c.request(back.headers.get("location"));
    const set = done.headers.getSetCookie().find((x) => x.startsWith("tally_session=") && !/Max-Age=0/.test(x));
    assert.match(set, /HttpOnly/);
    assert.match(set, /SameSite=Lax/);
    assert.match(set, /Path=\/api;/);
    await c.request("/api/account/signout", { method: "POST", body: {} });
  });

  await t.test("User A saves a report; it persists and shows on another browser", async () => {
    const saved = await a.json("/api/reports", { method: "POST", body: sampleReport() });
    assert.equal(saved.status, 201);
    reportA = saved.data.id;
    const list = await a.json("/api/reports");
    assert.equal(list.data.reports.length, 1);
    assert.deepEqual(list.data.reports[0], { ...list.data.reports[0], id: reportA, periodStart: "2026-08-01", periodEnd: "2026-08-28", totalSales: 12345.68, orders: 980 });
    const one = await a.json(`/api/reports/${reportA}`);
    assert.equal(one.data.report.topItems[0].name, "Latte");
    // Second device: a fresh browser that signs in as the same seller sees it.
    await a2.signIn("A");
    assert.deepEqual((await a2.json("/api/reports")).data.reports.map((r) => r.id), [reportA]);
    // Stored row holds only the allow-listed summary.
    const [row] = query("SELECT merchant_id, summary_json FROM saved_reports");
    assert.equal(row.merchant_id, MERCHANT_ID);
    assert.deepEqual(Object.keys(JSON.parse(row.summary_json)), ["v", "source", "periodStart", "periodEnd", "totals", "byWeekday", "byHour", "topItems", "insights"]);
  });

  await t.test("forged owner/role fields and raw rows are refused, not stored", async () => {
    for (const extra of [{ merchantId: MERCHANT_ID_B }, { role: "admin" }, { rows: [{ date: "2026-08-01", item: "Latte" }] }]) {
      const res = await a.json("/api/reports", { method: "POST", body: sampleReport(extra) });
      assert.equal(res.status, 400, JSON.stringify(extra));
      assert.equal(res.data.error, "invalid_report");
    }
    assert.equal(query("SELECT COUNT(*) AS n FROM saved_reports")[0].n, 1);
    assert.equal((await a.json("/api/account/me")).data.role, "user");
  });

  await t.test("bad requests fail safely", async () => {
    assert.equal((await a.json("/api/reports", { method: "POST", rawBody: "{not json" })).status, 400);
    assert.equal((await a.json("/api/reports", { method: "POST", rawBody: JSON.stringify(sampleReport()), contentType: "text/plain" })).status, 415);
    const huge = await a.json("/api/reports", { method: "POST", rawBody: JSON.stringify({ pad: "x".repeat(70 * 1024) }) });
    assert.equal(huge.status, 413);
    const sqlish = await a.json("/api/reports", { method: "POST", body: sampleReport({ topItems: [{ name: "'); DROP TABLE saved_reports; --", quantity: 1, revenue: 1 }] }) });
    assert.equal(sqlish.status, 201);
    assert.equal((await a.json(`/api/reports/${sqlish.data.id}`)).data.report.topItems[0].name, "'); DROP TABLE saved_reports; --");
    assert.equal((await a.json(`/api/reports/${encodeURIComponent("' OR 1=1 --")}`)).status, 404);
    assert.equal((await a.json(`/api/reports/${sqlish.data.id}`, { method: "DELETE" })).status, 200);
    assert.equal(query("SELECT COUNT(*) AS n FROM saved_reports")[0].n, 1, "table intact, injection text stored as plain text");
  });

  await t.test("writes from another site, or with no Origin, are refused", async () => {
    assert.equal((await a.json("/api/reports", { method: "POST", body: sampleReport(), origin: "https://evil.example" })).status, 403);
    assert.equal((await a.json("/api/reports", { method: "POST", body: sampleReport(), origin: null })).status, 403);
    assert.equal((await a.json(`/api/reports/${reportA}`, { method: "DELETE", origin: "https://evil.example" })).status, 403);
    assert.equal((await a.json("/api/reports", { method: "DELETE", origin: "https://evil.example" })).status, 403);
    assert.equal((await a.json("/api/account/signout", { method: "POST", body: {}, origin: "https://evil.example" })).status, 403);
    assert.equal((await a.json("/api/reports")).data.reports.length, 1);
  });

  await t.test("User B can't see, read or delete User A's report", async () => {
    await b.signIn("B");
    assert.equal((await b.json("/api/account/me")).data.merchantId, MERCHANT_ID_B);
    assert.deepEqual((await b.json("/api/reports")).data.reports, []);
    assert.equal((await b.json(`/api/reports/${reportA}`)).status, 404);
    assert.equal((await b.json(`/api/reports/${reportA}`, { method: "DELETE" })).status, 404);
    assert.deepEqual((await b.json("/api/reports", { method: "DELETE" })).data, { deleted: 0 });
    assert.equal((await a.json(`/api/reports/${reportA}`)).status, 200, "A's report is untouched");
    assert.equal((await b.json("/api/admin/check")).status, 403);
  });

  await t.test("the per-account limit of 50 holds", async () => {
    for (let i = 0; i < 50; i++) assert.equal((await b.json("/api/reports", { method: "POST", body: sampleReport() })).status, 201);
    const over = await b.json("/api/reports", { method: "POST", body: sampleReport() });
    assert.equal(over.status, 409);
    assert.equal(query(`SELECT COUNT(*) AS n FROM saved_reports WHERE merchant_id = '${MERCHANT_ID_B}'`)[0].n, 50);
    assert.deepEqual((await b.json("/api/reports", { method: "DELETE" })).data, { deleted: 50 });
  });

  await t.test("admin: granted only by the owner script, checked fresh on every request", async () => {
    assert.equal(setRole(MERCHANT_ID, "admin").ok, false, "refuses without --local/--remote");
    assert.equal(setRole("--remote", MERCHANT_ID, "admin").ok, false, "refuses --remote without --yes");
    assert.equal(setRole("--local", "NOBODY", "admin").ok, false, "account must exist");
    assert.equal(setRole("--local", "x' OR '1'='1", "admin").ok, false, "id is validated");
    const grant = setRole("--local", MERCHANT_ID, "admin");
    assert.ok(grant.ok, grant.out);
    assert.equal((await a.json("/api/admin/check")).status, 200);
    assert.equal((await a.json("/api/account/me")).data.role, "admin");
    // Admin is NOT a way into someone else's data.
    const bReport = (await b.json("/api/reports", { method: "POST", body: sampleReport() })).data.id;
    assert.equal((await a.json(`/api/reports/${bReport}`)).status, 404);
    assert.equal((await a.json(`/api/reports/${bReport}`, { method: "DELETE" })).status, 404);
    assert.equal((await b.json("/api/admin/check")).status, 403, "B is still not admin");
  });

  await t.test("the last admin can't be removed by accident; demotion takes effect immediately", async () => {
    const refused = setRole("--local", MERCHANT_ID, "user");
    assert.equal(refused.ok, false);
    assert.match(refused.out, /last admin/);
    assert.equal((await a.json("/api/admin/check")).status, 200);
    const demote = setRole("--local", MERCHANT_ID, "user", "--allow-no-admin");
    assert.ok(demote.ok, demote.out);
    assert.equal((await a.json("/api/admin/check")).status, 403, "same cookie, no admin any more");
    assert.deepEqual(query("SELECT actor, action, subject, detail FROM audit_log ORDER BY id"), [
      { actor: "owner-cli", action: "role_change", subject: MERCHANT_ID, detail: "user->admin" },
      { actor: "owner-cli", action: "role_change", subject: MERCHANT_ID, detail: "admin->user" },
    ]);
  });

  await t.test("sign out ends the session on the server; the old cookie stops working", async () => {
    const oldCookie = a.jar.get("tally_session");
    const out = await a.json("/api/account/signout", { method: "POST", body: {} });
    assert.deepEqual(out.data, { signedOut: true });
    assert.ok(!a.jar.has("tally_session"));
    assert.deepEqual((await a.json("/api/account/me")).data, { signedIn: false });
    const replay = new Browser();
    replay.jar.set("tally_session", oldCookie);
    assert.equal((await replay.json("/api/reports")).status, 401);
    assert.equal((await a2.json("/api/reports")).data.reports.length, 1, "A's other browser and saved report are kept");
  });

  await t.test("an expired session is refused", async () => {
    query(`UPDATE sessions SET expires_at = 1 WHERE merchant_id = '${MERCHANT_ID}'`);
    assert.equal((await a2.json("/api/reports")).status, 401);
    assert.deepEqual((await a2.json("/api/account/me")).data, { signedIn: false });
  });

  await t.test("disconnect & delete removes only that seller's account, tokens, sessions and reports", async () => {
    const res = await b.json("/api/square/disconnect", { method: "POST", body: {} });
    assert.equal(res.data.disconnected, true);
    for (const table of ["accounts", "connections", "sessions", "saved_reports"]) {
      assert.equal(query(`SELECT COUNT(*) AS n FROM ${table} WHERE merchant_id = '${MERCHANT_ID_B}'`)[0].n, 0, table);
    }
    assert.equal(query(`SELECT COUNT(*) AS n FROM saved_reports WHERE merchant_id = '${MERCHANT_ID}'`)[0].n, 1, "A's data untouched");
    assert.equal(query(`SELECT COUNT(*) AS n FROM accounts WHERE merchant_id = '${MERCHANT_ID}'`)[0].n, 1);
  });
});
