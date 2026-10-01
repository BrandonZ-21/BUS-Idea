# Counter

A single-page web app for small restaurant/cafe/bakery/bar owners. Upload a sales export (CSV, Excel, or tab-delimited) and instantly see charts and plain-English tips about busy hours, best sellers, and slow days. (Renamed from "Cafe Insights" once the app grew past cafes specifically — see the Grow page below.)

**Privacy:** Everything runs in your browser. Your file is read on your device, saved only in your browser's local IndexedDB storage, and never uploaded anywhere. There is no backend, no accounts, and no analytics.

**Weather (optional, off by default):** if you turn on "Use weather data" in Settings, the app sends an approximate location (latitude/longitude rounded to two decimal places) and date ranges to [Open-Meteo](https://open-meteo.com) — a free weather service that needs no API key or account. Your sales figures, item names, and business name are never sent anywhere. Open-Meteo is free for **non-commercial use**; if this app is ever used commercially (e.g. charging restaurant owners for it), check [Open-Meteo's commercial terms](https://open-meteo.com/en/pricing) first.

**Returning-customer tracking (optional, only if your file has one):** if your sales file includes a phone number, email, loyalty ID, or customer name column, the app can show whether customers come back. The instant the file is read, each value is scrambled with SHA-256 (salted with a random code generated once on your device) before anything else happens — the actual phone number/email/name is never stored, displayed, exported, or logged anywhere, only the scrambled code. This never involves a network request, and no individual customer is ever identified or listed — only aggregate counts (e.g. "6 new, 2 returning customers this month"). See the **Customers** page for the exact detected column name and a button to reset the scrambling code (which starts your repeat-customer history over).

## Running it locally

No build step, no server, no installs required.

1. Open the `BUS-Idea\public` folder in File Explorer.
2. Double-click `index.html`. It opens in your default browser and works immediately.

**Square integration (in progress, Sandbox only):** the in-progress Square connection needs the backend in `functions/`, so it only runs through `npm run dev` (Cloudflare's local server at http://localhost:8788). One-time setup steps are in [SETUP.md](SETUP.md). The upload-a-file app above still needs no installs.

That's it. (Some browsers restrict certain features when opening files directly with `file://` — if anything looks off, the simplest fix is to serve the folder locally instead, e.g. with `npx serve` or the free Cloudflare/GitHub Pages hosting below.)

## What's in the project

Everything Cloudflare publishes is in `public/`. Backend, database and test files sit outside it so they are never served.

```
public/                The website (Cloudflare Pages "build output directory")
  index.html, css/, js/, sample CSVs -- listed below
functions/api/square/  Pages Functions for the Square connection (placeholders: connect, callback,
                       sync, disconnect, status) -- served at /api/square/...
migrations/            D1 database tables (connections, sessions)
wrangler.jsonc         Cloudflare config: project name, output dir, D1 binding (no secrets)
.dev.vars.example      Names of the secret settings; copy to .dev.vars (git-ignored) and fill in
SETUP.md               Step-by-step things you must do yourself for the Square integration
package.json           Dev tools only (Wrangler) -- `npm run dev`, `npm run db:migrate:local`

Inside public/:
index.html            The app shell (header, nav, containers)
css/style.css          All styling
js/translations.js     Every piece of English/Chinese text used by the app
js/db.js               IndexedDB wrapper (local storage only, never network)
js/parser.js            Column auto-detection + row cleanup (CSV/Excel/tab-delimited), sensitive-column
                        stripping and name masking, Square export detection
js/square-items.js      Splits Square receipts ("2 x Gatorade (Desk) (Cool Blue), ...") into item rows and
                        works out each item's share of the receipt (adds back up to the cent)
js/stats.js             Calculations: totals, by-hour, by-day, trends, gaps, one-off payment detection
js/charts.js            Chart.js chart helpers + the heatmap grid
js/router.js            Simple #/hash router for the detail pages
js/holidays.js          US holiday date calculator (no external service)
js/weather.js           Open-Meteo lookup/fetch, unit conversion, weather categories (opt-in, off by default)
js/ask.js               Rule-based "Ask a question" answer engine (no AI, no network)
js/daylight.js          Sunrise/sunset calculator (pure math, no external service, no privacy concern)
js/customers.js         Returning-customer math -- operates only on hashed customer IDs, never raw data
js/customer-summary.js  Parses an already-aggregated monthly new/returning customer report (a different
                        data shape than a per-order file -- no hashing involved, since it's already just counts)
js/business-tips.js     Business-type detection, the menu engineering matrix, and the curated tip-rule bank
js/app.js               Main app logic gluing everything together

Outside public/ (never deployed):
scripts/serve.ps1           Tiny local server on :8080 -- serves public/ plus /tests/
tests/holidays-test.html    Open in a browser to run the holiday date-rule checks
tests/daylight-test.html    Open in a browser to check sunrise/sunset math against published reference times
tests/customers-test.html   Open in a browser to check the repeat-customer math + hashing on a hand-worked example
tests/business-tips-test.html   Open in a browser to check business-type detection, the menu-engineering
                                 quadrant split, and every tip rule (30 checks)
tests/customer-summary-test.html   Open in a browser to check monthly-report parsing, column auto-detection,
                                    and de-duplication of a re-stated month (30 checks)
tests/square-test.html      Square export checks: money parsing, item splitting/pricing, masking (always run),
                            plus an expected-vs-actual table for a real export placed at
                            tests/private/sample-transactions.csv (git-ignored -- real exports contain names).
                            Needs a local server (scripts/serve.ps1), then open /tests/square-test.html.
sample-data.csv         ~4 weeks of realistic sample sales (Aug 3 - Aug 30, 2026)
sample-data-2.csv       A second sample export with different column names, overlapping
                        the last 5 days of sample-data.csv plus 9 new days — use this to
                        test that merging/duplicate-skipping works.
mock-data-3-years.csv   3 full years of generated sales data, built to exercise every
                        feature at once — see "Trying out every feature at once" below.
```

## Trying out every feature at once

`mock-data-3-years.csv` is a generated (not real) dataset covering **2023-09-26 through 2026-09-25** (~20,500 rows), built specifically so a new user can see every feature with real-looking numbers instead of empty states, without waiting months for real data to accumulate. It's not part of the app's code — it's just a CSV to upload like any other export.

What's baked into it, and how to see each feature:
- **A `Customer Phone` column** on about a third of rows (the rest are blank, like a real register where not everyone gives a phone number). Upload the file, and when asked to match columns, confirm "Customer Phone" is picked up as the customer identifier. Includes ~15 "regulars" (visit every 5-9 days across all 3 years), ~40 "occasional" customers (active for a stretch, then quiet), and ~12 who stopped visiting 70-200 days before the end date specifically to show up in the Customers page's "may be worth a win-back promo" count. One customer's phone number is formatted differently on different visits (`(555) 123-4567` vs `555-123-4567`) to demonstrate that hashing normalizes formatting. Visit `#/customers` after uploading.
- **A slow, steady growth trend** (~18% more daily transactions by the end than the start) plus normal day-of-week variation (busiest Saturdays, slowest Mondays) — visible on the dashboard trend chart and `#/trend`.
- **Noticeably lower daily transaction volume in November–January (and a smaller dip in February)**, to line up with the sunset/daylight insight and the trend chart's sunset toggle — turn on "Show sunset info" on `#/trend` and set a location (any city) on the My Data page to see it.
- **Four built-in sales bumps** meant to line up with promo entries you add yourself on the Day Notes page (`#/notes`), since promos aren't part of a sales file — add a "Marketing/Promo" note for each date range below and you'll see the bump on the trend chart right where the note marker is:
  - March 4–10, 2024 — Instagram post
  - November 18–24, 2024 — Email discount code
  - June 9–15, 2025 — Flyer + discount
  - November 17–23, 2025 — Black Friday week email promo
- **Real weather/holiday correlations**, once you turn on weather and set a location — because the dates are real historical dates, Open-Meteo returns real historical weather for them, so the weather-comparison and holiday insights use genuine data rather than anything fabricated.
- Enough total volume and date range to clear every "thin data" threshold in the app (week-over-week, month-over-month, the 5-distinct-customer minimum for the Customers page, the 4-distinct-item minimum for the Grow page's menu matrix, etc.), so nothing shows a "not enough data yet" message.
- A cafe-shaped menu, so `#/grow` detects "cafe / coffee shop" and shows the matching tips and menu-engineering matrix automatically — no extra setup needed there.

## Deploying for free on Cloudflare Pages (recommended)

You'll first need the project in a GitHub repository (see the GitHub Desktop steps below), then:

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) and sign in (create a free account if you don't have one).
2. Click **Create a project** → **Connect to Git**.
3. Choose your GitHub account, then pick the repository you just created (e.g. `BUS-Idea`).
4. On the build settings screen:
   - **Framework preset:** None
   - **Build command:** (leave blank)
   - **Build output directory:** `public` (only that folder is published; `functions/` is picked up automatically as the backend)
5. Click **Save and Deploy**. Cloudflare will give you a free `*.pages.dev` URL in about a minute.
6. Any time you push new commits to GitHub, Cloudflare automatically redeploys.

## Deploying for free on GitHub Pages (alternative)

1. Push the project to a GitHub repository (see below).
2. On GitHub, open the repository → **Settings** → **Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Set **Branch** to `main` and folder to `/ (root)`, then click **Save**.
5. GitHub gives you a URL like `https://<your-username>.github.io/<repo-name>/` within a minute or two.

## Creating the GitHub repository with GitHub Desktop

Since this machine doesn't have the git command-line tool installed, use the GitHub Desktop app (already installed):

1. Open **GitHub Desktop**.
2. **File → Add local repository...** → browse to and select this `BUS-Idea` folder → click **Add repository**. GitHub Desktop will offer to initialize it as a git repository if it isn't one yet — say yes.
3. You'll see all the project files listed as changes. Write a summary like "Initial commit: Counter app" in the box at the bottom left, then click **Commit to main**.
4. Click **Publish repository** in the top bar. Choose a name (e.g. `cafe-insights` or `BUS-Idea`), decide public/private, and click **Publish Repository**.
5. Your code is now on GitHub — use the Cloudflare Pages or GitHub Pages steps above to deploy it.

Whenever you make changes later: GitHub Desktop will show them under "Changes" — write a short commit message, click **Commit to main**, then **Push origin** to publish the update.

## What works

- Upload via drag-and-drop, file picker, or two sample datasets.
- Automatic column detection for Date, Time, Item, Quantity, Price, Order Type, with editable dropdowns and support for combined date+time columns, `$1,234.50`-style prices, and missing quantities.
- A dashboard with total sales, orders, average order, busiest hour, sales by hour/day, weekly trend (once there's 3+ weeks of data), top sellers, order-type split, and a busy-times heatmap.
- 3-5 plain-English insights computed with simple rules (best/slowest day, peak hours, quiet stretch, top item, delivery share, week-over-week, rarely-ordered items).
- Full English/Chinese (Simplified) toggle covering every piece of text.
- Data is saved in IndexedDB and persists across refreshes. New uploads are merged into existing data, with duplicate rows automatically skipped (based on date + time + item + quantity + price, plus order ID when available) and a summary of how many rows were added vs. skipped.
- Remembered column mappings, so re-uploading the same register's export format doesn't require re-matching columns.
- A "My Data" page showing total rows saved, date range, last upload date, gaps in your data, and backup export/import plus a "delete all" option.
- A date range selector (last 4 weeks / last 8 weeks / this year / all time) that filters the whole dashboard.
- The dashboard gets more detailed as data grows: a note on thin data (<2 weeks), week-over-week comparisons at 2+ weeks, and month-over-month/stronger trend insights at 8+ weeks.
- Every chart is clickable (and keyboard-reachable via a real "See details" link) and opens a full detail page at its own bookmarkable URL (`#/hours`, `#/days`, `#/items`, `#/trend`, `#/order-types`, `#/heatmap`), each with a plain-English explanation, specific findings from the owner's own data, practical suggestions, extra detail (weekday/weekend toggle, search/sort, hover values), and a working browser Back button.
- Accepts Excel (`.xlsx`/`.xls`) and tab-delimited files in addition to CSV, parsed entirely in the browser via SheetJS.

**Phase 1 additions (holidays & day notes):**
- 17 US holidays computed with plain date math (no external service), covering every year in your data plus one year ahead. See `tests/holidays-test.html` for the date-rule checks.
- A "Day Notes" page (`#/notes`) where you can tag any date (rainy, street festival, short-staffed, closed, or a custom tag) with a note. Days tagged "closed" are excluded from every average in the app.
- The weekly trend chart marks weeks that contain a holiday or a day note (amber dot, with details in the tooltip and in the trend detail page's table).
- A "Settings" section on the My Data page: "Ignore holidays when calculating a normal day" (on by default) — this will be used by the upcoming Heads-up alerts, forecast, and before/after comparisons so holidays don't get mistaken for unusual days.
- The saved-data format moved from version 1 to version 2 to add a `dayNotes` store. Existing sales/settings data is untouched by this upgrade, and both old and new backup files import correctly.

**Weather initiative, Phase 1 (Settings and weather):**
- An "Outside data" section on the My Data page: an off-by-default toggle, a city/ZIP location search (via Open-Meteo's free geocoding, with a confirm step showing the exact place found so you can pick the right one if there's more than one match), and a °F/inches vs °C/millimeters unit choice.
- Historical daily weather (high/low temperature, rain, snowfall) for your sales data's date range, plus the last ~10 days and a 7-day forecast, fetched in batched date-range calls (never one call per day) and cached in a new `weather` IndexedDB store so only missing dates are ever re-fetched.
- The forecast/recent portion refreshes at most once per hour; older historical days are fetched once and never re-fetched.
- Every weather call has an 8-second timeout and a single retry; if the service is unreachable or you're offline, the rest of the app works exactly as before with a friendly note instead of an error.
- A small "Today: 58°F, Light rain" line on the dashboard (only shown when weather is turned on), with weather condition categories (Dry/Light rain/Rain/Snow and Cold/Cool/Mild/Warm/Hot) defined by one named constant in `js/weather.js` (`WEATHER_THRESHOLDS`) so the thresholds are easy to find and change.
- The saved-data format moved to version 3 to add the `weather` store; export/import backup and "Delete all my data" all cover it, and old backup files (without weather) still import cleanly.
- Two dashboard charts: "Average Sales by Weather Condition" and "Average Sales by Temperature," shown once weather is on and there's data to plot.
- The weekly trend chart's markers now include notable rain/snow days alongside holidays and day notes.
- A "Use my current location" one-click option (uses the browser's own geolocation, no typing required) alongside the city/ZIP search.
- A quiet nudge on the dashboard ("Turn on weather in My Data →") when weather is off, so the feature stays discoverable.

**Expandable tip cards (dashboard insights, no server needed):**
- Every tip on the dashboard is now a clickable/tappable card. Collapsed, it looks the same as before (headline + one-line action). Expanded, it shows: the exact numbers behind it, a plain-English "why this matters" sentence, 2-3 concrete next steps that reference your actual numbers, and a small chart illustrating the pattern.
- All 9 tip types (best/slowest day, holiday impact, weather comparison, peak hours, week-over-week, top seller, quiet stretch, delivery share, rarely-ordered items) have their own detail content — still entirely rule-based JavaScript templates, no AI, no server.
- Fully bilingual, including the sparkline charts and every stat line.

**Ask a Question (`#/ask`, no AI, no server, works offline):**
- A chat-style panel where you can type a plain-English question about your own sales ("what was my best day?", "why was Tuesday slow?", "how's delivery doing?") and get an answer computed from your real numbers.
- This is **rule-based, not AI** — it recognizes about a dozen common question patterns (best/worst day, a specific weekday, busiest/quietest hour, top or rarely-ordered items, sales trend, weather, holidays, order type, total sales) and answers using the same calculations the rest of the app already does. A question it doesn't recognize still gets a useful short overview instead of "I don't understand."
- Nothing is sent anywhere — it works with the network completely off, since it's just JavaScript reading your own already-loaded data.
- 4 suggested starter questions, a short session history (not saved to disk), and a 300-character question limit.
- **Why not the real Claude-powered version described in the original request:** that would require a paid Anthropic API key, a Cloudflare Worker backend, and server-side rate limiting to prevent unexpected bills, which is a meaningful step up in cost and complexity from every other part of this app (which is free and has no backend). We agreed to ship this free, local version now, and revisit a Claude-powered version later as an explicit, off-by-default opt-in — same pattern as the weather feature — once you're ready to manage billing for it.
- **Later improvements:** it now also recognizes two more question shapes — naming one of your actual menu items ("how's the latte doing?") and comparing two weekdays in one question ("compare Saturday and Tuesday"). Question text is also normalized (punctuation stripped, case-insensitive) so small phrasing differences match the same way.

**Weather actually connected to your sales data, custom holidays, and chart legends (latest round):**
- **Weather now backfills automatically on every upload, not just once.** Previously, if you turned weather on and later uploaded more sales data, the new dates wouldn't get weather attached until something else happened to trigger a refresh (like reloading the page). Uploading a file or importing a backup now automatically fills in weather for any new dates, using a single Chrome test that reproduced the gap before fixing it. The historical fetch is also now scoped to just the missing date range instead of re-requesting the whole span every time.
- **Custom holidays**, for anything not on the standard US calendar — Chinese New Year, Diwali, Eid, a local festival, or any lunar/lunisolar holiday whose date shifts every year. Manage them on the Day Notes page: add one at a time, or import a file with `date` and `name` columns (a downloadable template is provided). They show up everywhere a US holiday already does — the dashboard's holiday line, the trend chart's markers, and the holiday-impact insight. *We didn't try to compute Chinese New Year or similar lunar holidays automatically — getting lunisolar calendar math exactly right without a verified library is a real risk of being subtly wrong every year, so it's safer to let you enter the correct date once a year.*
- The saved-data format moved to version 4 to add the `customHolidays` store; backup/import/delete all cover it, and older backups still import cleanly.
- **Chart legends and axis titles** on every dashboard and detail-page chart: labeled X/Y axes, a small caption explaining what the highlighted (amber) bar means, and a dashed "your overall average" reference line on the Hours and Days charts so you can see at a glance whether a bar is above or below normal. The heatmap now has a "Less busy → Busier" color-scale legend, and the trend chart explains what its amber dots mean.

**Sunset/daylight, marketing notes, and returning-customer tracking:**
- **Sunset & daylight insights** — computed with the standard NOAA sunrise/sunset formula (see `js/daylight.js`), checked against 4 published reference dates for accuracy (within 1-3 minutes). This needs a location on file (the same one used for weather, or set independently — the location field on My Data is no longer tied to turning weather on, since sunset math is pure local calculation with zero privacy concern either way). Adds an "evenings with early sunset run X% higher/lower" insight when there's enough data on both sides, and an optional "Show sunset info" toggle on the trend chart that marks early-sunset weeks with an indigo ring and adds average sunset time to the tooltip and table.
- **Marketing/Promo day notes** — a new tag on the Day Notes page with a date range and a channel (Instagram/social, flyer, email, discount code, other), so a multi-day promotion shows up correctly across its whole run on the trend chart, not just on the day it was logged. *Note: there's no "Did it work?" before/after comparison tracker in this app yet — that was proposed in an earlier round but never built. This promo entry is structured (date range + description + channel) so it's ready to plug into that tracker whenever it exists, but right now it's a note you can see, not something the app compares before/after for you.*
- **Returning-customer tracking (`#/customers`)** — see the privacy section above for the full explanation. Short version: an optional column (phone/email/loyalty ID/customer name) is auto-detected during upload, hashed with SHA-256 on your device before anything else touches it, and used only for aggregate counts: new vs. returning customers by month (stacked chart), repeat rate at 30/60/90 days, average visits and time between visits for repeat customers, and a count (never a list) of customers who haven't been back in 60+ days. Gracefully explains itself if no such column was found, or if there isn't enough data yet (fewer than 5 distinct customers). The math was hand-verified against a worked 3-customer example in `tests/customers-test.html`, and I directly inspected IndexedDB in a test run to confirm no raw phone number ever gets stored.
- The saved-data format moved to version 5, adding the customer-hash scrambling code and detected column name to backups; older backups still import cleanly, defaulting these to off/empty.

**Grow Your Business (`#/grow`) — the "why is this different from other POS analytics" feature:**
- **Business-type detection** — reads your menu item names (no new upload or extra input needed) and classifies you as a cafe/coffee shop, bakery, bar/pub, full-service restaurant, or a general fallback, using keyword matching in `js/business-tips.js`. This shapes which of the tips below apply.
- **Menu Engineering Matrix** — a real framework taught in restaurant/hospitality-management courses: every item is plotted by popularity (units sold) vs. price into four quadrants (Stars, Plowhorses, Puzzles, Dogs), each with plain-English guidance. *Honest caveat: the real version of this framework uses actual profit margin per item, not price — this app has no ingredient-cost data, so price is used as a proxy and the page says so directly.*
- **A curated, data-gated tip bank** — about a dozen tips (loyalty programs, channel diversification, menu concentration risk, demand variability, and more), each only shown when your own numbers actually support it (e.g. the loyalty-program tip only appears if your real repeat rate is low), paired with a short explanation of the underlying business concept (customer lifetime value, seasonal demand planning, price discrimination by time of day, etc.) rather than just a bare suggestion. Several tips reuse the dashboard's own weather/daylight/holiday insights rather than recomputing them.
- **Deliberately not built:** any lookup of real competitor businesses. There's no reliable free data source for "what similar businesses nearby actually do," and guessing would mean stating unverified things about real businesses as fact — which conflicts with the rest of this app's approach of only showing what your own data actually supports. What's here instead is general, well-established small-business knowledge applied to your specific numbers.
- Tested in `tests/business-tips-test.html`: business-type detection against hand-picked menus for each type, the menu-engineering quadrant split against a hand-worked 4-item example (one item deliberately placed in each quadrant), and the tip-rule bank against synthetic data for both the "triggers" and "correctly does NOT trigger" side of each rule (30 checks total).

**Rename, redesign, and more interactive charts (latest round):**
- **Renamed from "Cafe Insights" to "Counter"** — the internal IndexedDB storage key (`cafeInsightsDB`) was deliberately left unchanged, since it's an invisible implementation detail and renaming it would have silently orphaned anyone's already-saved local data.
- **Visual redesign** — moved from the original warm cafe green/amber/serif look to a flatter, neutral, modern palette (blue primary accent, amber/violet secondary accents, all sans-serif), with lighter shadows instead of heavy borders, a translucent sticky header, and pill-shaped nav/buttons. The CSS variable *names* (`--green`, `--amber`) are unchanged on purpose (dozens of call sites reference them) — only their color *values* changed, which is noted directly in the CSS.
- **More chart types and more interactivity:**
  - The Hours and Days detail pages now have a Bar/Line toggle, so you can see the same data as either a bar chart or a smooth trend line.
  - The Order Type Split detail page now has a Doughnut/Bar toggle.
  - Chart cards, table rows, and heatmap cells got real hover states (lift/highlight/outline) so it's clearer what's clickable before you click it.
  - The line chart renderer (`js/charts.js`) gained the same "your overall average" dashed reference line the bar chart already had, so switching Hours/Days to Line view doesn't lose that comparison.
- **More specific chart legends** — the orange bar on the Hours/Days charts used to just say "Highlighted bar," which didn't explain why that particular bar was highlighted. It now says exactly what it means in context: "Your 2 busiest hours (highest total sales)" on the Hours chart, and on the Days chart either "Busiest day (highest total sales)" or "Best day (highest daily average)" depending on which of the two view modes is active.
- **A real landing page** — before any data is uploaded, the app now shows a proper landing page (headline, a "what you get" feature grid, a 3-step "how it works" section, then the upload area) instead of jumping straight to a bare dropzone. "Get started" scrolls down to the upload area; "See it with sample data" loads the sample immediately. Fully bilingual, same no-backend/no-tracking rules as the rest of the app — it's just more explanation before the dropzone, not a separate marketing site.

**Dashboard cross-filtering and concrete temperature labels (latest round):**
- **Click-to-filter dashboard ("Tableau-style" linked filtering)** — click a bar on "Sales by Hour of Day" or "Sales by Day of Week" and the rest of the dashboard (KPI cards, every other chart, the heatmap, and the insights) filters down to that hour/day; click it again (or the × on its chip) to clear just that filter, or "Clear all filters" for both. Both can be active at once (e.g. "Saturdays at 8am"). Each of the two source charts keeps showing all of its own bars rather than collapsing to one, so you can keep clicking to explore, and a violet outline marks whichever bar is currently selected. This is scoped to the dashboard only — it doesn't touch the detail pages' own scope toggles (like Hours' weekday/weekend or Days' total/average).
- *What this isn't:* a full Tableau-style authoring surface (drag-and-drop measures/dimensions, custom pivot tables, exporting a chart as an image). Cross-filtering was picked as the single highest-value piece of that toolkit to build well; a "choose your own measure" selector (Revenue vs. Orders vs. Average Order Value) is a reasonable next piece if more of this is wanted later.
- **Temperature chart labels now show the actual cutoff** — "Warm" on its own didn't mean much without knowing the number behind it, so the Average Sales by Temperature chart's bars now read e.g. "Cold (≤41°F)", "Mild (≤75°F)", "Hot (>86°F)" — computed from the same thresholds in `js/weather.js` and shown in whichever unit (°F/°C) is set in Settings, so the label always matches what's actually being measured instead of a subjective word.

**More flexible file upload, and a second way to track returning customers (latest round):**
- **Fixed a false-positive column guess** — a column named something like "Total Orders" was being auto-guessed as the Price column, because "total" alone was too generic a keyword. It's now only accepted as Price if it doesn't also look like a count (contains "order," "guest," "qty," etc.) unless it also has a stronger money signal ("amount," "revenue," "sales"). Also added "Contact"/"Customer Contact" to the columns auto-detected as a customer identifier, and clarified that it's fine for that single column to mix phone numbers, emails, and blanks row-to-row — whatever's actually there gets scrambled.
- **Much clearer errors when a file doesn't fit** — instead of a generic "check your columns," the column-matching screen now detects up front when a file doesn't look like a per-order export at all (no date/item/price columns found) and says so directly. If you do try to submit a file where the values just don't parse, the error now shows exactly what we saw and why — e.g. quoting the actual bad date value instead of a generic complaint.
- **A second way to track returning customers, for a genuinely different file shape** — some registers can only export an already-aggregated *monthly* report (total new/returning customers per month) rather than a per-order file with a customer identifier column. That's not a formatting quirk the main upload can be made to handle; it's structurally different data (no per-row date, item, or price at all). Rather than force it through the same pipeline, it now has its own home: an "Import a monthly customer report" button on the Customers page (`js/customer-summary.js`), which auto-detects Month/New/Returning-style columns, stores the counts in their own IndexedDB store (no hashing needed or possible — a report like this never contains a raw identifier to begin with), and shows its own "Customer Growth Report" chart and totals, clearly separate from the hashed per-transaction analysis above it.
- The saved-data format moved to version 6 (backup JSON) / IndexedDB version 5 to add this store; older backups still import cleanly, defaulting it to empty.
- Tested against two real sample files: a per-order sales export with a "Customer Contact" column that mixes phone numbers, emails, and blanks (128k rows, auto-detected correctly, hashed and rendered without errors), and a genuinely separate monthly new/returning customer summary (imported cleanly into its own chart, matching the transaction file's own customer count almost exactly as a sanity check). See `tests/customer-summary-test.html` for the unit-level checks (month parsing in several formats, column auto-detection, and de-duplicating a re-stated month).

**Square exports, one-off payments, and an item-level view (latest round):**
- **Square "Transactions" exports are recognized automatically.** Card digits (PAN Suffix), staff names/IDs, and customer ID/name columns are deleted from the parsed file before the column-matching screen or anything else reads it. Names typed into payment descriptions (e.g. a payment link's "Traveler Name: …"), Square "Custom Amount - <note>" notes, emails and phone numbers are masked before saving, and rows saved before this change are masked in place the next time the app loads.
- **"Exclude one-off payments" (on by default)**, next to the date range on the dashboard and Items page, applies to every KPI, chart, insight and detail page. A one-off is a payment-link sale (trip deposits, rentals) or an unusually large ticket: over 10× the median ticket *and* over 3× the 99th-percentile ticket (the second rule stops a group buying 6 day passes from being flagged). A note under the selector says how many were hidden and their total.
- **"This year"** added to the Show: dropdown (the calendar year of your latest sale).
- **Hour and day-of-week charts now show the average per day** (e.g. average sales per Saturday = Saturday total ÷ number of Saturdays in the range, closed days skipped), so a weekday that appears more often in the window isn't over-represented. Totals are in the tooltips; the Days detail page still has a "Total sales" toggle.
- **Items page (`#/items`, now in the nav):** top items by revenue and by units, grouping by item / flavor-variation / channel (e.g. Desk vs Concession Stand), a channel filter, and click-to-expand flavors under each item. Square receipts only have a receipt total, so each item's share is priced from single-item sales of the same item (same day when possible); an "est." badge marks the rare item whose price had to be estimated. The dashboard's Top Sellers, the Grow page and Ask use the same item rows.
- Fixed a column-guess bug: "Discounts" was being auto-picked as the Quantity column (it contains "count"), which would have multiplied revenue for any shop that gives discounts.

## What doesn't (yet)

- There's no way to edit or delete individual rows once uploaded — only "delete all."
- The "orders" count is an approximation when the file has no Order ID column: it groups rows by matching date+time, which works well for most register exports but can undercount if two different orders happen to share the exact same minute.
- Column matching is remembered per exact header signature — if a register changes even one column header later, you'll be asked to re-match once for that new format.
- **Ask a Question** recognizes a set list of common question patterns rather than truly understanding open-ended free text — an oddly-phrased or very unusual question falls back to a short general overview instead of a tailored answer. A real Claude-powered version (discussed above) would handle that much more gracefully, at the cost of needing a paid backend.
- The weekly trend chart's weather/holiday markers only flag rain and snow days (not every dry or light-rain day), to avoid cluttering the chart with a marker on nearly every week.
- Ask's menu-item lookup matches the literal item text in your data — a question typed in Chinese won't match an English menu item name (and vice versa), since there's no translation dictionary involved, only the words you actually sold under.
- The small sparkline charts inside expanded tip cards intentionally stay simple (no axis titles/legend) so they don't overwhelm a small inline chart — the full legend treatment is on the dashboard and detail-page charts.
- Returning-customer matching depends on the same identifier appearing consistently across uploads (the normalization handles formatting differences like "(555) 123-4567" vs "555-123-4567", but a customer who sometimes gives their phone and sometimes their email won't be recognized as the same person).
- There's no dedicated `#/privacy` page yet — the customer-hashing disclosure, detected column name, and salt-reset button live on the Customers page itself instead, since that's the only feature with this kind of privacy nuance right now.
- The Marketing/Promo day-note type stores a date range, description, and channel, but there's no "Did it work?" before/after comparison feature yet to actually measure a promo's impact — see the note above.
- The Menu Engineering Matrix on the Grow page uses price as a stand-in for profit margin (no ingredient-cost data is collected anywhere in the app), so an item that's cheap to make but priced low could land in "Dog" when it's actually a fine earner, and vice versa — the page says this directly rather than presenting it as more precise than it is.
- Business-type detection on the Grow page is keyword matching against your item names, not a real classification model — an unusual or very generic menu may fall back to "general" and get fewer type-specific tips.
- The monthly customer report import (Customers page) auto-detects its Month/New/Returning columns but has no interactive "confirm your columns" step like the main upload does — if your column names are unusual enough that auto-detection fails, the fix today is renaming the columns in the file rather than remapping them in the app.
- Since the monthly report and the hashed per-transaction analysis are two separate data sources (one already-aggregated, one computed from scratch), the app doesn't try to reconcile or cross-check them against each other — if they disagree, that's something to notice yourself, not something the app will flag.

## Three most useful next improvements

1. **A real "Did it work?" tracker** — log a change (a promo, a new hour, a price change) and see a before/after comparison. The Marketing/Promo day-note type added this round was deliberately shaped to plug into this later.
2. **Editable rows / manual corrections** — let an owner fix a clearly wrong row (e.g. a $0 price from a register glitch) instead of re-uploading everything.
3. **Multi-location support** — right now all uploaded data is pooled together; owners with more than one location would want to tag and filter by location.
