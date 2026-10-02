# Founder dashboard workplan

Last updated: 2026-10-02. The spec is in `DASHBOARD_SPEC.md`.

## Decisions (Brandon's)
- Plan approved 2026-10-02 with option **(a)**: a private web page, signed in with Brandon's own Square account (admin)
- Build local/demo first. **Live counting needs a separate approval.**
- Founder questions: still Brandon's DRAFT wording, to be confirmed in his own words

## Done (local)
- [x] Migration `0004_usage_events.sql` (additive)
- [x] `POST /api/events`: allow-listed, same-origin, 1 KB cap, 300 per browser per day, stores nothing unless `USAGE_EVENTS="on"`
- [x] `GET /api/admin/usage?mode=live|demo&days=7|28`: admin only, re-checked on every request
- [x] `lib/usage/summary.js`: one set of counting rules for live and demo; `lib/usage/demo.js`: made-up events, never stored
- [x] `public/js/usage.js`: random browser ID, respects GPC/DNT, never breaks the app
- [x] Instrumented: visit, sample, upload start/ok/fail (reason codes), data added, report viewed, Square connect/sync, report saved
- [x] `public/js/founder.js` + `#/founder` route; "Founder" nav link for admins only; English only
- [x] Privacy page section; `.dev.vars.example` documents `USAGE_EVENTS`

## Test results (2026-10-02, Brandon's computer)
| Command | Result |
|---|---|
| `npm test` | 34/34 pass, including counting rules: success journey, failure not counted as success, sample ≠ own, reload counts once, came-back days, window edge, zero denominators → `--`, demo numbers, off switch stores nothing |
| `npm run test:usage` | 9/9 pass: only allow-listed columns (no IP/UA); sales text, unknown events, bad IDs, other sites, oversized bodies refused; 300/day cap; visitor 401 and user 403 (live and demo); admin sees journeys counted correctly; demo writes nothing and doesn't leak into live; demotion removes access |
| `npm run test:flow` / `npm run test:accounts` | 14/14, 16/16 pass |
| Browser check (throwaway copy, fake Square) | Demo and Live render with clear labels; a real `.pdf` and a bad-date CSV through the app's own upload code show up as "File type not supported" / "Dates not recognized"; the database holds no file text; no console errors; 375 px, no sideways scroll |

**NOT RUN:** counting on the live site (it's off), and real owners' behaviour.

## Live counting turned on (2026-10-02, approved by Brandon)
- [x] `wrangler.jsonc`: `env.production.vars.USAGE_EVENTS = "on"` (local and preview stay off)
- [x] Pushed commit `73a1ce9` (deployment `03e51634`)
- [x] Brandon made `ML6GZG4KHCR85` admin with `set-role.mjs --remote`. Read-back: role = admin
- [x] Migration 0004 applied remotely (the first attempt hadn't run; re-run confirmed: "No migrations to apply")
- [x] Read-back, with no test data written to production: `/api/events` accepts input (400 on an empty body, i.e. counting is on); `/api/admin/usage` → 401 for visitors in live and demo; `usage_events` has 0 rows. **Counting starts from the next real visit**
- Note: Brandon's own visits are counted too (as one browser). Keep that in mind when reading small numbers

## Remaining
- [ ] Brandon: confirm or rewrite the three founder questions; add real tester observations after tomorrow
- [ ] Tell testers that anonymous steps are counted (the privacy page describes it)
- [ ] **To stop counting:** remove the `USAGE_EVENTS` line from `env.production.vars` and push

## Run / test commands
```
npm test                 # unit (no server)
npm run test:usage       # dashboard + counting end to end (fake Square, throwaway DB)
npm run test:accounts
npm run test:flow
```
Local look: add `USAGE_EVENTS=on` to `.dev.vars`, run `npm.cmd run db:migrate:local`, then `npm.cmd run dev`. Sign in with your Sandbox seller and make it admin with `node scripts/set-role.mjs --local <ID> admin`. Then open http://localhost:8788/#/founder.

## Next safe step after an interruption
Run `npm test` and `npm run test:usage`. Don't enable `USAGE_EVENTS` on production or run `--remote` without a new approval.
