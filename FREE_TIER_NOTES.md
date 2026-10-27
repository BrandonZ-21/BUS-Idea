# Free-tier notes

Every outside service Tally uses, its free limit, when it was checked, and what happens at the limit.
**Rule: Tally must cost $0. No credit card, no paid plan, no pay-as-you-go. Treat any cost as a bug.**

Checked by Claude on **2026-10-27** from the providers' own pages. Re-check once a year (see MAINTENANCE.md).

## Cloudflare (hosting, server code, database, scheduled job)

| Service | Free limit | What happens at the limit | Source |
|---|---|---|---|
| Workers + Pages Functions requests | **100,000 per day**, shared by the Pages site's Functions and the outside-data Worker. Resets at midnight UTC. | **Error 1027** for further requests that day. **Not billed.** | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) |
| Static files (the app itself: HTML, JS, CSS) | **Unlimited, free** | n/a | [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) |
| CPU time | **10 ms per request and per Cron Trigger run** | That one request or run fails (error). Not billed. | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Outside requests (subrequests) | **50 per invocation** | Further fetches in that run fail. | same |
| Cron Triggers | **5 per account** | Can't add more. | same |
| D1 rows read | **5,000,000 per day** | Queries fail until midnight UTC. **Not billed** (hard stop). | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| D1 rows written | **100,000 per day** | Same: hard stop until midnight UTC. | same |
| D1 storage | **5 GB per account, 500 MB per database**, 10 databases | Writes fail until data is deleted. | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Pages builds | 500 builds per month (from Cloudflare's Pages limits; not re-checked today) | Builds stop until next month; the live site keeps working. | [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) |

**Not confirmed:** the Cron Triggers page itself doesn't say "free plan"; the limits page lists "5 per account" for Free, which I relied on. Whether Cloudflare would ever bill a Free account automatically: their pages describe hard stops on Free, and billing only on Workers Paid, which Tally does not use.

## Outside data

| Service | Free terms | At the limit | Source |
|---|---|---|---|
| **U.S. Bureau of Labor Statistics** Public Data API | No key: **25 queries/day**, 25 series/query, 10 years. With a free key: 500/day (key must be **renewed yearly**). 50 requests per 10 s. Terms: note the retrieval date; say "BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov"; no BLS logo. | "429 Too Many Requests" or `REQUEST_NOT_PROCESSED`; BLS may block abusers. Tally then keeps the last good value and retries later. | [API FAQ](https://www.bls.gov/developers/api_faqs.htm), [Terms](https://www.bls.gov/developers/termsOfService.htm) |
| **Open-Meteo** forecast, history and location search | Free **for non-commercial use only** (no ads, no subscriptions). 10,000 calls/day, 5,000/hour, 600/minute, **per IP address**. Data under **CC BY 4.0**: attribution required. | Calls refused for that IP; Open-Meteo may block misuse without notice. In Tally, only that owner's weather tips disappear. | [Terms](https://open-meteo.com/en/terms) |

**Tally does NOT use a BLS key.** One query a day is far below 25, so there is nothing to register, renew or leak.

## Code libraries and assets (all free, open licenses)

| What | License | Loaded from |
|---|---|---|
| Chart.js 4.4.4 | MIT | cdn.jsdelivr.net |
| PapaParse 5.4.1 | MIT | cdnjs.cloudflare.com |
| SheetJS (xlsx) 0.18.5 | Apache 2.0 | cdnjs.cloudflare.com |
| qrcode-generator | MIT | in the repo (public/js/vendor) |
| DM Sans font | SIL Open Font License | Google Fonts |

No paid fonts, maps, analytics, error tracking or design tools.

## Tally's request budget (designed against the limits above)

Per active owner per day (estimate):

| | Count | Why |
|---|---|---|
| Function requests | about 35 to 40 | ~30 anonymous usage steps (visit, pages, clicks, "still here", advice shown once per card type per day, "useful?" taps), plus status, account, `/api/outside` (cached 12 h in the browser, 1 h at the edge), and 1 to 3 sync pages |
| D1 rows written | about 30 | one per usage step |
| D1 rows read | about 500 | each step checks that browser's count for the day |
| D1 storage | about 6 KB | ~30 rows × ~200 bytes, **kept forever unless cleaned up** |
| Outside requests | 0 from Tally's server | weather is fetched by the owner's own browser, at most once an hour |

Scheduled job (the outside-data Worker): 4 runs a day; at most **1** outside request per run (limit 50), usually 0; about 2 to 3 rows written per run; CPU is mostly waiting on the network, which doesn't count toward the 10 ms. Uses **1 of 5** Cron Triggers.

**How many owners fit:** about **2,500 active owners a day** before the 100,000 requests/day limit, about 3,300 before the D1 write limit, about 10,000 before the D1 read limit. The usage counting (already live) is the biggest consumer; if a limit gets close, send fewer click steps, never pay.

**Long-term risk:** D1 storage. usage_events rows are never deleted. At 100 owners a day that's ~0.6 MB a day, so the 500 MB database limit is about 2 years away. See MAINTENANCE.md for the cleanup step.
