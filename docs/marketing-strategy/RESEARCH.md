# Research: repository audit, company snapshot, competitors, social listening

Run date: 2026-11-02. Repository revision: `4bae529d49c585acf423759cf068727e486dff67` (main, read from `.git`; the git CLI isn't installed on this machine). The working tree also contains this new `docs/marketing-strategy/` folder.

Status: **partial research**, scaled to a class project. See "Coverage" for exactly what was and wasn't inspected.

Evidence labels used throughout: *Observed in repository*, *User-confirmed (date)*, *Documented intention*, *Externally observed*, *Inferred*, *Hypothesis*, *Unverified*.

## 1. Current-company snapshot

| Topic | Current evidence | User-confirmed answer and date | Unknown or conflict | Decision affected | Status |
|---|---|---|---|---|---|
| Product in scope | Tally, one web app ([public/](../../public/)) with Pages Functions ([functions/](../../functions/)) | Tally (2026-11-02, implied by the request) | — | Everything | settled |
| Stage | Live at bus-idea.pages.dev; Square Production connect live (`wrangler.jsonc` env.production; [ACCOUNTS_WORKPLAN.md](../../ACCOUNTS_WORKPLAN.md)) | Only the founder's manager has tried it with own data (2026-11-02) | — | Pilot design, claims | settled: early prototype with 1 outside user |
| Live vs planned capabilities | Advice upgrade deployed 2026-10-27; BLS price card **not showing**: job refused 8 of 8 tries (live DB, 2026-11-02) | — | BLS fix pending | What to promise | settled; BLS excluded from claims |
| Why it exists | Course project ([marketing/MARKETING_PLAN.md](../../marketing/MARKETING_PLAN.md)) | Goal: **class only** (2026-11-02) | Customer-side purpose is a proposal (STRATEGY.md §1) | Purpose, horizon | settled (founder side) |
| Users and customers | 67 browsers visited 2026-10-02 to 11-01; 3 browsers saw a report on their own data; 2 Square connections (may include the founder's test account) (E32) | Only the manager (2026-11-02) | Which of the 3 own-data browsers are the founder's | Funnel baseline | settled with caveat |
| Geography and language | Outreach drafts target Moody St and Main St, Waltham; EN/ZH app | Waltham Square cafes/bakeries; Chinese-speaking owners; Square sellers anywhere (2026-11-02) | Number of Chinese-speaking owners on Square in Waltham | Beachhead | settled; count unknown |
| Pricing and model | Free; no billing code (observed) | Class only; no plan to charge (2026-11-02) | — | Economics section | settled: no revenue |
| Acquisition history | October plan targeted 8-10 businesses; tracking log shows 3 drafted, 0 contacted | Outreach didn't produce new users (2026-11-02) | Whether walk-ins happened at all | Channel choice | settled |
| Next goal and timeline | — | Plan ends early to mid December (2026-11-02) | Exact final-deliverable date | Execution plan length (6 weeks) | settled |
| Budget and hours | $0 (ADVICE/FREE_TIER docs) | 1-2 hours a week (2026-11-02) | — | Channels (max 2), pilot size | settled |
| Outside assets | card.html, outreach drafts, Google Form exist in repo | **None** outside the repo: no printed cards, no social accounts, no shop contacts (2026-11-02) | Manager's willingness to introduce someone | Collateral | settled |
| Human interactions available | Founder can speak English and some Chinese (prior session notes) | Within 1-2 h/week | — | Encounter briefs | settled |
| Brand decisions | Name "Tally", DM Sans, amber accent #F59E0B, blue chrome #2F6FED, "Private to you" badge ([public/css/style.css](../../public/css/style.css) lines 8-22, [public/index.html](../../public/index.html)) | Not discussed | Whether the founder considers these approved | BRAND_VOICE.md visual section | treated as observed conventions; changes labeled proposed |

No open blocking questions remain. One non-blocking question is listed in [README.md](README.md).

## 2. Repository audit

| Finding | Evidence location | Status | Confidence | Strategic implication | Production verification needed |
|---|---|---|---|---|---|
| Connect Square read-only (merchant profile + orders) | [lib/square/api.js](../../lib/square/api.js) `SCOPES` | Implemented, live | High | Low-effort trial for Square owners | No (verified 2026-10-02) |
| Upload any sales CSV/Excel, incl. Square exports | [public/js/parser.js](../../public/js/parser.js) | Implemented | High | Works for non-Square too, but pitch stays Square | No |
| Sales stored only in the browser | [public/js/db.js](../../public/js/db.js); [functions/api/square/sync.js](../../functions/api/square/sync.js) header | Implemented | High | Privacy is a credible differentiator vs connectors that copy data | No |
| Weekday and hour **averages** (per day open), heatmap | [public/js/stats.js](../../public/js/stats.js) `salesByDow`, `heatmapData`; dashboard charts in [public/js/app.js](../../public/js/app.js) | Implemented | High | Directly answers the most-repeated Square forum request (E02, E07-E10, E22) | No |
| Fixed advice cards with "Start here", confidence, "not enough data" | [public/js/insights.js](../../public/js/insights.js), [public/js/advice.js](../../public/js/advice.js), [public/js/advice-view.js](../../public/js/advice-view.js) | Implemented, live 2026-10-27 | High | A report you read, not a chat you prompt | Owner comprehension unverified |
| Day Notes + "Did my change work?" comparison | [public/js/advice.js](../../public/js/advice.js) `adviceNoteImpact` | Implemented | High | Answers E17-E20, E23 (notes, extended hours) | Unverified with owners |
| Weather (opt-in, Open-Meteo) | [public/js/weather.js](../../public/js/weather.js) | Implemented | High | Weather-next-to-sales is a top forum request (E17, E18); the one user found weather not useful (E31) | — |
| English/Chinese UI and Privacy page | [public/js/translations.js](../../public/js/translations.js), [public/privacy.html](../../public/privacy.html) | Implemented; Chinese needs review ([ZH_REVIEW.md](../../ZH_REVIEW.md)) | Medium | Supports the Chinese-speaking segment | Fluent review pending |
| Anonymous step counting + Founder dashboard | [public/js/usage.js](../../public/js/usage.js), [lib/usage/](../../lib/usage/), [public/js/founder.js](../../public/js/founder.js) | Implemented, live | High | Funnel is measurable without new code | DNT/GPC visitors invisible |
| Campaign tag capture (`?ref=`) | [public/js/usage.js](../../public/js/usage.js) (refTag) | Implemented; unused so far | High | Printed QR codes can be attributed for free | Needs a tagged QR (T01) |
| Printable QR leave-behind card | [public/card.html](../../public/card.html) | Implemented; not printed | High | Ready awareness asset | — |
| Feedback form EN/ZH | [marketing/FEEDBACK_FORM.md](../../marketing/FEEDBACK_FORM.md) | Live (Google Forms) | High | Contribution channel exists | Responses unknown |
| Pricing, checkout, billing | none found | Not present | High | No payment funnel to measure; economics section is minimal | — |
| BLS price context | [workers/outside-data/](../../workers/outside-data/) | Deployed but failing (`bls_refused`) | High | Don't mention price context | Fix needed (TECHNICAL_BUILD_PLAN T03) |
| Square totals are gross, refunds not in sync | [lib/square/orders.js](../../lib/square/orders.js); labeled in app | Labeled | High | Say it before owners compare with Square (E15, E16, E27 show mismatches erode trust) | — |

### Inventory

1. **What it does:** turns Square (or file) sales into a fixed report: weekday and hour averages, heatmap, top items, week-over-week, and a short list of specific things to try, in English or Chinese.
2. **Who it serves:** small independent cafes, bakeries and counter restaurants on Square.
3. **Current voice:** honest, plain, student-made ("not affiliated with Square", "harsh feedback welcome"); see BRAND_VOICE.md.
4. **Paths:** visit → sample or connect/upload → report → (optional) feedback form; repeat use = reopen and auto-sync. No payment path.
5. **Measurement:** anonymous step events and Founder page; advice "shown/useful" counts.
6. **Missing / uncertain:** whether owners return; whether the Chinese segment exists locally; no outbound contact log beyond the private tracking table.
7. **Useful components:** `?ref=` tags, card.html, sample data, Day Notes, Founder dashboard.

## 3. Market definition

- **Customer job:** "Know when my shop is busy and what sells, so I can staff, prep and try things with less guessing."
- **Category (proposed):** a plain-language weekly sales report for small Square food sellers.
- **Buying context:** free; the "purchase" is the owner's time and the decision to connect their account. Decision maker = owner (sometimes the manager).
- **Alternatives:** Square's own reports, Square AI and Managerbot (free, built in), spreadsheets from CSV exports, paper notes, gut feel.
- **Geography:** Waltham, MA (Moody St, Main St) for the pilot.

Segments considered (fit detail in STRATEGY.md §2):

| Segment | Why consider | Main doubt |
|---|---|---|
| A. Waltham independent cafes/bakeries on Square | Walkable; owner on site; the one user is from this world | Few businesses; owners busy |
| B. Chinese-speaking food owners on Square (Waltham area) | Language advantage; in-person help in Chinese | Unknown how many exist locally; many Chinese restaurants use MenuSifu/Chowbus (C15-C16) |
| C. Square food sellers anywhere (online) | Large; the forum shows the need nationally | No in-person help; channel rules (S14) and 1-2 h/week |

## 4. Competitive analysis

Full inventory: [data/competitors.csv](data/competitors.csv): **49 alternatives plus Tally (C00)**. Unit = a distinct product or a distinct workaround; workarounds (C24-C27, C49) and human help (C46-C48) are listed separately in the Class column. Depth: 5 deep, 11 medium, 33 screened (existence and category from a dated source only). No market-share ranking is implied.

Counts by class: direct 16 (10 of them other POS systems' built-in reporting, which matter only to owners not on Square), indirect 10, adjacent 18, workaround 5.

### The ten that matter most

| ID | Competitor | Why it matters | Where it's stronger than Tally | Where Tally differs |
|---|---|---|---|---|
| C01 | Square Dashboard reports | Every target owner already has it | Exact, official, real-time, net/gross options | Square shows totals for a range; owners ask for **averages per weekday/hour** and can't get them (E02, E07-E10, E22) |
| C03 | Square Managerbot | Free, proactive, inside Square, F&B open beta since 2026-04 (E28) | Distribution, data access, actions (ordering), staff/labor data | Some owners find its ideas generic or its pop-ups unwanted (E25, E26); some avoid AI (E08) |
| C02 | Square AI (ask) | Free, answers questions | Flexible; can answer weekday averages if asked well | Requires knowing what to ask; mixed accuracy reports (E06); awareness was low in 2025 (E05) |
| C25 | Spreadsheet from CSV | What experienced owners actually do (E02, E15, E21) | Fully custom; owner trusts own sheet | Takes hours; Tally does the same averages in a minute |
| C26 | Paper notes / calendar | How owners record weather and events (E19) | Zero setup | Tally's Day Notes sit next to the numbers and compare days |
| C27 | Gut feel | Default | Free, instant | Numbers to check the gut |
| C05 | Spark Business Intelligence | Square marketplace analytics for cafes | Professional vendor, in the marketplace | Unverified price; Tally free and bilingual |
| C18 | Coupler.io and other connectors (C19-C23) | Square to Sheets/BI | Scheduled, flexible | Built for analysts; copy data to a third party |
| C15 | MenuSifu (and C16 Chowbus) | Bilingual POS for Chinese restaurants | Whole POS in Chinese | Different POS: those owners aren't Square users. Narrows segment B |
| C46 | SCORE mentors | Free human advice, local | Experience, judgment | Tally reads their own numbers |

### Decision-oriented maps

**1. Segment × need coverage** (✓ = covers well, ~ = partly, — = not)

| Need | Square reports | Square AI / Managerbot | Spreadsheet | Tally |
|---|---|---|---|---|
| Average sales per weekday over months | — (E07, E22) | ~ (if asked) | ✓ (hours of work) | ✓ |
| Average sales by hour per day open | ~ totals only (E01-E03) | ~ | ✓ | ✓ |
| Weather/events next to daily sales | — (E18 "no plans") | ~ (location context per Square press) | ✓ manual | ✓ Day Notes + opt-in weather |
| "Did my change work?" | — | ~ | ✓ manual | ✓ (comparison, not proof) |
| Item counts for production planning by pickup date | ~ | ~ | ✓ | — (out of scope) |
| Labor, costs, ordering | ~ | ✓ (Managerbot) | ~ | — |
| Chinese interface | ? (unverified) | ? | n/a | ✓ |

**2. Positioning map A: effort to get an answer (x) vs answer specificity to my shop (y).** Spreadsheet: high effort, high specificity. Square reports: low effort, low specificity for weekday/hour patterns. Square AI: low-medium effort, variable. Tally: low effort, medium-high specificity for timing questions only. Supports the decision to lead with timing patterns, not "everything".

**3. Positioning map B: asks you questions vs gives you a fixed page (x) by data stays in Square vs copied elsewhere (y).** Managerbot/Square AI: conversational, stays in Square. Connectors: fixed dashboards, data copied out. Tally: fixed page, sales kept in the owner's browser. Supports the "nothing to ask" message for AI-averse owners. Weakness: "stays in Square" is arguably the safest of all; Tally can't claim more privacy than Square itself.

**4. Distribution coverage:** Square owns the dashboard every owner opens; Tally has no distribution except the founder in person. Implication: compete on **in-person help and a specific answer**, not reach.

**Where Tally loses:** breadth (labor, costs, ordering), official numbers (net sales), distribution, longevity (class project ends in December). The honest framing is "a second opinion on your timing patterns, with a person who'll sit with you", not "better than Square".

## 5. Social listening

### Method

- **Platforms tried:** Square Community (public, readable); Reddit (blocked from this research setup, both by fetch and the built-in browser); LinkedIn/Instagram/Facebook/WeChat/Xiaohongshu (not attempted: sign-in, private, or needs a Chinese reader).
- **Search patterns used on the Square Community:** "average sales by day of week", "busiest day report", "item sales by hour", "net sales does not match", "price increase sales report", "square ai wrong answer", "weather sales", "compare promotion sales", "report coffee shop", "restaurant reports confusing", "ManagerBot".
- **Sampling:** top results per query, read first post and first replies; date range 2017-2026, with recent (2025-2026) material prioritized and older threads kept to show persistence.
- Passive reading only: nothing was posted, liked, or messaged.

### Coverage (actual)

| Measure | Count |
|---|---|
| Spaces discovered | 22 ([data/social_sources.csv](data/social_sources.csv)) |
| Screened for relevance | 22 |
| Qualified | 19 |
| Accessible from this setup | 11 (all boards of one parent: Square Community) |
| Inspected | 11 boards |
| Deeply researched | 4 boards (Feature Requests, Reports Setup & Management, Archived Discussions, Community Corner) |
| Threads opened and read | 31 |
| Search queries run | 11 |
| Usable observations recorded | 27 forum items (E01-E27) + 3 vendor + 3 repository/user = 33 |

**Gap against the template's target (100+ qualified spaces):** large. Every inspected space belongs to one parent community whose members are Square sellers, often power users ("Champions"). This is reasonable evidence of a persistent need among Square sellers, but **not** evidence about Waltham owners or Chinese-speaking owners. Remaining work, in priority order, is in the field guide below. Given 1-2 hours a week, expanding to 100 spaces is not proportionate to a class pilot; 20 minutes a week of reading (X05) is.

### Status quo table

| Situation | Customer language (quote or paraphrase) | Current response | Why it persists | Unresolved cost | Desired progress |
|---|---|---|---|---|---|
| Deciding staffing and opening hours | "staffing is our biggest expense" (E12); "taking me forever!" (E01) | Click through daily reports; hover the hourly chart | Square shows totals for a range, not averages per weekday/hour (E02, E07) | Hours of manual work, or guessing | A weekday-by-hour view averaged over months |
| Explaining a slow day | Paper calendar of weather and events (E19); spreadsheet/Airtable with weather (E17) | Keep notes outside Square | Square has "no plans" to add it (E18) | Notes and numbers live in different places | Context next to each day's sales |
| Checking a change (extended hours, promo) | "make sure we're covering the additional labor cost" (E23) | Custom date/time filters | Hard to isolate the right days (E23) | Changes judged by feel | A fair before/after on similar days |
| Trusting the totals | Owner, bookkeeper and CPA confused (E16); downloaded data lacks counts (E15) | Reconcile by hand | Several report types define sales differently | Distrust of every number | Numbers that say what they include |
| Trying AI | "prefer to avoid AI as much as possible" (E08); "most of the time doesn't answer my question properly" (E06); "can't wait to... close this bot" (E25) vs "absolutely amazing" (E05) | Some love it, some ignore it | AI quality varies; prompts take effort | Split audience | An answer without having to ask |

### Evidence to action

| Insight | Support | Contradictions | Confidence | Implication | Experiment |
|---|---|---|---|---|---|
| Weekday/hour averages are a long-standing unmet need in Square's own reports | E01-E03, E07-E13, E22 (2017-2026) | Square AI/Managerbot may now answer it if asked (E29) | High for the need; medium that it's still unmet for a given owner | Lead the pitch with "your average Tuesday, hour by hour" | X01 |
| Owners record weather/events by hand | E17-E20 | The one user found weather not useful (E31) | Medium | Show Day Notes, keep weather as optional, don't lead with it | X03 |
| Part of the audience is wary of AI or annoyed by it | E06, E08, E25, E26 | E05 (enthusiasts) | Medium | "Nothing to type or ask" is a real message for some owners | X01 wording |
| Mismatched totals erode trust fast | E15, E16, E27 | — | High | Say "gross sales, before discounts and refunds" first, every time | Built into C01 |
| Square's free AI keeps improving | E28, E29 | — | High | Tally's advantage is narrow and may shrink; the class pilot is about learning, not market share | — |

### Field guide: best places to observe next (in a normal browser)

| # | Where | What to read | Search | Question it answers |
|---|---|---|---|---|
| 1 | [Square Community: Feature Requests](https://community.squareup.com/t5/Feature-Requests/idb-p/feature-requests) | Newest 20 ideas | "report", "hour", "weather" | What's still unmet now? |
| 2 | [Square Community: Reports Setup & Management](https://community.squareup.com/t5/Reports-Setup-Management/bd-p/reports) | Last 30 days | "average", "day of week" | Same need, new people? |
| 3 | [Square Community: Feedback Discussions](https://community.squareup.com/t5/Feedback-Discussions/bd-p/feedback) | Managerbot threads | "Managerbot" | Is Managerbot closing the gap? |
| 4 | r/SquarePOS_Users | Top posts this year | "report", "AI" | Square users outside the forum |
| 5 | r/restaurantowners | Threads about POS reports | "POS reports", "busiest" | Restaurant owners' language |
| 6 | r/smallbusiness | Square threads | "Square reports" | General owners |
| 7 | Moody St / Main St counters (S22) | What you see at the register | — | Who is on Square |
| 8 | Xiaohongshu (with a Chinese reader) | Posts by US cafe owners | "餐馆 Square 报表" (illustrative query) | Do Chinese-speaking owners discuss this? |

### Bounded listening cadence

20 minutes a week, Fridays: rows 1-3 of the field guide, plus one of rows 4-6 in rotation. Add any new usable thread to [data/evidence.csv](data/evidence.csv) with the next E-number. Stop when the plan ends (December).

## 6. Conflicting evidence and remaining research

- **Square AI quality:** praised by a power user (E05), criticized by others (E06). Unresolved; ask owners in sit-downs (FEEDBACK_SYSTEM.md question 2).
- **Weather:** strongly requested on the forum (E17, E18) but the one local user didn't value it (E31). Keep it optional.
- **Local Chinese-speaking owners on Square:** existence and count unknown; Chinese restaurant POS vendors (C15-C17) suggest many use other systems. Resolve by observing counters (S22).
- **Remaining:** Reddit and Chinese-language spaces; Spark BI pricing; whether Managerbot already shows weekday/hour averages unprompted.
