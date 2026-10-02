# Founder dashboard spec

Page: `#/founder` (admin only, enforced by `/api/admin/usage`). Built 2026-10-02.

## Founder questions
These are Brandon's DRAFT wording from the BUS131 handout. **Brandon to confirm or rewrite in his own words.**
1. Do owners get from the landing page to a first report on **their own** data without help?
2. Where do they stop: file not recognized, upload fails, Square connect step, or distrust before trying?
3. Do they come back with new data?

Riskiest assumption: owners will trust a student-built tool with their real sales data.
Next decision (draft): polish CSV upload vs. the Square connection, based on which path owners actually complete.

## Signals
All counts are **browsers** (random IDs), not people. Window: last 7 or 28 days (UTC). A rate is shown as `--` when its denominator is 0.

| # | Signal | Definition | Supports |
|---|---|---|---|
| 1 | First report on own data | browsers with `report_viewed` (source own) ÷ browsers with `visit` | Q1 |
| 2 | Came back with new data | browsers with `data_added` (own/square) on 2+ different days ÷ browsers with any own `data_added` | Q3 |
| 3 | Trust | browsers that loaded a sample but never tried their own data; Square connects finished ÷ started (a finished connect counts as started); accounts with a saved report (all time) | riskiest assumption |
| 4 | Where people stop | browsers at: opened → tried own data → own data got in → report on own data; failures grouped by step and reason code | Q2 |
| 5 | Recent failures | last 20 `upload_failed` / `square_connect_failed` / `square_sync_failed`, any date | the operating issue (owners who tried and got nothing) |

Each card on the page states its definition, source, what it doesn't tell you, and a question to ask a real owner.

## Events (`lib/usage/events.js` is the source of truth)
`visit`, `sample_loaded`, `upload_started`, `upload_ok`, `upload_failed` (reasons: `unsupported_type`, `read_error`, `empty_file`, `missing_columns`, `no_item_column`, `bad_date`, `bad_price`, `no_valid_rows`, `error`), `data_added`, `report_viewed`, `square_connect_started`, `square_connected`, `square_connect_failed` (`denied`, `state`, `config`, `error`), `square_sync_ok`, `square_sync_failed` (`session_ended`, `failed`), `report_saved`.

Source tag: `own` / `sample` / `square` / `unknown`. `unknown` means data saved before counting existed. Sample data never counts as the owner's own.

## Data sources and modes
- **Demo:** made-up events generated in memory (`lib/usage/demo.js`), never stored, labeled "DEMO: made-up data" with a dashed amber banner.
- **Live:** table `usage_events` (migration 0004). Stored **only** when `USAGE_EVENTS` = `"on"` for that environment. Off on the live site until approved.
- **Manual observations:** the "Next experiment" note, saved in the admin's browser only (localStorage).
- Automated tests use throwaway databases, so they never inflate live counts.

## Privacy decisions
- Stored per event: time, day, random browser ID, event name, reason code, source tag. Nothing else, enforced by a strict allow-list (extra fields get a 400).
- Not stored: sales, item names, amounts, file names or contents, business names, IPs, user agents, cookies.
- The browser ID is random (crypto), kept in IndexedDB settings, and replaced by "Delete all my data". It isn't a fingerprint.
- Global Privacy Control or Do Not Track means nothing is sent.
- The dashboard never sees browser IDs, saved reports or Square data.
- The privacy page describes all of this.

## Known blind spots
- People who leave before the app loads, or block scripts, aren't counted.
- Browsers aren't people: two devices count as two, and deleting data starts a new ID.
- A café may need Tally monthly, so a 7- or 28-day "came back" window undercounts.
- `/api/events` has to be public. Anyone could send fake allow-listed events. Limits: same-origin check, 1 KB body, 300 events per browser ID per day. A determined spammer could still rotate IDs. **This is not a guarantee.**
- With a handful of testers: no statistical significance, causation or product-market-fit claims.

## Not built
- Live counting on the deployed site (needs separate approval)
- A Chinese translation of the dashboard (founder-only, English for now)
- Export, filters beyond 7/28 days, per-person views, messaging, any admin action on users
