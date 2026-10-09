# Tally readiness checklist

What to fix or label before inviting more owners, ordered by risk to owner trust.
Written 2026-10-06 from reading the code (not the README). Nothing here was changed or deployed.

"Label" means a sentence on screen or in your outreach. "Fix" means a code change, which needs your approval and a deploy.

## Before the first new owner (this week)

| # | Issue | Where | Why an owner would lose trust | Minimum (label) | Proper fix |
|---|---|---|---|---|---|
| 1 | **Square totals are gross sales.** Discounts and refunds are not subtracted. Tax and tips are not included. | `lib/square/orders.js:4-5` and `:70` (uses `gross_sales_money`); nothing reads refunds or returns | The first thing an owner does is compare Tally's total with their Square Dashboard. Tally will read higher than Square's net sales, with no explanation on screen. I found no "gross", "refund" or "discount" wording anywhere in the dashboard text. | One line under the dashboard total: "Gross sales, before discounts and refunds. Tax and tips not included." Say the same thing out loud before they look. | See PRODUCT_IMPROVEMENTS.md #1. Not a quick change: it alters row fingerprints, so it needs a plan for rows already saved. |
| 2 | **Square sync plus a Square file upload double-counts the overlapping dates.** | `public/js/parser.js:285` (fingerprint), `public/js/app.js:651` (merge) | A synced row is one line item with Square's order ID. An uploaded Square export row is one whole receipt with a transaction ID. They never match, so both are kept and sales double. The only way back is "Delete all my data" (there is no per-row or per-source delete). The trap is easy to fall into: sync gives 90 days, so an owner who wants more history uploads a file next. | Tell every owner: "Use Connect Square or a file, not both, for the same dates." Add the same sentence to the upload card when Square data is already saved. | PRODUCT_IMPROVEMENTS.md #2. |
| 3 | **Privacy claims in the app are stronger than what the app does.** | `public/js/translations.js:25-26` ("100% private", "no upload, no analytics"), `public/privacy.html:33` ("No account, no analytics, no ads, no tracking"), versus `wrangler.jsonc:31` (step counting is on in production) | Anonymous step counting runs for upload-only visitors too. The Privacy page describes it honestly lower down, but these two lines contradict it. Privacy is one of your differentiators, so a claim that is not literally true is the worst kind to be caught on. | Do not repeat "100% private", "no analytics" or "no tracking" in any outreach. Use the wording block in OUTREACH_KIT.md. | Reword both lines, in English and Chinese. Suggested: "Your sales are saved only on this device. Tally counts anonymous steps (like 'opened Tally') to find confusing spots; see Privacy." |
| 4 | **The menu chart is wrong for an uploaded Square export.** | `public/js/business-tips.js:52-60` groups by raw `r.item`; `public/js/app.js:2944` and `:2990` pass all rows | For an uploaded Square Transactions file, `r.item` is the whole receipt description (for example "2 x Latte, Muffin"), so the chart ranks receipt combinations, not menu items. The Items page handles this correctly; the menu chart does not use that code. It also ignores the date-range selector, the closed-day filter and the one-off filter. Synced Square data is not affected. | Do not show the Grow page to an owner who uploaded a Square file. Show Items instead. | Feed the chart the split item rows and the filtered rows. Small change. Read from code, not yet reproduced in the browser: upload a Square Transactions export from your own account and open the Grow page to confirm. |
| 5 | **The menu chart uses price, not profit.** | `public/js/business-tips.js:46-51` | A cheap, high-margin item can land in "Dog". | Already labelled in the app (`growMenuEngCaveat`). Keep it out of your pitch: never say "most profitable items". | PRODUCT_IMPROVEMENTS.md #6. |

## Before inviting a Chinese-speaking owner

| # | Issue | Where | Minimum | Proper fix |
|---|---|---|---|---|
| 6 | **The Privacy page is English only**, while the app says "Every page, chart, and tip is fully bilingual." | `public/privacy.html` (`lang="en"`, no toggle); `translations.js:28` | Walk the owner through the Privacy page in person, in Chinese. Do not claim "fully bilingual" in outreach; say "English/Chinese toggle". | Translate the page and have a fluent writer check it, since you said you do not write Chinese well. Soften the "every page" line until then. |
| 7 | **Business-type detection only knows English item names.** | `public/js/business-tips.js:15-20` | A menu written in Chinese falls back to "general" and gets fewer tips. Not a trust problem, but expect it. | Add Chinese keywords later if this segment responds. |

## Know these and say them when asked

| # | Limit | Where |
|---|---|---|
| 8 | First sync is the last 90 days only. Year-over-year and most holiday comparisons need more history than that. | `functions/api/square/sync.js:25` |
| 9 | Only completed orders. All locations are combined, with no location filter. At most 10 locations. | `lib/square/api.js:124`, `sync.js:28` and `:56` |
| 10 | The delivery tip can mislead on synced data: only online or scheduled orders carry an order type, so an in-store cafe sees "delivery is X% of sales" based on very few orders. | `lib/square/orders.js:56-57`, `app.js:1512-1536` |
| 11 | "Ask a Question" matches a fixed list of question patterns. It is not AI. An unusual question gets a general overview. | `public/js/ask.js:1-6` |
| 12 | Returning customers on synced data only counts orders Square linked to a customer. A cafe with mostly anonymous card taps will see low numbers. | `lib/square/orders.js:42-48` |
| 13 | Weather data comes from Open-Meteo, whose free tier is for non-commercial use. Fine for a free student project; revisit before charging anyone. | `public/js/weather.js:5-7` |

## Housekeeping (owners will not see these, but they can bite)

| # | Item | Where |
|---|---|---|
| 14 | `DASHBOARD_WORKPLAN.md` lists migration 0005 as not yet applied to the live database. If the new code is pushed first, step counting and the Live tab fail. I could not check the live state. Confirm before you rely on the Founder dashboard for the say-versus-did comparison. | `DASHBOARD_WORKPLAN.md:42` |
| 15 | The Founder dashboard counts browsers that do not send Do Not Track or Global Privacy Control. An owner on Brave, or Firefox with that setting on, is invisible. Zero on the dashboard does not prove zero use. | `public/js/usage.js:19-21` |
| 16 | The page loads fonts and three libraries from Google Fonts, cdnjs and jsDelivr. Those services see the visitor's IP address. The Privacy page does not mention it. One sentence would cover it. | `public/index.html:8-10`, `:54-56` |
| 17 | The Excel reader is SheetJS 0.18.5, an old release with published security advisories. It only reads the owner's own file in their own browser, so the practical risk is low. Upgrade when convenient. | `public/index.html:55` |
| 18 | The landing page leads with "Upload your sales export" and gives weather a top feature card. Your one outside user valued one-click Square and found weather not useful. The hero and the three "How it works" steps never mention Connect Square. | `translations.js:12-35` |
| 19 | The README still says Square is Sandbox-only and that there is no Privacy page. Only matters if you share the repository. | `README.md` |

## Corrections to the description in your brief

Use these in copy so it matches the Privacy page and the code.

- "The server stores only an encrypted Square key and the business name" is incomplete. It also stores the Square **merchant ID**, **when you last synced**, and **sign-in sessions** (stored scrambled). Optional: saved report summaries and anonymous step counts.
- "Sales stay in the owner's browser" needs care for Square. Synced sales **pass through Tally's server** on the way to the browser and are not stored there. Accurate wording: "saved only in your browser; Tally's server does not store them."
- Do not write "Tally never sees customer names." Square's order details can include a pickup name or card last four. Tally's server discards them and never stores, shows or forwards them. The Privacy page says exactly this.
- The operator (you) could technically open the Cloudflare database. The Privacy page admits this. Do not open it to check on a specific owner.
- Item-name merging does **not** exist yet. The Items page groups by item, by variation, or by sales channel. Do not offer merging as a feature; ask about it as a problem.
- A Brandeis calendar (2026-27 term dates) was built locally on 2026-10-09 as an opt-in toggle on the Day Notes page. It is **not deployed**, so do not mention it until it is live. There is no Waltham events calendar; owners can add custom holidays by hand.
- Fixed locally on 2026-10-09 and not deployed: item 3 (the two privacy lines, English and Chinese) and item 4 (the menu chart now uses split items and leaves out closed days, one-offs and custom amounts; it still covers all dates, not the range selector).
- Also changed locally on 2026-10-09 and not deployed: item 2 now has a warning (the owner is asked before a file and a Square sync cover the same days; the two still can't be reconciled), the landing page leads with Connect Square and the weekly comparison, and the "fully bilingual" line (item 6) now says the Privacy page is English only.
- Also built locally on 2026-10-09 and not deployed: a "Sizes / options across items" grouping and a "Download item-level CSV" button on the Items page.
- Also built locally on 2026-10-09 and not deployed: the weekly comparison card at the top of the dashboard, the gross-sales note for Square data (item 1's label), and the "More" menu.
