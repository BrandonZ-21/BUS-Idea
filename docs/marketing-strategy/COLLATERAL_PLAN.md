# Collateral and human-engagement plan

Run date 2026-11-02. Inventory: [data/collateral.csv](data/collateral.csv). Voice: [BRAND_VOICE.md](BRAND_VOICE.md). Nothing here has been printed, sent or posted.

## Funnel-to-collateral matrix

| Broad stage | Customer progress | Collateral and human contributions (IDs) | Next step |
|---|---|---|---|
| Awareness | Recognize "I don't know my average Tuesday" | Walk-in opener A02, QR card A01, manager introduction A08, emails A06 (optional) | Agree to a 15-minute sit-down, or scan |
| Consideration and conversion | See it, trust it, connect | Sit-down C01, sample report A07, website A03, privacy page EN/ZH A04 | See own data (`report_viewed`, own) |
| Retention and advocacy | Reopen, try one thing, tell one owner | One-week follow-up C02, Start-here cards (in app), feedback form A05 | Spontaneous return; one introduction |

No payment stage: Tally is free and class-only (user-confirmed).

## Inventory summary

| Status | Items |
|---|---|
| Existing and live | A03 website, A04 privacy page (EN/ZH; Chinese pending fluent review), A05 feedback form, A07 sample report |
| Existing, not yet used | A01 QR card (needs a `?ref=` tag, T01), A02 walk-in script (EN/ZH), A06 email drafts |
| Proposed | C01 sit-down flow (sequenced below), C02 one-week follow-up, A08 manager introduction, opener variant A |
| Not proposed | Ads, videos, social accounts, flyers beyond the card, events, influencers (no budget, accounts or time) |

Recommendation per item: **keep** A03, A04, A05, A07 · **update** A01 (ref tag; headline "Your average Tuesday, hour by hour") and A02 (opener A) · **create** C01, C02, A08 · **hold** A06 (use only for shops with a public email).

## Human-time budget (6 weeks, 1-2 h/week = about 6-12 hours total)

| Activity | One-time | Recurring | Total estimate |
|---|---|---|---|
| T01 ref tag + print 10 cards | 30 min | — | 0.5 h |
| Rehearse A02 + C01 with sample | 30 min | — | 0.5 h |
| Walk-in rounds (4-5 stops each) | — | ~1 h per round × 3 | 3 h |
| Sit-downs incl. notes | — | ~30 min × 3 | 1.5 h |
| 48-72 h recall checks + one-week follow-ups | — | ~15 min × 3 | 0.75 h |
| Weekly review (scorecard, triage, listening) | — | 20-30 min × 6 | 2-3 h |
| **Total** | 1 h | | **about 9-10 h** |

This fits 1.5 h/week on average. If a week has only 1 hour, skip listening (X05) first, then the walk-in round, never the follow-ups of owners already met.

## Encounter briefs

### Awareness: A02 walk-in opener with A01 card

1. **Audience and situation:** owner or manager of an independent cafe/bakery on Square, behind the counter at a quiet moment; doesn't know Tally (awareness).
2. **Meeting point:** counters on Moody St and Main St, Waltham, weekdays 2-4 pm. Specific shops: choose on the day by checking for a Square reader; the October tracking log names three candidates (caffe ollo, Peipei's Bakery, Banh Mi Oi), Square at register **unverified**.
3. **Format:** 30 seconds spoken; card handed over (US Letter, folded, or printed half-size).
4. **Presentation:** the founder, alone, student ID visible; laptop or phone with the sample report open. If there's a line, leave the card and go.
5. **Opening (opener A, the hook):** "Hi, I'm Brandon, a Brandeis student. Quick question, not selling anything: do you know what a normal Tuesday afternoon looks like here?" **Next seven seconds:** "Square shows you totals. I built a free page that shows your average day and hour, across all your weeks. It's read-only, and it's my class project, not Square." **Opener B (comparison):** the October script ([marketing/OUTREACH_KIT.md](../../marketing/OUTREACH_KIT.md), "30-second walk-in script").
   - Chinese (opener A, *needs fluent review before use*): "您好，我叫 Brandon，是 Brandeis 的学生。我不是来推销的，想问一下：您知道店里平常星期二下午大概是什么样吗？Square 显示的是总数，我做了一个免费的网页，可以看到每天、每个小时的平均销售。只读权限，是我的课程项目，和 Square 没有关系。"
6. **Our offer:** a look at a sample heatmap now; their own averages in a 15-minute sit-down.
7. **Their contribution:** 30 seconds of attention; optionally a time to come back.
8. **Exchange timing:** they see the sample before being asked for anything. The card is theirs regardless.
9. **Content:** script above; card headline "Your average Tuesday, hour by hour" + existing card text ([public/card.html](../../public/card.html)).
10. **Next step:** "Is there a quiet 15 minutes this week I could come back and show you yours?" Write the time on the card.
11. **Fulfillment:** the founder returns at the booked time. Capacity: at most 2 sit-downs a week; if more say yes, book the following week.
12. **Measurement:** tracking log (spoken to, yes/no, opener A/B); `visit.refTag` = `walkin-a`/`walkin-b`/`card-<street>`.

### Consideration and conversion: C01 15-minute sit-down

1. **Audience:** an owner who said yes at the counter.
2. **Meeting point:** their shop, booked off-peak time.
3. **Format:** 15 minutes, their own phone or laptop (so the Founder page can see the return later).
4. **Presentation:** founder sits beside them; owner holds the device.
5. **Opening:** "Thanks for the time. Two things first: it's read-only, and the totals are gross sales, before discounts and refunds, so they'll read a bit higher than Square's net."
6. **Offer:** their weekday and hour averages, Start-here suggestions, explained in English or Chinese.
7. **Their contribution:** 15 minutes; connecting Square (or uploading an export, or just the sample); honest reactions.
8. **Exchange timing:** sample first (0-3 min), decide to connect (3-5), their report (5-12), questions (12-15). Connecting is optional; the sample alone is a valid session.
9. **Script:**
   - 0-3 min: "Here's a sample cafe. Each square is one hour of one weekday; darker is busier on average."
   - 3-5: "Want to see yours? Connect Square read-only, or skip it. Either is fine." Show the Privacy page in their language if they hesitate.
   - 5-12: Open "Start here". Ask: "Which of these did you already know? Which surprised you?" Show "Did my change work?" if they mention a change (X03).
   - 12-15: FEEDBACK_SYSTEM.md questions 1, 2 and 4. Close: "I'll check back in a week to see if you opened it again. Is that okay?"
   - Before they connect: "Since only a few people are testing, I can see anonymous counts like 'connected Square', not your sales."
10. **Next step:** bookmark Tally on their device; optional feedback form.
11. **Fulfillment:** founder only; max 2 a week. If connecting fails, use sample + the failure note (Founder page "Recent failures").
12. **Measurement:** `sit_down_completed` (log), `report_viewed` (own), what they said they didn't know, `rec_useful`.

### Retention and advocacy: C02 one-week follow-up

1. **Audience:** sit-down owners, 7 days later.
2. **Meeting point:** a 5-minute stop at their shop, or a reply to their email if they gave one.
3. **Format:** 5 minutes.
4. **Presentation:** founder.
5. **Opening:** "Quick check from last week: did you open Tally again?" (Check the Founder page *before* asking, so the answer is recorded as spontaneous or not.)
6. **Offer:** answer any question; show one new card if their data has a new week.
7. **Their contribution:** 5 minutes; optionally one introduction.
8. **Exchange timing:** introduction asked **only** if they said it was useful.
9. **Script:** "What did you look at? Did you try the suggestion? What would make it worth opening weekly?" If useful: "Is there one other owner you think would want to see theirs?"
10. **Next step:** introduction → new A02/C01 cycle with `?ref=referral`.
11. **Fulfillment:** founder.
12. **Measurement:** spontaneous return (yes/no, from Founder page), stated reason, introduction made.

## Pathways

1. **Walk-in pathway:** A02 opener (founder, CTA: book 15 min) → C01 sit-down (founder, CTA: connect read-only; event `report_viewed`) → C02 follow-up (founder; observe return) → introduction (`?ref=referral`) → new A02.
2. **Card-only pathway:** A01 left with staff → owner scans later (`card-<street>`) → A07 sample → A03 connect (`square_connected`) → A05 feedback form. *Dead end risk:* nobody to explain gross vs net; mitigated by the dashboard label.
3. **Manager pathway:** A08 the manager introduces one owner → C01 sit-down (`manager-intro`) → C02.

Gaps found: the card has no `?ref=` tag (T01) and no heatmap image; no reminder mechanism for repeat use (T04, only if X02 suggests it); the feedback form lacks a source question (A05 update).

## Production backlog (in order)

1. T01: add `?ref=` to card.html QR + new headline (0.5 h).
2. Print 10 cards (school printer).
3. Rehearse opener A and the sit-down with the sample (0.5 h).
4. Ask the manager for one introduction (A08) (10 min).
5. Add "How did you hear about Tally?" to the Google Form (10 min).
6. First walk-in round (1 h).

## Maintenance

Owner: founder. Review dates in [data/collateral.csv](data/collateral.csv). Before each walk-in round: check the card's link still opens, the Privacy page still matches the app, and nothing claims a feature that isn't live (e.g., the BLS price card). Retire everything at the end of the class unless the founder decides otherwise.
