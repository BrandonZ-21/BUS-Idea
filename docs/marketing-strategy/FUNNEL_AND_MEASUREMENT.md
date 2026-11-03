# Funnel and measurement

Run date 2026-11-02. Events: [data/event_dictionary.csv](data/event_dictionary.csv). Most of what's needed already exists (observed in [public/js/usage.js](../../public/js/usage.js), [lib/usage/events.js](../../lib/usage/events.js), [lib/usage/summary.js](../../lib/usage/summary.js)). This plan adds almost no code.

## Activity hypothesis

> Owners of Waltham cafes/bakeries on Square, arriving through a walk-in and a 15-minute sit-down, connect Square (or upload) and read their weekday/hour averages and Start-here card. Seeing their own data in the sit-down (`report_viewed`, source=own) is the candidate first-value moment; returning on their own within 7 days (`data_added` on a second day, or a new visit from their device) is the candidate repeat value. We will test this through the pilot ([PILOT_AND_FEEDBACK.md](PILOT_AND_FEEDBACK.md)).

Stated intent ("I'd use this weekly") is recorded separately from observed returns. The founder being in the room inflates first value; this is a **founder-assisted** funnel and must be reported as such.

## Journey

| Stage | Goal | Entry → exit | Eligible population | Counted entity | Window | Likely stalls | Response |
|---|---|---|---|---|---|---|---|
| Approach | Owner hears the opener | Walk-in → spoken to | Businesses visited | Business | Same visit | Owner absent, rush | Leave card, come back |
| Interest | Agree to a sit-down | Spoken → time booked | Owners spoken to | Business | 1 week | "No time" | Offer 10 minutes or sample only |
| Trial | See own data | Sit-down → `report_viewed` (own) | Sit-downs | Business (device) | Same session | Won't connect | Upload a file, or sample |
| First value | Owner names one thing they didn't know | Report → stated learning | Owners with own data | Business | Same session | "I knew that" | Probe slowest stretch, notes |
| Repeat | Returns unprompted | Day 0 → visit or sync from their device | Owners with own data | Browser (their device) | 7 days | Forgets | Reminder test (T04) only after measuring spontaneous return |
| Referral | Introduces one owner | Useful → intro | Owners who said "useful" | Business | Pilot | No one to introduce | Don't push |
| Payment | n/a | — | — | — | — | Free; class only | Not measured |

**Transition conversion** = businesses entering stage A that reach stage B within window W / businesses entering A with at least W elapsed. Businesses still inside the window are "in progress", not "lost". With these sample sizes, report counts ("2 of 3"), never percentages alone.

## Baseline from live data (aggregate, read-only, 2026-10-02 to 11-01; E32)

| Step | Browsers |
|---|---|
| Visited | 67 |
| Loaded sample data | 7 |
| Started Square connect | 3 |
| Connected Square | 2 |
| Saw a report on own data | 3 |
| Added own data on 2+ days | not computed (1 browser added own data) |

Caveats: browsers, not people; the founder's other devices may be included (1 browser excluded); visitors with Do Not Track/GPC are invisible; most visits came in the first week (37 browsers in week 39), likely classmates.

## Identity and attribution

- **Tracked source:** `?ref=` tag on every printed QR and link (observed capability, unused). Tags: `card-moody`, `card-main`, `walkin-a`, `walkin-b`, `manager-intro`.
- **Self-reported source:** add "How did you hear about Tally?" to the Google Form (A05). Keep separate from tracked source.
- **Person ↔ browser:** never joined. In sit-downs the founder notes the date/time; the Founder page "Recent visits" shows anonymous steps around that time. Do not open the database to identify an owner (FEEDBACK_SYSTEM.md rule).
- **Founder exclusion:** open `?notrack=1` once on every personal device before the pilot (MAINTENANCE.md).

## Economics

No revenue, no billing, no acquisition spend: **customer economics are not applicable** to this class pilot (user-confirmed). The real cost is founder time; record hours per stage in the scorecard. A cost per sit-down in hours is the one useful economic number (e.g., hours spent ÷ sit-downs completed).

## Dashboards (existing Founder page; no new build)

| Element | Question | Metric | Cadence | Trigger to investigate | Next step |
|---|---|---|---|---|---|
| Sources (visits by refTag) | Did the cards/walk-ins bring visits? | Browsers per tag | Weekly | A tag with 0 visits after 5 cards | Check QR scans on a phone |
| First report on own data | Did sit-downs produce first value? | Browsers with report_viewed(own) | After each sit-down | Session done but count unchanged | Check DNT, founder device exclusion |
| Came back with new data | Repeat value | Browsers with data on 2+ days | Day 7 after each sit-down | — | Ask in C02 |
| Advice cards shown/useful | Which advice lands | yes/no by card | Weekly | Any card with more No than Yes | Reword or demote it |
| Failures | Did something break? | upload/connect/sync failures | Weekly | Any new failure | Reproduce with sample |
| Outside data / free tier | Is the system healthy? | Status panels | Weekly | BLS not Fresh | T03 |

Investigation template: "We observed [behavior] among [cohort]. We believe [explanation]. Changing [experience] should improve [outcome]. We'll check [metric] over [window] while protecting [guardrail]."

## Verification before pilot traffic

1. Print a test QR with `?ref=test` (after T01); scan it on a phone that isn't excluded; confirm the Founder page shows the tag. Then exclude that phone.
2. Do one full journey with the sample on a fresh browser: visit → sample → report; confirm counts move by one.
3. Confirm the founder's laptop and phone are excluded.
4. Don't interpret anything until 1-3 pass.
