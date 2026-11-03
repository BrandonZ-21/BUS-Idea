# Technical build plan

Run date 2026-11-02. Status: **planned; nothing here is built.** Each ticket needs the founder's go-ahead; any live change needs a separate approval (push, deploy, secret).

## Capability assessment (existing stack first)

| Capability | Today (observed) | Decision |
|---|---|---|
| 1. Acquisition / campaign capture | `?ref=` and `utm_source` read on visit ([public/js/usage.js](../../public/js/usage.js), `visitContext`; allow-listed in [lib/usage/events.js](../../lib/usage/events.js) `REF_TAG`) | **Reuse.** Only missing: tagged QR codes (T01) |
| 2. Customer goal capture | None | **Skip** for the pilot: the sit-down captures goals in conversation |
| 3. Onboarding progress | Steps counted (sample, upload, connect, sync, report) | Reuse |
| 4. Value events | `report_viewed` (source), `rec_shown`, `rec_useful`, `data_added` | Reuse |
| 5. Billing/CRM reconciliation | No billing (free, class only) | Not applicable |
| 6. Customer timelines | Founder page anonymous journeys ([public/js/founder.js](../../public/js/founder.js)) | Reuse; never de-anonymize |
| 7. Stalled-journey queue | Private tracking log ([marketing/FEEDBACK_SYSTEM.md](../../marketing/FEEDBACK_SYSTEM.md)) | Reuse (manual) |
| 8. Feedback and opportunities | "Was this useful?", Google Form | Reuse; add a source question (non-code) |
| 9. Experiments | Opener A/B via `?ref=walkin-a/b` | Reuse (T01) |
| 10. Data quality | Founder page "Outside data" and "Free-tier health" panels | Reuse; fix BLS (T03) |
| 11. Views | Founder page | Reuse; no new dashboard |

## Tickets

### T01 (P1): Tagged QR codes on the printable card

**Status: built and tested locally 2026-11-02, not yet pushed.** `card.html?ref=walkin-a` → QR and link open `bus-idea.pages.dev/?ref=walkin-a`; invalid or missing tag → untagged card; a note above the card (not printed) shows the tag; pitch line changed to "Your average Tuesday, hour by hour." Still fits one Letter page.

- **Problem:** printed cards can't be attributed; the walk-in opener comparison (X01) needs tags.
- **Evidence / current behavior:** [public/card.html](../../public/card.html) lines 94-99 build the app QR from `appShareUrl()` ([public/js/feedback.js](../../public/js/feedback.js) line 22), with no tag. Visit tags are already captured and allow-listed (`REF_TAG = /^[a-z0-9_-]{1,32}$/` in [lib/usage/events.js](../../lib/usage/events.js)).
- **Proposed behavior:** opening `card.html?ref=walkin-a` prints a card whose app QR and link text point to `https://bus-idea.pages.dev/?ref=walkin-a`. No tag → today's behavior. Optional: replace the pitch line with "Your average Tuesday, hour by hour."
- **Smallest release:** read `ref` from `location.search`, validate with the same pattern, append it to the app URL only.
- **Files:** `public/card.html` (observed). No new files.
- **Reuse:** `appShareUrl()`, `qrSvg()`.
- **Acceptance:** `card.html?ref=walkin-a` QR scans to `/?ref=walkin-a`; `card.html?ref=BAD TAG!` falls back to no tag; feedback QR unchanged; prints on one Letter page.
- **Validation:** scan with a phone that isn't excluded; Founder page "Sources" shows `walkin-a`; then exclude the phone.
- **Dependencies:** none. **Owner:** founder + Claude. **Effort:** 20-40 min. **Ongoing cost:** $0.
- **Outcome metric:** visits by tag. **Guardrail:** no personal data in tags (tags name a campaign, never a shop).

### T02 (P2): Note the pilot cohort without identifying anyone

- **Problem:** the scorecard needs to tell pilot owners' returns from classmates' visits.
- **Proposed:** no code. Use distinct tags per channel (T01) and note session times; read the Founder page journeys by time. Re-evaluate only if sessions overlap.
- **Effort:** 0. **Status:** decided as process, not code.

### T03 (P1, operational): Fix the BLS outside-data job

- **Problem:** the price-context card never appears. Live database (read 2026-11-02): `bls_cpi` failed 8 times in a row with `bls_refused`; 24 runs, 16 ok, 8 outside requests.
- **Evidence:** [lib/outside/bls.js](../../lib/outside/bls.js) maps BLS status `REQUEST_NOT_PROCESSED` to `bls_refused`. *Inferred cause:* BLS's no-key daily limit (25) is counted per IP address, and Cloudflare Workers share outgoing addresses with other sites.
- **Proposed:** register a free BLS API key and add it as the Worker secret `BLS_API_KEY` (the code already sends it: [lib/outside/bls.js](../../lib/outside/bls.js)). The key needs renewing yearly ([MAINTENANCE.md](../../MAINTENANCE.md)).
- **Acceptance:** next run records `bls_cpi:ok`; Founder page shows Fresh; `/api/outside` returns `bls_cpi`.
- **Dependencies:** founder registers at bls.gov (their email); founder runs `npx.cmd wrangler secret put BLS_API_KEY` in `workers/outside-data/`. **Owner:** founder. **Effort:** 15 min. **Cost:** $0.
- **Marketing relevance:** low; the pitch doesn't use price context. Fix it so the deployed feature works, or turn it off from the Founder page.

### T04 (P3, conditional on X02): "Remind me weekly" calendar file

- **Problem:** repeat value may be lost to forgetting.
- **Condition:** build only if a sit-down owner says they'd reopen it but doesn't (X02).
- **Proposed:** a button that downloads a weekly `.ics` reminder made in the browser (no server, no email, nothing stored). New code in `public/js/advice-view.js` or a new `public/js/reminder.js` (**proposed path**).
- **Acceptance:** the file imports into Google/Apple Calendar as a weekly event linking to the app; works in EN/ZH; no network request.
- **Effort:** 1-2 h. **Outcome metric:** returns from reminded owners (directional only).

### T05 (P3): Card visual

- **Proposed:** add a static image of the sample heatmap to the card (generated from sample data, not a real shop). **Effort:** 30-60 min. **Only if** T01 is done and time remains.

## Not building

Lead capture, CRM, email automation, payments, a new analytics tool, Reddit/Instagram integrations, or anything that stores sales on the server.
