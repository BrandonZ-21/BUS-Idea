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

## Remaining / blocked
- [ ] **Brandon:** try the real Sandbox connect locally (`ACCOUNTS_SETUP.md` → Manual test)
- [ ] **Go-live (separate approval):** back up the remote DB, apply remote migrations, set the production environment in `wrangler.jsonc` (verify Pages env syntax first), Brandon enters the Production secrets, push, read back, then a supervised first real owner
- [ ] Bootstrap the remote admin after Brandon signs in on the live site. This needs Brandon's **own** Square business, never the workplace account. Open question: does Brandon have one? If not, admin waits, or uses another approach chosen later.
- [ ] Decide a contact line for `privacy.html`; add a Chinese privacy page
- [ ] Founder dashboard (next phase; builds on `/api/admin/*`)

## Next safe step after an interruption
Run `npm test` and `npm run test:accounts`. If both pass, continue with the manual Sandbox test. Don't run anything with `--remote` without a new approval.
