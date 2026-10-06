// End-to-end test of usage counting and the founder dashboard API, against a
// FAKE Square and a throwaway copy of the project (own .dev.vars with
// USAGE_EVENTS=on, own database) on 127.0.0.1:8792. Never reads your real
// .dev.vars, never contacts Square, never touches your local or remote D1.
// All browsers, accounts and events here are synthetic test fixtures.
// Run:  npm run test:usage
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { startMockSquare, TEST_APP_ID, TEST_APP_SECRET, MERCHANT_ID } from "./mock-square.mjs";

const SITE = "http://127.0.0.1:8792";
const MOCK_PORT = 8802;
const REPO = process.cwd();
const WRANGLER = join(REPO, "node_modules", "wrangler", "bin", "wrangler.js");
const ID = (c) => c.repeat(22);

let tmp, project, mock, dev;

function wrangler(args) {
  return execFileSync(process.execPath, [WRANGLER, ...args], { cwd: project, encoding: "utf8", env: { ...process.env, CI: "1" } });
}

function query(sql) {
  const out = wrangler(["d1", "execute", "counter-db", "--local", "--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

class Browser {
  constructor() {
    this.jar = new Map();
  }

  async request(path, { method = "GET", body, rawBody, origin = method === "GET" ? undefined : SITE } = {}) {
    const headers = {};
    if (this.jar.size) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (origin) headers.Origin = origin;
    if (body !== undefined || rawBody !== undefined) headers["Content-Type"] = "application/json";
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
    return { status: res.status, data: await res.json().catch(() => null) };
  }

  async signIn() {
    const start = await this.request("/api/square/connect");
    const back = await fetch(start.headers.get("location"), { redirect: "manual" });
    await this.request(back.headers.get("location"));
  }

  track(browserId, event, extra = {}) {
    return this.json("/api/events", { method: "POST", body: { browserId, event, ...extra } });
  }
}

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "tally-usage-flow-"));
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
    "USAGE_EVENTS=on",
  ].join("\n"));
  wrangler(["d1", "migrations", "apply", "counter-db", "--local"]);
  mock = await startMockSquare({ port: MOCK_PORT, callbackUrl: `${SITE}/api/square/callback` });
  dev = spawn(process.execPath, [WRANGLER, "pages", "dev", "--ip", "127.0.0.1", "--port", "8792", "--inspector-port", "9342",
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

test("usage counting and the founder dashboard", async (t) => {
  const page = new Browser(); // anonymous page sending events (no cookies needed)
  const owner = new Browser();

  await t.test("a valid event is stored with only allow-listed fields (no IP, no browser details)", async () => {
    assert.deepEqual(await page.track(ID("x"), "visit"), { status: 202, data: { collecting: true, stored: true } });
    const cols = query("PRAGMA table_info(usage_events)").map((c) => c.name);
    assert.deepEqual(cols, ["id", "at", "day", "browser_id", "event", "reason", "source"]);
    const [row] = query("SELECT browser_id, event, reason, source FROM usage_events");
    assert.deepEqual(row, { browser_id: ID("x"), event: "visit", reason: null, source: null });
  });

  await t.test("sales content, unknown events, bad ids, other sites and oversized bodies are refused", async () => {
    assert.equal((await page.track(ID("x"), "visit", { item: "Latte", amount: 4.5 })).status, 400);
    assert.equal((await page.track(ID("x"), "upload_failed", { reason: "Latte,4.50,2026-13-45" })).status, 400);
    assert.equal((await page.track("not-an-id", "visit")).status, 400);
    assert.equal((await page.track(ID("x"), "drop_table")).status, 400);
    assert.equal((await page.json("/api/events", { method: "POST", body: { browserId: ID("x"), event: "visit" }, origin: "https://evil.example" })).status, 403);
    assert.equal((await page.json("/api/events", { method: "POST", rawBody: JSON.stringify({ pad: "x".repeat(2000) }) })).status, 413);
    assert.equal(query("SELECT COUNT(*) AS n FROM usage_events")[0].n, 1);
  });

  await t.test("one browser can't flood the table: daily cap of 300", async () => {
    const results = [];
    for (let i = 0; i < 301; i++) results.push((await page.track(ID("w"), "report_saved")).data.stored);
    assert.equal(results.filter(Boolean).length, 300);
    assert.equal(results[300], false);
    query(`DELETE FROM usage_events WHERE browser_id = '${ID("w")}'`);
  });

  await t.test("known journeys: one success, one sample-only, one failed upload (with a reload)", async () => {
    for (const [id, event, extra] of [
      ["s", "visit"], ["s", "upload_started", { source: "own" }], ["s", "upload_ok", { source: "own" }],
      ["s", "data_added", { source: "own" }], ["s", "report_viewed", { source: "own" }],
      ["s", "visit"], ["s", "report_viewed", { source: "own" }], // reload
      ["p", "visit"], ["p", "sample_loaded", { source: "sample" }], ["p", "report_viewed", { source: "sample" }],
      ["f", "visit"], ["f", "upload_started", { source: "own" }], ["f", "upload_failed", { reason: "bad_date", source: "own" }],
    ]) assert.equal((await page.track(ID(id), event, extra)).status, 202);
  });

  await t.test("visitors and ordinary users can't read the dashboard", async () => {
    assert.equal((await page.json("/api/admin/usage")).status, 401);
    assert.equal((await page.json("/api/admin/usage?mode=demo")).status, 401);
    await owner.signIn();
    assert.equal((await owner.json("/api/admin/usage")).status, 403);
    assert.equal((await owner.json("/api/admin/usage?mode=demo")).status, 403);
  });

  await t.test("the admin sees the journeys counted by the declared rules", async () => {
    execFileSync(process.execPath, [join(REPO, "scripts", "set-role.mjs"), "--local", MERCHANT_ID, "admin"], { cwd: project, stdio: "pipe" });
    const { status, data } = await owner.json("/api/admin/usage?mode=live&days=7");
    assert.equal(status, 200);
    assert.equal(data.mode, "live");
    assert.equal(data.collecting, true);
    // x (first test), s, p, f visited
    assert.deepEqual(data.firstReport, { visitors: 4, reachedOwn: 1, rate: 0.25 });
    assert.deepEqual(data.funnel.map((s) => s.browsers), [4, 2, 1, 1]);
    assert.deepEqual(data.failures, [{ event: "upload_failed", reason: "bad_date", count: 1, browsers: 1 }]);
    assert.equal(data.trust.sampleOnly, 1);
    assert.equal(data.recentFailures.length, 1);
    assert.ok(!JSON.stringify(data).includes(ID("s")), "browser ids are not sent to the dashboard");
  });

  await t.test("demo mode is labeled, uses made-up numbers, and writes nothing", async () => {
    const before = query("SELECT COUNT(*) AS n FROM usage_events")[0].n;
    const { data } = await owner.json("/api/admin/usage?mode=demo&days=28");
    assert.equal(data.mode, "demo");
    assert.equal(data.firstReport.visitors, 9);
    assert.equal(query("SELECT COUNT(*) AS n FROM usage_events")[0].n, before);
    const live = await owner.json("/api/admin/usage?mode=live&days=7");
    assert.equal(live.data.firstReport.visitors, 4, "demo numbers never leak into live");
  });

  await t.test("the admin can leave their own browser out (past and future) and undo it; nobody else can", async () => {
    const exclude = (who, body, opts = {}) => who.json("/api/admin/exclude-browser", { method: "POST", body, ...opts });
    assert.equal((await exclude(page, { browserId: ID("s"), excluded: true })).status, 401, "visitor");
    assert.equal((await exclude(owner, { browserId: ID("s"), excluded: true }, { origin: "https://evil.example" })).status, 403, "other site");
    assert.equal((await exclude(owner, { browserId: "x' OR 1=1 --", excluded: true })).status, 400);
    assert.equal((await exclude(owner, { browserId: ID("s"), excluded: "yes" })).status, 400);

    // Browser "s" was the one successful journey. Excluded, it drops out of every number...
    assert.deepEqual((await exclude(owner, { browserId: ID("s"), excluded: true })).data, { browserId: ID("s"), excluded: true });
    let live = (await owner.json("/api/admin/usage?mode=live&days=7")).data;
    assert.deepEqual(live.firstReport, { visitors: 3, reachedOwn: 0, rate: 0 });
    assert.deepEqual(live.funnel.map((s) => s.browsers), [3, 1, 0, 0]);
    assert.equal(live.excludedBrowsers, 1);
    // ...its new steps aren't stored, and nothing already stored was deleted.
    const before = query(`SELECT COUNT(*) AS n FROM usage_events WHERE browser_id = '${ID("s")}'`)[0].n;
    assert.deepEqual((await page.track(ID("s"), "visit")).data, { collecting: true, stored: false });
    assert.equal(query(`SELECT COUNT(*) AS n FROM usage_events WHERE browser_id = '${ID("s")}'`)[0].n, before);
    assert.ok(before > 0);
    // Other browsers are unaffected.
    assert.equal((await page.track(ID("p"), "visit")).data.stored, true);

    // Undo: it counts again.
    await exclude(owner, { browserId: ID("s"), excluded: false });
    live = (await owner.json("/api/admin/usage?mode=live&days=7")).data;
    assert.deepEqual(live.firstReport, { visitors: 4, reachedOwn: 1, rate: 0.25 });
    assert.equal(live.excludedBrowsers, 0);
  });

  await t.test("an ordinary signed-in user can't exclude browsers", async () => {
    const other = new Browser();
    const start = await other.request("/api/square/connect");
    const authorize = new URL(start.headers.get("location"));
    authorize.searchParams.set("as", "B");
    const back = await fetch(authorize, { redirect: "manual" });
    await other.request(back.headers.get("location"));
    const res = await other.json("/api/admin/exclude-browser", { method: "POST", body: { browserId: ID("p"), excluded: true } });
    assert.equal(res.status, 403);
    assert.equal(query("SELECT COUNT(*) AS n FROM usage_excluded_browsers")[0].n, 0);
  });

  await t.test("demoting the admin removes dashboard access immediately", async () => {
    execFileSync(process.execPath, [join(REPO, "scripts", "set-role.mjs"), "--local", MERCHANT_ID, "user", "--allow-no-admin"], { cwd: project, stdio: "pipe" });
    assert.equal((await owner.json("/api/admin/usage")).status, 403);
  });
});
