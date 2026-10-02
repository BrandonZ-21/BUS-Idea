// Owner-only: list accounts, or change one account's role. There is no web
// page or endpoint for this on purpose -- only someone with this project and
// Wrangler access to the database can run it.
//
//   node scripts/set-role.mjs --local --list
//   node scripts/set-role.mjs --local <merchantId> admin
//   node scripts/set-role.mjs --local <merchantId> user
//   node scripts/set-role.mjs --remote ... --yes       (the REAL database -- only after approval)
//
// Safety rules:
//   - --local or --remote must be given; --remote also needs --yes.
//   - The account must already exist (the person signed in with Square once).
//   - The last admin can't be demoted unless --allow-no-admin is given.
//   - Every change writes an audit_log row, and the result is read back.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DB_NAME = "counter-db";
const WRANGLER = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", "wrangler", "bin", "wrangler.js");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [merchantId, role] = args.filter((a) => !a.startsWith("--"));

function stop(msg) {
  console.error(msg);
  process.exit(1);
}

const local = flags.has("--local");
const remote = flags.has("--remote");
if (local === remote) stop("Say exactly one of --local (your computer's test database) or --remote (the real one).");
if (remote && !flags.has("--yes")) stop(`--remote changes the REAL database "${DB_NAME}". Add --yes once you're sure.`);
const mode = local ? "--local" : "--remote";

function sql(command) {
  const out = execFileSync(process.execPath, [WRANGLER, "d1", "execute", DB_NAME, mode, "--json", "--command", command], {
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  return parsed[parsed.length - 1].results || [];
}

const LIST_SQL = `SELECT a.merchant_id, a.role, c.business_name, datetime(a.created_at, 'unixepoch') AS created
  FROM accounts a LEFT JOIN connections c ON c.merchant_id = a.merchant_id ORDER BY a.created_at`;

if (flags.has("--list")) {
  console.table(sql(LIST_SQL));
  process.exit(0);
}

// Wrangler's --command can't take parameters, so the id is checked strictly
// before it goes anywhere near SQL. Square merchant ids are letters/digits.
if (!merchantId || !/^[A-Za-z0-9_-]{1,64}$/.test(merchantId)) stop("Give a merchant id (letters, digits, - or _). See --list.");
if (role !== "admin" && role !== "user") stop('Role must be "admin" or "user".');

const [current] = sql(`SELECT merchant_id, role FROM accounts WHERE merchant_id = '${merchantId}'`);
if (!current) stop(`No account "${merchantId}". The person must sign in with Square once first. See --list.`);
if (current.role === role) {
  console.log(`${merchantId} is already "${role}". Nothing changed.`);
  process.exit(0);
}

const keepAnAdmin = role === "user" && !flags.has("--allow-no-admin")
  ? ` AND (SELECT COUNT(*) FROM accounts WHERE role = 'admin') > 1`
  : "";
sql(`UPDATE accounts SET role = '${role}' WHERE merchant_id = '${merchantId}'${keepAnAdmin};
  INSERT INTO audit_log (actor, action, subject, detail)
    SELECT 'owner-cli', 'role_change', '${merchantId}', '${current.role}->${role}'
    WHERE (SELECT role FROM accounts WHERE merchant_id = '${merchantId}') = '${role}';`);

const [after] = sql(`SELECT role FROM accounts WHERE merchant_id = '${merchantId}'`);
if (after.role !== role) stop(`Not changed: ${merchantId} is the last admin. Add --allow-no-admin if you really mean it.`);
console.log(`Done (${local ? "local" : "REMOTE"}): ${merchantId} is now "${after.role}" (was "${current.role}").`);
