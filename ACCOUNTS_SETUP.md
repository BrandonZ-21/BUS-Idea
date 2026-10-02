# Tally accounts: how they work and how to run them

## The picture

```
browser (public/js/account.js, square-sync.js)
   │  same-origin fetch, HttpOnly session cookie (Path=/api)
   ▼
Cloudflare Pages Functions  (functions/api/*)
   ├─ /api/square/connect, /callback   → Square OAuth (read-only scopes) = sign-in
   ├─ /api/account/me, /signout
   ├─ /api/reports, /api/reports/:id   → the owner's own saved summaries
   └─ /api/admin/check                 → admin gate (no data behind it yet)
   ▼
D1 database "counter-db"  (binding DB)
   connections · sessions · accounts · saved_reports · audit_log
```

No R2: Tally never stores files.

## What is stored where

| Data | Where | Notes |
|---|---|---|
| Sales rows (uploaded or synced) | Browser only (IndexedDB) | Unchanged. Never sent to the server. |
| Square access/refresh keys | D1 `connections` | AES-GCM encrypted with `TOKEN_ENCRYPTION_KEY`. |
| Sign-in sessions | D1 `sessions` | Only a SHA-256 hash of the cookie value. 30 days. |
| Account + role | D1 `accounts` | Keyed by Square merchant ID. Role is `user` (default) or `admin`. |
| Saved report summaries (opt-in) | D1 `saved_reports` | Allow-listed fields only: date range, totals, weekday/hour averages, top 10 items, insight sentences. Max 64 KB each, 50 per account. |
| Role changes | D1 `audit_log` | Who, what, when. No sales data. |

## Who can do what

- **Visitor:** uses the whole app with uploads, as before. No account needed.
- **Signed-in owner (`user`):** saves, lists, opens and deletes **their own** reports; signs out; "Disconnect & delete account" removes keys, sessions, reports and the account.
- **Admin:** passes `/api/admin/check`. That's all for now. There is **no** admin endpoint for reading anyone's reports or Square data, no impersonation, and no account deletion. The founder dashboard (next phase) will build on this gate.
- **Honest limit:** whoever controls the Cloudflare account can open D1 directly. The privacy page (`public/privacy.html`) says so.

Every check happens on the server: the owner always comes from the session (never from the request body), and the role is re-read from D1 on every request. Unknown fields such as `merchantId`, `role` or `rows` get a 400 response.

## Making someone admin (owner only)

There is no web page for this on purpose.

1. The person signs in with Square once (that creates their `user` account).
2. List accounts and confirm the right merchant ID and business name. The ID is also shown on the account card under **Account details**.
   ```
   node scripts/set-role.mjs --local --list
   ```
3. Grant admin:
   ```
   node scripts/set-role.mjs --local <MERCHANT_ID> admin
   ```
4. Remove admin with `... <MERCHANT_ID> user`. The script refuses to remove the **last** admin unless you add `--allow-no-admin`.
5. For the real database, use `--remote --yes` instead of `--local`, **only after approval** and after `npx.cmd wrangler login`.

## Local commands (safe: your computer only)

```
npm install                    # once
npm run db:migrate:local       # creates/updates the local test database
npm run dev                    # http://localhost:8788 (uses .dev.vars, Sandbox)
npm test                       # unit tests (no server)
npm run test:flow              # Square connect/sync/disconnect vs fake Square
npm run test:accounts          # accounts, A-vs-B, admin, sign-out vs fake Square
```

`test:flow` and `test:accounts` copy the project to a temp folder with throwaway keys and a fake Square. They never read your `.dev.vars`, never contact Square, and never touch your local or remote database.

## Secrets and settings (names only, never values)

| Name | Where | Notes |
|---|---|---|
| `SQUARE_APPLICATION_ID` | `.dev.vars` (Sandbox) / Cloudflare secret (Production) | Sandbox IDs start `sandbox-`. |
| `SQUARE_APPLICATION_SECRET` | same | |
| `TOKEN_ENCRYPTION_KEY` | same | 32 random bytes, base64. **New** value for the deployed site. |
| `STATE_SIGNING_KEY` | same | 32 random bytes, base64. **New** value for the deployed site. |
| `SQUARE_ENVIRONMENT` | `wrangler.jsonc` vars | `"sandbox"` or `"production"`. The code refuses a mismatch with the app ID. |
| `SQUARE_API_BASE_OVERRIDE` | tests only | Ignored unless it's `http://localhost`/`127.0.0.1`. Never set it on Cloudflare. |

Square Developer Console redirect URLs:
- Sandbox: `http://localhost:8788/api/square/callback`
- Production: `https://bus-idea.pages.dev/api/square/callback` (already saved by Brandon, 2026-10-02)

## Go-live (each step needs separate approval; not done yet)

1. **Confirm the account:** `npx.cmd wrangler whoami`, which must show Brandon's account owning Pages project `bus-idea` and D1 `counter-db` (`455686fe-…`).
2. **Back up first:** `npx.cmd wrangler d1 export counter-db --remote --output backup-before-0003.sql` (keep it out of git).
3. **Migrate:** `npm run db:migrate:remote` applies 0001–0003. They're additive only.
4. **Production setting:** make the deployed site use `SQUARE_ENVIRONMENT="production"` while local dev stays `"sandbox"`. Planned approach: an `env.production` block in `wrangler.jsonc`. Check Cloudflare's current Pages config docs first, because Pages requires bindings such as `d1_databases` to be repeated inside `env.production`.
5. **Secrets:** Brandon enters them with `npx.cmd wrangler pages secret put <NAME> --project-name bus-idea` (hidden prompt). Use Production Square keys and new random encryption/signing keys.
6. **Deploy:** push with GitHub Desktop.
7. **Read back:** check that `/api/square/status` shows `configured: true, environment: "production"`. Then do one supervised real connection, save a report, open it in a second browser, sign out, and confirm a different signed-in seller can't open its id.

**Rollback:** the app code rolls back by redeploying the previous commit in Cloudflare Pages → Deployments. Migration 0003 only adds tables, so the old code ignores them. If needed, restore data from the step-2 export. Revoking every Square connection: rotate the Square app secret in the Developer Console.

## Limits and costs

- $0: D1 Free (5M rows read/day, 100k written/day, 500 MB per database) and Workers Free (100k requests/day) are far above class-test use. No R2, no new services, no new npm packages.
- Not a global rate limiter: abuse controls are the 64 KB body cap, the 50-reports-per-account cap, same-origin checks, and Square's own sign-in. Cloudflare usage alerts aren't a spending cap.
- Expired sessions are deleted on the next lookup.

## Not built

- The founder dashboard and usage events (next phase).
- A Chinese version of `privacy.html` (the in-app text is bilingual).
- A contact line on the privacy page (Brandon to decide what to publish).
- Sign-in for owners who don't use Square (they keep device-only history).

## Manual test for a group member (local, Sandbox)

1. `npm run db:migrate:local`, then `npm run dev`, and open http://localhost:8788.
2. Keep the Sandbox test seller's **Square Dashboard** tab open in the same browser (see SETUP.md step 5).
3. Click **Connect Square** → **Allow**. You come back to Tally and the sync runs.
4. **My Data** → **Your Tally account** → **Save this report to my account**. "Saved to your account." appears, and the report is listed.
5. Click **Open**. Totals, days, top items and insights show.
6. Open a **private/incognito window** and connect the same Sandbox seller. The same saved report is listed in the account card (Home page bottom, or My Data once the sync finishes).
7. Click **Sign out**. The account card disappears and "Signed out of this browser" shows. The other window is still signed in.
8. **Disconnect & delete account** → confirm. In the other window, refresh: the account is gone.
