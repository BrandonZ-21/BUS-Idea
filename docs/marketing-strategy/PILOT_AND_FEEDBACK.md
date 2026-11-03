# Learning pilot and feedback loop

Run date 2026-11-02. Status: **planned, not started.** Nothing here has been sent or posted.

## Why the pilot is small

The template plans for about 100 people. Tally's real constraints (user-confirmed 2026-11-02) are 1-2 founder hours a week for about 6 weeks, $0, no outside accounts, and one outside user so far. At roughly 10 minutes per counter conversation and 30 minutes per sit-down (incl. notes), that buys about **12-15 counter conversations and 3-4 sit-downs**. The pilot is sized to that. It can show direction and surface objections; it cannot estimate rates for Waltham, let alone Square sellers in general.

## Central uncertainty

> When a Waltham cafe/bakery owner on Square sees their own average weekday and hour patterns, does it tell them something they didn't know, and do they come back to it on their own?

One consequential uncertainty at a time. Opener wording (X01) is a secondary, cheap comparison inside the same visits.

## Audience options

| Option | Fit | Problem | Readiness | Familiarity | Access | Bias | Choice |
|---|---|---|---|---|---|---|---|
| Walk-ins: Moody St + Main St independent cafes/bakeries on Square | High | Weekly scheduling | Low (unprompted) | None | Walkable, 2-4 pm | Only shops open and calm at that hour | **Chosen** |
| Manager's introductions | High | Same | Warmer | Through the manager | Depends on manager | Friendly bias | Add-on (A08) |
| Square sellers online (S12-S14) | Medium | Same | Self-selected | None | Rules limit posting | Power-user bias | Listening only (X05) |

**Generalization:** results speak to walk-in-reachable independent shops in Waltham during weekday afternoons. Not to busy shops, chains, other towns, or owners who never stand at the counter.

**Counting units (kept separate):** businesses approached; owners/managers spoken to; sit-downs completed; owners who saw their own data; owners who returned within 7 days (Founder page, their own device); feedback responses.

**Inclusion:** independent food business; Square visible at the register; owner or manager present. **Exclusion:** chains; not on Square; the founder's own workplace (the manager stays a separate "prior user"). **Variation to seek:** at least one bakery and one cafe; at least one Chinese-speaking owner if any are found.

## Exposure and procedure

1. **Counter (H1/H2):** 30-second opener (A02), alternating opener A (average Tuesday) and B (October "free one-page report") by visit order. Leave the QR card (A01) with `?ref=walkin-a` or `?ref=walkin-b` (needs T01).
2. **Sit-down (C01, 15 min):** sample first → their data (connect or upload) on **their** device → Start here → one thing to try → interview questions 1-4 from [FEEDBACK_SYSTEM.md](../../marketing/FEEDBACK_SYSTEM.md).
3. **Recall check at 48-72 hours** (separate, no replay): one-line message or quick stop: "What do you remember from Tally?" Ask before showing anything again.
4. **One-week check (C02):** "Did you open it again? What did you look at? Did you try the suggestion?" Then check the Founder page for a return from that device. Ask for one introduction only if they found it useful.
5. **Later observation:** end of pilot (Dec 8-11): any further returns.

Follow-ups refresh memory: the 48-72 h check is the unaided-recall measure; the one-week return counts as **spontaneous** only if it happened before the one-week visit.

## Measures

| Moment | Measure | Source |
|---|---|---|
| Counter | Agreed to sit-down / spoken to (by opener) | Private tracking log |
| Sit-down | Saw own data; what they said they didn't know before; what they'd try | Notes; `report_viewed(source=own)` |
| 48-72 h | Unaided recall: what it is, whom it serves, one thing it showed | Notes |
| 7 days | Spontaneous return (before reminder) | Founder page "came back"; owner's word |
| Any time | "Useful?" answers by card | Founder page advice panel |
| End | Objections, hesitations, non-converters' reasons | Notes |

## Scorecard (fill in weekly)

| Week | Approached | Spoken to | Opener A yes/total | Opener B yes/total | Sit-downs | Own data seen | Recall correct at 48-72 h | Returned in 7 days (spontaneous) | Useful yes/no | Top objection | Hours spent |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Nov 3-9 | | | | | | | | | | | |
| Nov 10-16 | | | | | | | | | | | |
| Nov 17-23 | | | | | | | | | | | |
| Nov 24-30 | | | | | | | | | | | |
| Dec 1-7 | | | | | | | | | | | |
| Dec 8-11 | | | | | | | | | | | |

## Decision rules

| Observation | Decision |
|---|---|
| 2+ sit-down owners say Square/Managerbot already shows this | Revisit opportunity: pitch in-person help + notes (O2), or stop and write up why |
| Owners say "I already knew that" about weekday/hour | Change the proof: lead with the slowest stretch or a Day Notes comparison |
| Nobody agrees to a sit-down after 6 conversations | Access problem: shift time of day or rely on the manager's introduction |
| 1+ of 3 returns spontaneously within 7 days | Promising: test a weekly reminder (.ics, T04) with the next owner |
| 0 of 3 return | Value may be one-time: ask why in C02; report it honestly |
| Owners hesitate at connecting | Lead with upload or sample; test the privacy page in their language |
| A promising result | Repeat with 2 fresh shops before saying anything stronger |

## Customer contributions as an operating habit

**Loop:** invite → understand → identify the need → prioritize → test → improve → measure → report back.

**Routes:** in-app "Was this useful?" (live), "Give feedback" Google Form (live, EN/ZH), the sit-down itself, the one-week check.

**Opening questions (one at a time):**
- "What would make this more useful next time?"
- "What do you still need another tool or person to do?"
- "What should I keep exactly as it is?"

**Follow-ups (selectively):** "When did you last need that?" · "How do you handle it today?" · "How would you know it got better?"

**Who to ask:** sit-down owners (new users), the manager (prior user), anyone who stopped responding (stalled), owners who said no (non-buyers): "What would have made it worth 15 minutes?"

**Opportunity card template**

| Field | Entry |
|---|---|
| Original input and source | |
| Customer context and situation | |
| Underlying need | |
| Current workaround | |
| Frequency / consequence | |
| Desired outcome | |
| Evidence / contradictions | |
| Possible responses | |
| Smallest test | |
| Success measure | |
| Owner, status, review date | Founder · new · |

**Prioritize by:** fits the beachhead · severity · how many owners raised it unprompted · effort in hours · whether it can be tested before December. Votes and volume are signals, not proof. Statuses: clarifying · researching · testing · small improvement · planned · deferred · declined.

**Triage cadence:** Fridays, 10 minutes, together with the scorecard. One inbox: the private tracking log in `marketing/FEEDBACK_SYSTEM.md`.

**Close the loop (draft; don't send without approval):**

> You mentioned [idea]. I understood the need as [need]. I tried [response] and found [finding]. Here's what changed, or why I'm not doing it before the class ends. Does that help with what you were after?

Never promise a feature or date. Ask whether a shipped change solved the original problem.

### Worked example (from real evidence, E31; labeled where illustrative)

- **Input:** the manager said weather wasn't useful (FEEDBACK_SYSTEM.md themes table).
- **Context:** the founder's workplace, which sells on Square on the Brandeis campus; weather is opt-in.
- **Need (interpreted):** explanations for slow days that matter locally. *Illustrative:* school breaks may matter more than rain near campus.
- **Response tested:** the Brandeis dates file now feeds a "coming up nearby" tip (built 2026-10-27).
- **Smallest test:** show the manager the weekly comparison listing school dates; ask whether it explains a quiet week.
- **Success measure:** the manager names one week the dates explain.
- **Close the loop:** "You said weather didn't help. I added Brandeis dates instead; does that explain any quiet weeks for you?"
