# Tally advice upgrade: plan

Written 2026-10-27. **Status: approved and built locally on 2026-10-27; nothing deployed or pushed.**
Decisions: weather turns on with one tap (not automatically); anonymous "shown/useful" counts on; Brandeis stays a hand-edited dates file (feed not used, reuse terms unclear); Waltham feed not used; no BLS key.
See TESTING_ADVICE.md (how to test), MAINTENANCE.md (monthly checklist, deploy order), FREE_TIER_NOTES.md (limits), ZH_REVIEW.md (Chinese to review).

---

## 1. What I found in the code (trust this over the README)

**Already built, and I will reuse it rather than rebuild:**

| Area | Where | What it already does |
|---|---|---|
| Advice engine | `public/js/insights.js` | 12 rule-based insights (busiest hours, quiet hours, best/slow day, top sellers, slow sellers, **items bought together**, order size, recent trend, seasonality, refunds, discounts, **channels**). Each has a minimum sample (`INSIGHT_MIN`), returns "not enough data" with what's missing, and a High/Medium/Low confidence from sample size. Picks a Top 3 (max one per topic). |
| Advice wording | `public/js/insight-text.js` | Fixed EN + ZH templates. Each card already has headline, evidence, why it matters, try this, how to tell if it worked, confidence + caveat. A test checks every number in the text comes from the facts. |
| Cards on screen | `app.js` `renderMemoCards`, dashboard "Top 3 actions" | Collapsible cards. Missing: tiny chart, "Was this useful?", impact range, "Start here" wording. |
| Old tips | `public/js/business-tips.js` | Business-type detection (used on the Grow page) and menu matrix (price-based). `generateBusinessTips` / `TIP_RULES` is **dead code** (never called). |
| Weather | `public/js/weather.js`, `app.js` | Opt-in (off by default). The owner's **browser** calls Open-Meteo directly (no Tally server), location typed in Settings or from the device, rounded to 2 decimals. Forecast refresh at most once an hour. Attribution link shown. |
| Holidays | `public/js/holidays.js` | 17 US holidays by date math + owner's custom holidays. Keep as is. |
| Local dates | `public/js/local-calendar.js` | Hand-typed Brandeis 2026-27 dates (source link, checked 2026-10-09). Opt-in from Day Notes. Only listed as "possible reasons" on the weekly comparison. |
| Day Notes | `app.js` | Tags incl. promo (with end date and channel), closed, rainy, festival. |
| Square sync | `functions/api/square/sync.js`, `lib/square/orders.js`, `public/js/square-sync.js` | Server fetches orders and passes rows through; sales saved only in IndexedDB. Sync only on button press or right after connecting. Scopes: MERCHANT_PROFILE_READ + ORDERS_READ. |
| Founder dashboard | `public/js/founder.js`, `functions/api/admin/usage.js`, `lib/usage/*` | Admin-only. Anonymous step events in D1 (`usage_events`), DNT/GPC respected, `?notrack=1`, admin browsers auto-excluded. **Already writes one D1 row per tracked step** (up to 500 per browser per day). |

**Known gaps confirmed in code:**
- **Refunds:** Square *sync* brings no refunds at all (the app already says so in the "not enough data" note). For uploaded Square exports, refund rows are flagged, and dashboard totals just add `price × quantity`, so whether a refund subtracts depends on the export's sign. I will verify with a Square-style CSV and fix it so refunds always subtract in totals.
- **Double counting:** sync rows (one per line item, Square order ID) and export rows (one per receipt, transaction ID) can never match, so the same day counts twice. Today the app only warns and asks "add anyway?".
- **Menu chart:** uses price, not profit. A caveat line exists but is easy to miss.
- **"Dine-in" does not exist in Square's Orders API.** An order with no pickup/delivery/shipment fulfillment just has no type. I will label it "In person / no fulfillment (not confirmed dine-in)", never "Dine-in", unless an uploaded file says dine-in.
- **Privacy page is English only.** It needs a Chinese version.
- Pending from earlier work: migration 0006 (richer founder tracking) is built locally but not yet applied remotely or pushed. This plan builds on top of it; deploy order is in section 8.

## 2. Two architecture facts that shape the plan

1. **Cloudflare Pages cannot run Cron Triggers.** Tally is a Pages project. Scheduled fetching needs **one small separate Worker** (`tally-outside-data`) with **one Cron Trigger**. It writes a few rows to the existing D1 database (`counter-db`). The Pages site reads them through a new `/api/outside` endpoint. This is the only new Cloudflare resource.
2. **Weather can't be fetched on a schedule for everyone** without the server storing each owner's location, which I won't do. So weather stays as it is: the owner's own browser calls Open-Meteo directly, at most once an hour, and only when weather is turned on. This uses **zero** Tally/Cloudflare quota, and Open-Meteo's limit is per IP (10,000/day), so each owner has their own allowance. This is a deliberate exception to "never fetch per user" and I'd like your OK (question 1).

## 3. What I will build, in order

Each phase ends with tests passing locally before the next starts.

### Phase A: Foundation (the card format and the known gaps)
1. **`public/js/advice-config.js`** (new): every threshold in one editable file. The existing `INSIGHT_MIN` moves here, plus all new ones (section 6). Also: `outsideData: true` (the one-switch kill flag), stale thresholds, impact-range settings.
2. **Card upgrade** (`app.js` → new `public/js/advice-view.js` to keep `app.js` from growing): every recommendation gets the same 7 parts: (a) headline, (b) what we saw + **tiny inline SVG chart** (no new library, fast on phones), (c) why it matters, (d) one thing to try, (e) one thing to check in 2 weeks, (f) how sure we are (Low/Medium/High + one-line reason), (g) "Was this useful? Yes / No". Detailed numbers collapsed.
3. **"Start here"** box replaces "Top 3 actions": 3 cards, ordered, one plain sentence each.
4. **Impact ranges** only where the math is simple and transparent (add-on pairs, quiet hours), shown as "$X to $Y a month — an illustration, not a prediction", with the assumptions in the collapsed details.
5. **Gaps:** refunds always subtract (verified with a CSV fixture); Square-sync cards say "Refunds aren't included from Square sync"; the double-count dialog gets a real fix option: **"Keep Square for these dates, skip the file's rows for them"** (plus the existing cancel/add anyway); menu chart retitled "by price (not profit)" in both languages.
6. Delete the dead `TIP_RULES` code (business-type detection stays).

### Phase B: Analysis of the owner's own data (all automatic, no typing)
Extends `insights.js` + `insight-text.js` (EN + ZH):
1. **Items bought together:** already exists. Add the "about 1 in 3 croissant orders also has a latte" phrasing, a bundle/add-on idea to *test*, and the tiny chart. Hidden below thresholds.
2. **Channel view:** sales by channel (pickup / delivery / in person-or-unknown / file labels). Optional fee % per channel (see Phase C) for estimated take-home; without it, sales only plus "Add your delivery fee to see what you really keep."
3. **Did my change work?** For each promo or note with a date range: average sales on the note's days vs the **same weekdays** in the N weeks before (and after, if available), skipping holidays, closed days and other notes. Shows the difference, the number of comparison days, and "This is a comparison, not proof. Other things may have changed too." Hidden if fewer than the minimum comparison days.
4. **Price change check:** finds an item (same item + variation) whose usual price moved by at least 5% and stayed there for 14+ days. Compares units sold per selling day before vs after. Same caveats. Skips receipts where prices are estimated from packed Square export receipts.
5. **Concentration:** share of sales from the top 3 and top 20% of items, and how many items barely sell. Wording: "worth a review", never "cut". (Merges the overlap between the current top-seller and slow-seller rules.)
6. **Returning customers:** share of sales from customers seen 2+ times, using the existing scrambled customer codes. Always states "Square links only some orders to a customer, so this is a lower bound" and shows what share of orders had a customer code at all. Hidden if that share is too small.
7. **Optional break-even:** appears only if the owner enters fixed monthly costs and an estimated cost % (Phase C). Shows "sales needed per month" vs their recent average, labeled as an estimate.

### Phase C: Optional inputs and auto-sync (browser-only)
- One-tap optional inputs, shown only on the card they unlock, saved only in IndexedDB, included in "Delete all my data" and backups: fee % per channel, fixed costs + cost %, ZIP code (uploads without a location). Hints say "examples only". No hard-coded commission rates.
- **Location with zero typing:** for Square owners, `/api/square/status` also returns the first location's coordinates (rounded to 2 decimals) or ZIP, from the `ListLocations` call we already make under MERCHANT_PROFILE_READ. Not stored on the server. Fallback to the one optional ZIP question if Square has no coordinates.
- **Auto-sync on open:** if connected and the last sync was over 6 hours ago (configurable), sync quietly in the background when the app opens. Same privacy path as the button.
- Business type, busy hours, channels, items: already auto-detected; no new input.

### Phase D: Outside data system
- **Migration `0007_outside_data.sql`:** `outside_data` (one row per source: value JSON, source name, link, license text, as-of date, last success, last attempt, status, failure count, next retry) and `job_runs` (last ~50 runs, then pruned). A handful of rows total. Plus a `settings` row for the instant kill switch.
- **Worker `workers/outside-data/`** (new, separate deploy): **1 Cron Trigger, every 6 hours.** Each run fetches only sources that are *due* (BLS: once a day; feeds: once a day; after a failure, back off 6h → 12h → 24h). On failure it keeps the last good value. Never touches sales.
- **`functions/api/outside.js`:** returns only fresh values (stale/failed hidden), with `Cache-Control` so a browser asks at most every 12 hours. Returns empty if the kill switch or config flag is off.
- **`public/js/outside-data.js`:** loads it silently. Any failure = cards hide. Owners never see an error.
- **Sources** (each needs your approval, see section 5):
  - (a) **BLS CPI "food away from home"**: national and Boston-area. Shown only inside the price-change or concentration context (when the owner's own data gives a reason), e.g. "Restaurant prices nationally were up 2.3% from Sep 2025 to Sep 2026 (BLS, not seasonally adjusted)." Never "raise your prices."
  - (b) **Open-Meteo forecast**: reuse `weather.js`. A forward tip only when the owner's history supports it: e.g. "Rain is forecast Saturday. Your past rainy Saturdays averaged 18% below your dry Saturdays (6 rainy, 20 dry)." Needs a minimum count of each. Attribution "Weather data by Open-Meteo.com" on the card.
  - (c) **Local events**: see question 3/4.
  - (d) **Holidays**: unchanged.
- **Kill switch:** `outsideData: false` in `advice-config.js` (needs a push) **and** a Founder-dashboard toggle stored in D1 that `/api/outside` and the Worker obey immediately (no deploy). Weather tips also obey the config flag.

### Phase E: Ideas library (hand-curated)
- `public/data/ideas.js`: plain data file you edit. Each entry: id, title + description (EN and ZH), "when to show" rule (picked from a fixed list tied to owner data, e.g. `quietHoursFound`, `pairsFound`, `highDeliveryShare`), business types, source name + link, last reviewed date, `placeholder: true/false`.
- Shown in "General ideas (not from your data)" with source link and date. Hidden if older than 12 months or still a placeholder.
- 6 to 8 starter entries marked "source: TO BE VERIFIED BY BRANDON", hidden from owners.

### Phase F: Founder dashboard panels
1. **Outside data health:** each source, last successful fetch, as-of date, status, recent failures; stale ones flagged.
2. **Free-tier health:** estimated usage vs each limit (section 7), last run of the cron job, warning above 70%. Uses only our own D1 counts (no paid analytics, no extra API token).
3. **Recommendation feedback:** counts of "shown" and "useful yes/no" per recommendation type.
4. **Monthly review:** stale/placeholder Ideas entries, hand-edited dates file due for review, outside-data kill switch.

### Phase G: Docs, privacy, tests
- **Privacy page** in EN + ZH, matching the code exactly. New lines: Square location coordinates are passed to your browser (not stored); weather sends rounded location to Open-Meteo; optional inputs stay in your browser; outside data is fetched by Tally's server and contains nothing about you; feedback taps are counted anonymously. Same for in-app claims (Square card, Data page, weather section).
- `FREE_TIER_NOTES.md`, `MAINTENANCE.md` (with the ~20-minute monthly checklist), `ZH_REVIEW.md` (every Chinese string I wrote, each also tagged `// ZH-REVIEW` in code).
- Tests: browser test pages (as today, via `serve.ps1`) + node tests for the Worker and functions. A synthetic Square-style CSV fixture. A manual test script covering every case you listed.

## 4. Files that change

New: `public/js/advice-config.js`, `public/js/advice-view.js`, `public/js/outside-data.js`, `public/data/ideas.js`, `functions/api/outside.js`, `functions/api/admin/health.js`, `functions/api/admin/outside-switch.js`, `workers/outside-data/index.js` + `wrangler.jsonc`, `migrations/0007_outside_data.sql`, tests + fixture, `FREE_TIER_NOTES.md`, `MAINTENANCE.md`, `ZH_REVIEW.md`, `TESTING_ADVICE.md`.

Changed: `insights.js`, `insight-text.js`, `app.js` (dashboard, Grow, Data, Day Notes hooks, double-count dialog), `weather.js` (forecast tip helper), `local-calendar.js`, `square-sync.js` (auto-sync), `functions/api/square/status.js` (rounded location), `lib/usage/events.js` (2 new event types), `founder.js`, `translations.js`, `privacy.html`, `index.html` (script tags), `style.css`, `business-tips.js` (dead code removed), `README.md` (correct the outdated parts I touch).

## 5. Sources and their terms (for your approval)

| Source | What | Terms I checked (2026-10-27) | Recommendation |
|---|---|---|---|
| BLS Public Data API | `CUUR0000SEFV` = CPI-U, Food away from home, U.S. city average, not seasonally adjusted (verified on api.bls.gov: Sep 2026 = 398.783). `CUURS11ASEFV` = same, Boston-Cambridge-Newton (verified: Sep 2026 = 459.127; **published every other month**, odd months only). | Unregistered: 25 queries/day, 25 series/query. Registered key: 500/day, and **must be renewed yearly**. Terms of Service: note the date retrieved, and state that "BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved." No license stated; US government data is generally public domain. Oct 2025 is missing from the series (no data that month). | Use **without a key**: one query a day for both series is far under 25/day. No key = nothing to renew or leak. Show national to everyone; Boston-area only when the owner's location is in that area. |
| Open-Meteo forecast | Already in use, browser-direct. | Free API is **non-commercial only** (no ads, no subscriptions). 10,000 calls/day, 5,000/hour, 600/minute, per IP. Data under CC BY 4.0, attribution required. | Keep. Attribution on every weather card. MAINTENANCE.md will say commercial use needs a paid plan or another source. |
| Brandeis academic calendar | Official ICS feed linked from the Registrar's "How to subscribe" page (a public Google Calendar feed). | The page says "members of the Brandeis community may subscribe" and the site is "All rights reserved". **No clear reuse terms.** | See question 3. |
| City of Waltham | Official CivicPlus iCalendar feeds exist by category (e.g. Main Calendar = catID 23, Recreation = 40). | No feed-specific terms on the page. Most categories are board meetings, not events that affect a café. | See question 4. |
| Square Locations | Coordinates/ZIP of the owner's own location. | Already covered by MERCHANT_PROFILE_READ. | Use, rounded, never stored on the server. |

## 6. Thresholds I plan to start with (all in `advice-config.js`)

Existing ones stay (e.g. 14 selling days before any advice, 200 receipts for pairs, 20 receipts with both items, lift ≥ 1.5). New:

| Setting | Start value | Why |
|---|---|---|
| Promo/note comparison: min comparison days | 4 same-weekday days | Fewer is too noisy to show |
| Promo/note comparison: weeks to look back | 6 | Close enough in time to be similar |
| Price change: min change / min days each side | 5% / 14 days | Ignores one-off price typos and discounts |
| Price change: min units each side | 30 | |
| Concentration: "barely sells" | < 1 unit per week | |
| Returning customers: min share of orders with a customer code | 20% | Below that the number is misleading |
| Weather tip: min rainy and dry same-weekdays | 4 each | |
| Event tip: min past occurrences | 1 past period with 5+ selling days | |
| Confidence | High at 3× minimum, Medium at 1.5× (as today) | |
| Impact range | ±50% around the simple estimate | Shown as a range on purpose |
| Outside data stale after | BLS national 75 days, Boston 110 days (every other month), feeds 14 days since last success, hand-edited file 180 days since last review | BLS publishes about 2 weeks after month end |
| Ideas hidden after | 12 months since last review | |
| Auto-sync on open | if last sync > 6 hours | |

## 7. Cost: $0, and the request budget

Free limits checked 2026-10-27 (details go in FREE_TIER_NOTES.md):
- **Workers/Pages Functions:** 100,000 requests/day shared by Pages Functions and Workers; static files are free and unlimited. 10 ms CPU per request **and per cron run**. 50 outside requests per run. 5 Cron Triggers per account. Over the limit: **error 1027, not billing.**
- **D1:** 5M rows read/day, 100k rows written/day, 5 GB. Over the limit: queries fail until midnight UTC, **not billing.**
- No credit card, no paid plan, no trial.

Per active owner per day (estimate): ~1 `/api/outside` (browser-cached 12h), 1 status, 1 account, 1 to 3 sync pages, ~10 to 40 existing usage steps, ~5 new feedback steps → **about 20 to 50 Function requests and 15 to 45 D1 row writes.** That supports roughly **2,000 active owners a day** before the 100k request limit, and about 2,000 to 2,500 before the D1 write limit. The usage counting (already live) is the biggest consumer; if it ever gets close, the fix is to send fewer click steps, not to pay.

Cron Worker: 4 runs/day, at most 3 outside requests per run (limit 50), about 5 D1 writes per run, CPU well under 10 ms except the ICS parse, which I'll keep small and measure. Uses **1 of your 5** Cron Triggers.

## 8. What could go wrong

- **ICS parsing vs the 10 ms CPU limit** on the cron run. Mitigation: parse only the next 12 months, simple line scanning, measure locally; if it's too slow, the feed only checks the hand-edited file instead.
- **Square location may have no coordinates** (mobile or virtual locations). Fallback: ZIP from the address, then the one optional ZIP question.
- **Price-change false alarms** from discounts, sizes or packed export receipts. Mitigation: same item + variation, sustained change, estimated prices skipped, Low confidence by default.
- **Promo comparisons are confounded** (season, weather, school calendar). Mitigation: same weekdays, nearby weeks, skip holidays/notes, always the "not proof" caveat.
- **Open-Meteo is non-commercial only.** If Tally ever shows ads or charges, weather must change.
- **BLS could block or change.** Cards hide; Founder dashboard flags it.
- **D1 write budget** grows with the usage counting already live.
- **Deploy order matters:** remote migration 0006 → push current work → remote migration 0007 → deploy the Worker → push this work. You run every cloud step yourself, each with its own approval.
- **Chinese wording** needs your review; I'll keep sentences short and mark each one.
- **`app.js` is already 150 KB.** New screen code goes in new files.

## 9. What I will NOT build

- Server-side background sync, email digests, or anything that stores sales on the server.
- Any AI/LLM call, or sending sales to any outside service.
- Scraping of any site (Yelp, Google, Instagram, TikTok, Facebook, Reddit or others), competitor lookups, auto-summarized trend reports.
- Price recommendations ("raise your prices"), tax, legal, or promised results.
- A BLS API key (not needed at 1 query/day), a Cloudflare analytics API token, or any paid service.
- Profit-based menu engineering (needs per-item costs the owner would have to type).
- A Waltham event feed for owners, unless you choose it in question 4.

**Privacy-safe alternative to emailed digests:** a "Remind me weekly" button that downloads a small calendar file (.ics) made in the browser. The owner's own calendar reminds them to open Tally; Tally stores nothing and sends nothing.

## 10. Questions

See the chat message.
