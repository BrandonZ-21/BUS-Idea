# Accounts workplan

Last updated: 2026-10-02. Details are in `ACCOUNTS_SETUP.md`.

## Decisions (Brandon's)
- Live site: **bus-idea.pages.dev** (Pages). The old Worker `bus-idea.brandonzhao.workers.dev` stays as a backup and is not touched.
- **Sign-in = connecting Square.** No Google, no passwords.
- **Real Square businesses should be able to connect**, so Production is needed. The Production redirect URL is saved in the Square Developer Console.
- **Saving history is opt-in.** Device-only stays the default, and only summaries are saved, never sales rows.
- **Admin = Brandon only,** and only for the founder dashboard. No reading owners' data, no impersonation, no deleting accounts.
- **Order:** accounts first, then the founder dashboard.
- **Budget:** $0.

## Done (local only)
- [x] Migration `0003`: `accounts`, `saved_reports`, `audit_log` (additive)
- [x] Square sign-in creates a `user` account; the role is never changed by a request
- [x] `/api/account/me`, `/api/account/signout`, `/api/reports` (list/save/delete-all), `/api/reports/:id` (open/delete), `/api/admin/check`
- [x] "Disconnect & delete account" removes keys, sessions, reports and the account
- [x] Strict allow-list validation, 64 KB cap, 50 reports per account, same-origin checks on writes
- [x] Session cookie widened to `Path=/api`; the old `/api/square` cookie is cleared
- [x] Production-ready Square code: `SQUARE_ENVIRONMENT` = sandbox|production, refuses a mismatched app ID
- [x] `scripts/set-role.mjs`: owner-only admin grant/removal, last-admin guard, audit log
- [x] Account card (Home + My Data), saved-report viewer, Sign out; English + Chinese text
- [x] Privacy wording updated; new `public/privacy.html`, linked in the footer
- [x] Tests and handoff docs

## Test results (2026-10-02, run on Brandon's computer)
| Command | Result |
|---|---|
| `npm test` | 23/23 pass (crypto, cookies, config incl. production, report validation, size cap) |
| `npm run test:flow` | 14/14 pass (existing Square flow, unchanged behavior) |
| `npm run test:accounts` | 16/16 pass: visitor refused everywhere; forged cookie refused; A saves and reloads, and a second browser sees it; forged `merchantId`/`role`/`rows` refused; bad JSON/415/413/SQL-text safe; cross-site and no-Origin writes refused; B can't list/open/delete A's report; 50-report cap; admin only via script; admin can't read B's report; last-admin guard; demotion immediate with same cookie; audit rows; sign-out kills the server session; expired session refused; B's disconnect deletes only B |
| Browser check (fake Square copy) | Save → list → open report → reload persists → sign out hides the card; no console errors; 375px phone width, no sideways scroll |

**What these tests did not cover:** they all ran against a **fake Square** and **local D1** (Wrangler's local SQLite simulation of D1). Real D1, real Square Sandbox or Production, and the deployed site are **NOT RUN**.

## Go-live log (2026-10-02, approved step by step)
- [x] Read-only check: account `ac8b305f…` (Brandonzhao@brandeis.edu's Account), Pages `bus-idea`, D1 `counter-db` (`455686fe-…`) had 0 tables, so no backup was needed
- [x] `wrangler.jsonc`: `env.production` sets `SQUARE_ENVIRONMENT="production"` and repeats the D1 binding (Pages rule, checked in the Cloudflare docs); local/preview stay `sandbox`
- [x] Step A: Brandon ran `npm.cmd run db:migrate:remote`. Read-back: 0001–0003 applied; tables `accounts, audit_log, connections, saved_reports, sessions`
- [x] Step B: four Production secrets set by Brandon (names verified only). The first Application ID paste saved 1 character; it was re-entered and redeployed, and the read-back shows a 29-character `sq0idp-…` ID
- [x] Step C: pushed commit `b2787ac`; production deployment `54fe7936` (redeploy after the secrets fix)
- [x] Read-back: status `configured/production`; `/api/reports` and `/api/admin/check` give 401 to visitors; Connect goes to `connect.squareup.com` with read-only scopes; `/privacy` loads
- [x] First real connection failed with `401 service.not_authorized` at the token exchange (the Application Secret was a bad paste). Brandon re-entered it (checked `sq0csp-` in Notepad first)
- [x] Added format checks for the Production/Sandbox app ID and secret, so a bad paste shows "not set up yet" instead of failing after Allow. Pushed commit `666ce4d`, deployment `dbec8c56`
- [x] **Real Production connection works** (Brandon's own Square account, business "Tally"): the callback succeeded, an account was created as `user`, keys are stored encrypted, sync ran (no sales to import)
- [ ] Supervised first real owner: connect → save report → open it in a second browser → sign out → disconnect

## Remaining / blocked
- [ ] **Brandon:** try the Sandbox connect locally (`ACCOUNTS_SETUP.md` → Manual test). Optional now that production is live
- [ ] Make Brandon's own account (`ML6GZG4KHCR85`, business "Tally") admin with `scripts/set-role.mjs --remote ... --yes`. Brandon runs it
- [ ] Bootstrap the remote admin after Brandon signs in on the live site. This needs Brandon's **own** Square business, never the workplace account. Open question: does Brandon have one? If not, admin waits, or uses another approach chosen later.
- [ ] Decide a contact line for `privacy.html`; add a Chinese privacy page
- [ ] Founder dashboard (next phase; builds on `/api/admin/*`)

## Next safe step after an interruption
Run `npm test` and `npm run test:accounts`. If both pass, continue with the manual Sandbox test. Don't run anything with `--remote` without a new approval.
