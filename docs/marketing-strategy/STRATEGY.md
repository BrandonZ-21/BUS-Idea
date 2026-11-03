# Tally strategy

Run date 2026-11-02. Horizon: now to early-mid December 2026 (class only, user-confirmed 2026-11-02). Budget $0, 1-2 founder hours a week.

Evidence IDs (E..), competitor IDs (C..) and spaces (S..) refer to [data/](data/). Labels: *observed*, *user-confirmed*, *externally observed*, *inferred*, *hypothesis*, *proposed*.

## Decision summary

| Decision | Choice | Why |
|---|---|---|
| Initial customer | Owners of independent cafes and bakeries on Square, walking distance in Waltham (Moody St, Main St), including Chinese-speaking owners where they exist | Reachable in person; matches the one outside user; the founder's in-person, bilingual help is the only advantage Square can't copy |
| Opportunity | **Undercommunicated value on an underserved need:** owners have asked Square for years for average sales by weekday and hour; Tally already shows it | E02, E07-E10, E22 (2017-2026); Square staff confirm no built-in report |
| Promise | "See your average Tuesday, hour by hour, from your Square sales. Nothing to type or ask." | Specific, true today, testable in 15 minutes |
| Channels (max 2) | 1) Walk-ins with a QR leave-behind; 2) one introduction from the founder's manager | 1-2 h/week; no accounts or contacts exist (user-confirmed) |
| Goal for the class | **Learning, not growth:** 3 owners see their own data in a sit-down; learn whether anyone returns within a week | One outside user today |
| Deferred | Square sellers anywhere (online) | No in-person help; channel rules; time. Listening only (X05) |

## 1. Who we are and why we exist

**Founder purpose (user-confirmed):** a BUS 131 project to test a startup idea; it ends with the semester.

**Customer-facing purpose (proposed; the founder's motivation must not become the customer's reason to use it):**

> We exist to help owners of small food businesses see the patterns in their own sales, because the numbers they need to staff and prep are already in their register but hard to read. We do this with a fixed, plain-language report from their Square sales, kept in their own browser, and a person who will sit with them while they read it.

- **Beneficiary:** the owner or manager of a small independent cafe, bakery or counter restaurant.
- **Founding insight:** owners don't lack data; they lack the *average* view. Square shows totals for a date range; owners rebuild averages by hand in spreadsheets (E02, E15, E21).
- **Mission (now):** show a few Waltham owners their own weekday and hour patterns, and learn whether that changes anything they do.
- **Vision (proposed):** small owners make staffing and prep choices from their own patterns, not only from memory.
- **Decision principles (proposed):**
  1. **Say what the number includes before showing it.** (Gross, before discounts and refunds.)
  2. **Show a pattern, never a promise.** Every suggestion is something to try, with how to check it.
  3. **The owner's sales stay with the owner.** Nothing that requires storing sales on a server.
  4. **Show up in person before posting online.** A face and a sit-down beat an ad at this stage.
  5. **Say "not enough data yet" instead of guessing.**
- **Capabilities today (observed):** connect Square read-only or upload a file; weekday/hour averages; heatmap; top items; Start-here advice; Day Notes comparisons; EN/ZH; free.
- **Advantages:** in-person help in English and Chinese; a specific answer to a long-standing request; no prompting; sales stay in the browser.
- **Weaknesses:** one user; ends in December; no distribution; can't match Square's breadth or official net totals; BLS price card not working (TECHNICAL_BUILD_PLAN T03).
- **Business logic:** none needed for the class (user-confirmed no charging). If it ever charged, Open-Meteo's free license would no longer allow weather (MAINTENANCE.md).
- **Boundaries (we decline):** businesses not on Square (for the pilot); full-service restaurants wanting labor/food cost; any claim of "AI", "increase sales", "used by local businesses"; showing any business's real numbers in public material.

## 2. Customer profile and persona

### Segment comparison (beachhead choice)

| Criterion | A. Waltham Square cafes/bakeries | B. Chinese-speaking owners (Waltham area) | C. Square food sellers anywhere |
|---|---|---|---|
| Urgency | Medium: staffing/prep decisions weekly (E12, E13) | Same, unknown locally | Medium (forum) |
| Frequency | Weekly | Weekly | Weekly |
| Reachability with 1-2 h/week | **High** (walkable) | Low-medium (count unknown) | Low (channel rules, no help) |
| Switching readiness | Free, read-only, no switch: they keep Square | Same | Same |
| Purpose/capability fit | High | High (language) | Medium (no in-person) |
| Evidence | 1 user (E31) + forum need | Hypothesis | Forum need (E01-E27) |
| **Choice** | **Beachhead** | Sub-cohort inside A when found | Defer; listen only |

### Who they are (inferred from forum posts and the October plan; not demographic data)

**Circumstances**

| Dimension | Present state | Desired future | Evidence/confidence | Marketing implication |
|---|---|---|---|---|
| Role | Owner who also works the counter, or a manager | Fewer gut-feel calls | E12, E31; medium | Approach owner/manager, not staff |
| Time | Busy at rushes; quieter 2-4 pm weekdays | Answers in minutes | October plan; medium | Walk in 2-4 pm; 15-minute sessions |
| Tools | Square POS and Dashboard; maybe a spreadsheet | One place to look | E02, E21; medium | Position as a second view of Square data, not a replacement |
| Technology comfort | Varies; Champions build scripts, others click reports | Nothing to set up | E24 vs E01; low | Demo on their device; sample data first |
| Language | English; some owners more at ease in Chinese | Explanation in their language | User-confirmed segment; low (count) | Chinese script and privacy page ready (review pending) |

**Psychographics**

| Dimension | Present state | Desired future | Evidence/confidence | Implication | Predicts adoption? |
|---|---|---|---|---|---|
| Trust in numbers | Distrust when totals don't match (E15, E16) | Numbers that say what they include | High | Lead with "gross, before discounts and refunds" | Yes (barrier) |
| Attitude to AI | Split: enthusiasts (E05) vs avoiders (E08, E25) | Tools that don't demand attention | Medium | "Nothing to type or ask" for avoiders | Possibly |
| Pride | Proud of best sellers (Community "best seller" thread) | Recognition of what works | Low | Open with what's going well | Descriptive |
| Risk tolerance | Wary of connecting accounts | Control, easy undo | Medium (OUTREACH_KIT trust lines) | Read-only, disconnect anytime, sample first | Yes |

### What hurts

- **Trigger:** deciding next week's schedule, a slow day, a change they made (extended hours, new item, promo).
- **Cost of the status quo:** hours of clicking or spreadsheet work (E01, E02, E15), or guessing. Staffing is "our biggest expense" (E12).
- **Workarounds:** spreadsheets from CSV (C25), paper notes (C26), peer spreadsheets (C48), gut (C27), now Square AI/Managerbot (C02-C03).
- **Why the workaround survives:** free, familiar, "good enough"; the pain is occasional, not daily.
- **What would justify trying Tally:** seeing their own average Tuesday in under 15 minutes, with no setup.

### Voice of customer (from forum evidence; see [data/evidence.csv](data/evidence.csv))

| Original language | Underlying problem | Workaround | Desired outcome | Messaging implication |
|---|---|---|---|---|
| "taking me forever!" (E01) | Hourly patterns need manual work | Day-by-day clicking | Busy hours at a glance | "Hour by hour, averaged for you" |
| "staffing is our biggest expense" (E12) | Staffing decisions | Guessing | Know busiest days/times | Tie the heatmap to the schedule |
| "I personally prefer to avoid AI as much as possible" (E08) | Doesn't want a chatbot | Spreadsheet | A plain report | "Nothing to type or ask" |
| Paper calendar of weather and events (E19, paraphrase) | Why was today slow? | Notes outside Square | Context next to sales | "Write a note on the day; Tally compares it" |
| "make sure we're covering the additional labor cost" (E23) | Did the change pay? | Filters | Fair before/after | "Did my change work?" card, as a comparison, not proof |

### Buying journey

| Stage | Trigger | Behavior | Channel/person | Question/objection | Proof needed | Next action |
|---|---|---|---|---|---|---|
| Notice | A student at the counter at a quiet time | Listens 30 seconds | Founder | "Is this Square? Is this selling something?" | "Student project, free, not Square, read-only" | Agree to a time |
| Evaluate | Sit-down | Sees sample, then own data | Founder + their device | "Will it change anything in Square? Who sees my sales?" | Read-only scopes; privacy page; disconnect | Connect or upload |
| First value | Own weekday/hour averages | Reads Start here | App | "Is this number right?" | Gross label; compare one day with their Dashboard | Try one suggestion |
| Repeat | A week later | Reopens (auto-sync) | App | "Do I need this weekly?" | Something they learned last time | Keep, or say why not |
| Refer | Satisfied | Mentions to another owner | Owner | "Who else would find this useful?" | — | One introduction |

### Persona (synthetic composite; labeled illustration, not a real person)

**Mei, 41, owns a small cafe-bakery on Moody St.** Square at the counter for six years. Two part-timers on weekdays, three on Saturdays. Bakes from 5 am; at the register from 7. Talks to customers in English and to her mother on the phone in Mandarin. Opens the Square app on her phone at night to check the day's total. Tried the "ask" box once; it answered a different question than she meant, and she didn't try again.

- *Problem episode (illustrative):* It's Thursday night and she's writing next week's schedule. Last Tuesday felt dead after 2 pm, but the Tuesday before was fine. She scrolls the Dashboard, sees a total for the week, gives up, and copies last week's schedule.
- *Browsing episode (illustrative):* Between batches she reads a baking supplier's Instagram post and a Facebook post in a Waltham group about parking on Moody St.
- *Buying decision (illustrative):* A student stops by at 2:30, says it's free and read-only, and offers to show her the sample first. She says "come back Monday at 2."
- *Her words (illustrative):* complaint: "I know Tuesdays are slow, I just don't know how slow." Query: "square report average by day of week." Objection: "I don't want anyone seeing my numbers." Desired future: "I just want to know if I need Jess on Tuesday afternoons." Recommendation: "The student showed me my Tuesdays. Ask him."
- *Monologue (illustrative):* "I don't have time to learn a new program. If it shows me something I didn't know in five minutes, fine. If it wants me to type questions, no."

**Inclusion:** independent, on Square, counter service, owner or manager on site, 30+ days of sales. **Exclusion:** chains/franchises, not on Square, full-service restaurants focused on labor/food cost, businesses where the founder works (except the manager's own feedback). **Distracting near-fits:** food trucks (location changes), Brandeis dining (institutional). **Five decisions this changes:** walk in 2-4 pm; show sample before asking to connect; lead with weekday/hour; say "gross" first; offer the Chinese script where it helps. **Unanswered:** does Mei exist on Moody St in the Chinese-speaking version; would she reopen it without a visit?

## 3. Attention, trust and influence

| Where attention goes | Evidence | Use |
|---|---|---|
| The counter and the register | Owners are there (October plan) | Primary meeting point |
| Square Dashboard app at night | E05, Square press | Competitor's turf; Tally can't be there |
| Supplier and local Instagram, Waltham Facebook groups (S18, S19) | Unverified for specific accounts | Not used (no accounts, no time) |
| Peers and the founder's manager | E31; A08 | One introduction |
| Square Community Champions | E02, E21 | Trusted by power users; not a local channel |

Trusted judgment: other owners, their bookkeeper (E16), Square itself. Micro-influencer shortlist: **none proposed** for a 6-week, 1-2 h/week class pilot; no audiences or relationships exist (user-confirmed).

## 4. Opportunity and positioning

| Hypothesis | Type | Evidence | Reach | Validation effort | Verdict |
|---|---|---|---|---|---|
| O1. Weekday/hour averages Square doesn't show | Underserved + undercommunicated | High (E02, E07-E10, E22) | High (walk-ins) | Low (15-min sit-down) | **Recommend** |
| O2. Notes next to sales + before/after | Underserved | Medium (E17-E20, E23) | Same | Low | Secondary message |
| O3. Bilingual help for Chinese-speaking owners | Distribution gap | Hypothesis | Unknown count | Low (observe counters) | Test opportunistically (X04) |
| O4. AI-averse owners who want a fixed page | Undercommunicated | Medium (E08, E25, E26) | Some | Low | Fold into O1 wording |
| O5. Online Square sellers nationally | Distribution gap | Medium (forum) | Low for us | High | Defer |

**Disconfirming evidence for O1:** owners already get it from Managerbot or Square AI; owners see the averages and shrug ("I knew that"); nobody reopens it.

**Category:** a plain-language timing report for small Square food sellers. **Alternative it replaces:** the spreadsheet or the guess. **Where competitors stay stronger:** Square's own data, labor, actions; official net totals. **Promises to avoid:** "increase sales", "AI", "profit", "used by local businesses", "100% private".

**Transformation story**

> You're writing next week's schedule from memory, because Square shows you a total for the week, not what a normal Tuesday afternoon looks like. You want to staff and prep for the days you actually have. But finding the pattern means clicking day by day or building a spreadsheet. Tally turns your Square sales into one page: your average sales for each weekday and each hour, your best and slowest stretches, and a few things to try. Nothing to type or ask, and your sales stay in your browser. Here's why you can believe it: it's read-only, it shows how many days each average uses, and it says "not enough data yet" instead of guessing. Start by looking at the sample, then your own data, in 15 minutes with me.

- **Positioning statement:** For owners of small cafes and bakeries on Square who plan staff and prep from memory, Tally is a free sales report that shows your average day and hour, without asking an AI anything. Unlike Square's reports, which show totals, Tally averages each weekday and hour across months and tells you how many days it used.
- **One-sentence value proposition:** See your average Tuesday, hour by hour, from your Square sales, with nothing to type or ask.
- **Message pillars (each with proof):**
  1. *The pattern, not the total:* weekday and hour averages over all your days (proof: show it on their data; E07 shows Square lacks it).
  2. *Nothing to ask:* a fixed page with three things to try (proof: open it; no prompt box).
  3. *Your sales stay with you:* read-only; saved in your browser (proof: privacy page, disconnect button).
- **Landing hero (proposed copy):** "Your average Tuesday, hour by hour." Subhead: "A free report from your Square sales. Nothing to type or ask. Read-only." Button: "See the sample" (secondary: "Connect Square").
- **Spoken pitch (15 seconds):** "Square shows you totals. This shows your average Tuesday, hour by hour, across all your weeks, so you can see when you actually need people. It's free, read-only, and I'll sit with you for 15 minutes."
- **Strongest objection: "Square's AI already does this."** Response: "It might, if you ask it the right question. This just shows it, every time, with how many days it's based on. If Square already gives you this, tell me; that's useful for my class too."

## 5. Hooks: three seconds, then ten

| # | Concept | Audience/channel | Before exposure | First line or visual | 3-second hook | 10-second continuation | Understood by then | Proof | Next action | Hypothesis |
|---|---|---|---|---|---|---|---|---|---|---|
| H1 | Problem recognition | Owner at the counter | Wiping down, 2:30 pm | Founder: "Quick question, not selling anything:" | "Do you know what a normal Tuesday afternoon looks like here?" | "Square shows totals. I built a free page that shows your average day and hour. Fifteen minutes, read-only." | Free, timing, read-only, short | Sample on phone | Book a time | Recognition beats "free report" (X01) |
| H2 | Demonstration | Same | Same | Phone showing the sample heatmap | "This is a cafe's average week, hour by hour." | "Yours would come straight from Square, read-only." | What it looks like | The heatmap | Book a time | Seeing beats telling |
| H3 | Visible outcome | QR card on the counter | Owner finds card later | Card headline | "Your average Tuesday, hour by hour." | "Free report from your Square sales. Nothing to type or ask." | What and how | QR to sample | Scan | Card alone rarely converts (October plan) |
| H4 | Useful insight | Owner, sit-down | Seeing own data | Start here #1 | Their own slowest stretch | "Here's one thing to try for 2 weeks, and how to check it." | Actionable | Their data | Try it | Specific advice drives return (X02) |
| H5 | Credible proof | Cautious owner | Hesitating to connect | Privacy page in their language | "Read-only. Your sales stay on your device." | "Disconnect anytime from My Data." | Safety | Privacy page | Connect | Trust removes the blocker |
| H6 | Desired capability | Owner who keeps notes | Mentions weather/events | Day Notes | "Write 'rainy' or 'promo' on a day." | "Tally compares it with similar days for you." | Notes + comparison | Card | Add a note | X03 |

**Developed into assets:** H1 → walk-in script (COLLATERAL_PLAN A02), H3 → QR card text (A01), H4 → sit-down flow (C01). Continuity: opener → sample on phone → their data → Start here → one thing to try → one-week check.

## 6. Risks to this strategy

- Managerbot/Square AI may already give owners the averages (E28). If two of three sit-down owners say so, switch the pitch to in-person help and notes (O2), or stop.
- Owners may be unreachable in 1-2 h/week. If no sit-down by Nov 23, use the manager introduction only.
- Class ends in December: say so honestly to owners ("it's a class project, so I can't promise it will keep running after December"). Don't promise anything beyond that.
