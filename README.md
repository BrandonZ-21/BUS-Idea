# Cafe Insights

A single-page web app for small restaurant/cafe owners. Upload a sales export (CSV, Excel, or tab-delimited) and instantly see charts and plain-English tips about busy hours, best sellers, and slow days.

**Privacy:** Everything runs in your browser. Your file is read on your device, saved only in your browser's local IndexedDB storage, and never uploaded anywhere. There is no backend, no accounts, and no analytics.

## Running it locally

No build step, no server, no installs required.

1. Open the `BUS-Idea` folder in File Explorer.
2. Double-click `index.html`. It opens in your default browser and works immediately.

That's it. (Some browsers restrict certain features when opening files directly with `file://` — if anything looks off, the simplest fix is to serve the folder locally instead, e.g. with `npx serve` or the free Cloudflare/GitHub Pages hosting below.)

## What's in the project

```
index.html            The app shell (header, nav, containers)
css/style.css          All styling
js/translations.js     Every piece of English/Chinese text used by the app
js/db.js               IndexedDB wrapper (local storage only, never network)
js/parser.js            Column auto-detection + row cleanup (CSV/Excel/tab-delimited)
js/stats.js             Calculations: totals, by-hour, by-day, trends, gaps
js/charts.js            Chart.js chart helpers + the heatmap grid
js/router.js            Simple #/hash router for the detail pages
js/holidays.js          US holiday date calculator (no external service)
js/app.js               Main app logic gluing everything together
tests/holidays-test.html  Open this in a browser to run the holiday date-rule checks
sample-data.csv         ~4 weeks of realistic sample sales (Aug 3 - Aug 30, 2026)
sample-data-2.csv       A second sample export with different column names, overlapping
                        the last 5 days of sample-data.csv plus 9 new days — use this to
                        test that merging/duplicate-skipping works.
```

## Deploying for free on Cloudflare Pages (recommended)

You'll first need the project in a GitHub repository (see the GitHub Desktop steps below), then:

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) and sign in (create a free account if you don't have one).
2. Click **Create a project** → **Connect to Git**.
3. Choose your GitHub account, then pick the repository you just created (e.g. `BUS-Idea`).
4. On the build settings screen:
   - **Framework preset:** None
   - **Build command:** (leave blank)
   - **Build output directory:** `/` (the repo root, since `index.html` lives there)
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
3. You'll see all the project files listed as changes. Write a summary like "Initial commit: Cafe Insights app" in the box at the bottom left, then click **Commit to main**.
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
- A date range selector (last 4 weeks / last 8 weeks / all time) that filters the whole dashboard.
- The dashboard gets more detailed as data grows: a note on thin data (<2 weeks), week-over-week comparisons at 2+ weeks, and month-over-month/stronger trend insights at 8+ weeks.
- Every chart is clickable (and keyboard-reachable via a real "See details" link) and opens a full detail page at its own bookmarkable URL (`#/hours`, `#/days`, `#/items`, `#/trend`, `#/order-types`, `#/heatmap`), each with a plain-English explanation, specific findings from the owner's own data, practical suggestions, extra detail (weekday/weekend toggle, search/sort, hover values), and a working browser Back button.
- Accepts Excel (`.xlsx`/`.xls`) and tab-delimited files in addition to CSV, parsed entirely in the browser via SheetJS.

**Phase 1 additions (holidays & day notes):**
- 17 US holidays computed with plain date math (no external service), covering every year in your data plus one year ahead. See `tests/holidays-test.html` for the date-rule checks.
- A "Day Notes" page (`#/notes`) where you can tag any date (rainy, street festival, short-staffed, closed, or a custom tag) with a note. Days tagged "closed" are excluded from every average in the app.
- The weekly trend chart marks weeks that contain a holiday or a day note (amber dot, with details in the tooltip and in the trend detail page's table).
- A "Settings" section on the My Data page: "Ignore holidays when calculating a normal day" (on by default) — this will be used by the upcoming Heads-up alerts, forecast, and before/after comparisons so holidays don't get mistaken for unusual days.
- The saved-data format moved from version 1 to version 2 to add a `dayNotes` store. Existing sales/settings data is untouched by this upgrade, and both old and new backup files import correctly.

## What doesn't (yet)

- There's no way to edit or delete individual rows once uploaded — only "delete all."
- The "orders" count is an approximation when the file has no Order ID column: it groups rows by matching date+time, which works well for most register exports but can undercount if two different orders happen to share the exact same minute.
- Column matching is remembered per exact header signature — if a register changes even one column header later, you'll be asked to re-match once for that new format.

## Three most useful next improvements

1. **Editable rows / manual corrections** — let an owner fix a clearly wrong row (e.g. a $0 price from a register glitch) instead of re-uploading everything.
2. **Multi-location support** — right now all uploaded data is pooled together; owners with more than one location would want to tag and filter by location.
3. **Printable/shareable weekly summary** — a one-page PDF or image export of the dashboard an owner could print for a staff meeting or send to a business partner.
