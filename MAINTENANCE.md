# Maintenance

How Tally keeps running at $0 a month, what each outside piece is for, how to turn things off, and the monthly checklist.
Limits and terms are in FREE_TIER_NOTES.md.

## Monthly checklist (about 20 minutes)

Open the live site, sign in with your admin Square account, go to **Founder** (`#/founder`), choose **Live data**, and scroll to **Advice and outside data**.

1. **Outside data health (3 min).** BLS should say *Fresh*. If it says STALE or FAILED for more than a few days, check the Notes column (e.g. `http_503` = BLS was down; `bls_refused` = daily limit). If **Scheduled job** says no run in 8 hours, open the Cloudflare dashboard → Workers & Pages → `tally-outside-data` → Settings → Trigger Events → View events.
2. **Free-tier health (3 min).** Everything under 70%? If anything is over, read "If a limit gets close" below. For exact numbers: Cloudflare dashboard → Workers & Pages → Overview (requests), and D1 → counter-db → Metrics (rows read/written, size). Viewing is free.
3. **Ideas library (8 min).** The **Monthly review** card lists placeholders and entries older than 12 months. For each one you want to keep: open the source, check it still says what the idea says, update `lastReviewed` in `public/data/ideas.js`. Replace a placeholder only with a real public source you have read; write the idea in your own words; set `placeholder: false`.
4. **Brandeis dates (3 min, mostly once a term).** If the Monthly review card says "Needs a check", compare `public/js/local-calendar.js` with the Registrar's calendar. When next year's calendar is published, add it as a new year block and update `reviewedAt`.
5. **Advice feedback (3 min).** Look at "shown" vs "useful: yes/no". A card with many "No" answers is a candidate to reword or retire (thresholds are in `public/js/advice-config.js`).

Once a year (October): re-check FREE_TIER_NOTES.md against the providers' pages, and update the date at the top.

## Every outside dependency

| Dependency | Why it's there | Free limits | If it stops being free or disappears | How to turn it off |
|---|---|---|---|---|
| **Cloudflare Pages** (site + Functions) | Hosts Tally and its small server code | see FREE_TIER_NOTES.md | The whole app is down; move the static site and Functions elsewhere. No Tally data is lost (sales live in owners' browsers). | n/a |
| **Cloudflare D1** (`counter-db`) | Square connections, accounts, saved summaries, usage counts, outside-data cache | 5M reads / 100k writes per day, 500 MB per DB | Sign-in, saving and counts stop; uploads and all advice keep working | Remove `USAGE_EVENTS` from wrangler.jsonc to stop usage counting |
| **Cloudflare Worker `tally-outside-data`** | Refreshes the BLS price index on a schedule (Pages can't run scheduled jobs) | 1 of 5 Cron Triggers; 10 ms CPU per run | The BLS card goes stale and hides itself; nothing else changes | Founder page switch (instant), or `OUTSIDE_DATA: "off"` in `workers/outside-data/wrangler.jsonc` and redeploy, or delete the Worker's trigger in the dashboard |
| **BLS Public Data API** | National and Boston-area "food away from home" price index, for context on price cards | 25 queries/day without a key (Tally uses 1) | Card hides when the value goes stale (75 days after the month for the U.S., 110 for Boston) | Same switch as above |
| **Open-Meteo** | Weather for owners who turn it on; forward-looking rain tips | Free **non-commercial** only, 10,000 calls/day per IP, CC BY 4.0 attribution | Weather tips and charts disappear for that owner; nothing else changes | `outsideData: false` in `public/js/advice-config.js` (push needed) |
| **Square** | Owner sign-in and order sync | Free developer platform | Connect Square stops; file upload still works | Remove the Square secrets |
| **Google Forms** | Feedback link | Free | Feedback link breaks | Empty `feedbackFormUrl` in `public/js/config.js` |
| **cdnjs / jsDelivr / Google Fonts** | Chart, CSV and Excel libraries; the font | Free public CDNs | Charts or file reading break: copy the files into `public/js/vendor/` | n/a |
| **GitHub** | Code; Cloudflare builds from it | Free | Deploy by uploading with wrangler instead | n/a |

### Open-Meteo is free only for non-commercial use

Tally qualifies today: it's a free student project with no ads and no subscriptions. **If Tally ever charges money, shows ads or becomes part of a business, the free Open-Meteo API is no longer allowed.** Then either buy an Open-Meteo plan (not allowed under the $0 rule) or switch weather off (`outsideData: false`) or to a different free source whose terms allow it. Keep the attribution "Weather data by Open-Meteo.com" visible as long as it's used (it is on every weather card and the My Data page).

### Keys and registrations that can expire

- **BLS API key: not used.** If you ever add one (`npx.cmd wrangler secret put BLS_API_KEY` in `workers/outside-data/`), BLS requires renewing the registration **at least once a year**. Put a yearly reminder in your calendar. If it lapses, remove the secret: the job works without it.
- **Square app credentials** don't expire, but sellers' access tokens are refreshed automatically by Tally every 30 days when they sync.
- Nothing else in Tally has a trial period or a renewal.

## The "outside data off" switch

- **Instant (no deploy):** Founder page → Outside data health → **Turn outside data off**. The scheduled job stops fetching and `/api/outside` returns nothing; BLS cards disappear for owners within about an hour (browser and edge caches).
- **Everything, including weather tips:** set `outsideData: false` in `public/js/advice-config.js` and push. All outside-data cards disappear; uploads, charts and advice from owners' own data keep working.

## If a limit gets close

Nothing is ever billed on the Free plan; at a limit Cloudflare just refuses requests until midnight UTC. To stay under:

1. **Requests or D1 writes high:** usage counting is the main cause. Reduce it: stop counting clicks (remove the `document.addEventListener("click", ...)` block in `public/js/usage.js`), or turn counting off by removing `USAGE_EVENTS` from wrangler.jsonc.
2. **D1 storage growing:** old usage steps are never deleted. When the Free-tier panel shows the database above ~300 MB, delete steps older than 13 months (ask first; this removes old Founder history). Locally first:
   `npx.cmd wrangler d1 execute counter-db --local --command "DELETE FROM usage_events WHERE at < unixepoch() - 400*86400"` then the same with `--remote`.
3. **Outside requests:** can't run away: the job makes at most 1 BLS request a day and backs off after failures (6 h, 12 h, then daily).

## Deploying the outside-data pieces (each step needs its own approval)

Order matters:

1. Remote migration 0006 (pending from the Founder work), then 0007:
   `npm.cmd run db:migrate:remote`
2. Push the code (Cloudflare Pages builds it). `/api/outside` returns an empty answer until the Worker has run.
3. Deploy the Worker (from the project folder):
   `npx.cmd wrangler deploy --config workers/outside-data/wrangler.jsonc`
   It has no public web address (`workers_dev: false`). First run: within 6 hours (minute 17 of hours 0, 6, 12, 18 UTC).
4. Next day: Founder page → Outside data health should say Fresh.

## Thresholds

Every "how much data is enough" number is in `public/js/advice-config.js`, with a comment on each. Server-side staleness for BLS is in `lib/outside/config.js` (keep both in step).
