# Tally product improvements

Aimed at the path: connect Square or upload a file → visualizations → specific suggestions → comparison with outside data.

Ranked by value to owners. Effort is a rough estimate for you working with help, including testing. None of this is built or started.

| # | Improvement | Step it helps | Value to owners | Effort |
|---|---|---|---|---|
| 1 | **Make Square totals match Square.** Subtract discounts and refunds so the total is net sales, and say which number it is. | Connect → visualizations | Highest. An owner who sees a total that disagrees with their Dashboard stops trusting every chart after it. | 6 to 10 h |
| 2 | **Stop sync and upload from double-counting.** When new data overlaps dates already saved from the other source, warn and offer "replace those dates". | Connect or upload | High. Prevents silently doubled sales, which today can only be undone with "Delete all my data". | 3 to 5 h |
| 3 | **Lead with Connect Square and three suggestions.** Put Connect Square in the landing hero and steps, and open the first report on the three most specific suggestions. Move weather out of the top feature cards. | Connect → suggestions | High. It is what your one outside user valued, and it is cheap. | 2 to 3 h |
| 4 | **Local calendar presets.** One click adds Brandeis term dates, breaks, move-in and commencement, plus a few Waltham events, as custom holidays. Entered by hand from public calendars. | Outside data | Medium to high, if owners confirm students drive their traffic. This is outside context you can do better locally than a general assistant. Test the idea in interviews first. | 2 to 3 h, plus a yearly update |
| 5 | **Item-name merging.** Let an owner group several item names into one ("Latte 12oz" and "Lg Latte"), saved in their browser. | Visualizations → suggestions | Medium to high, unproven. Ask interview question 5 before building. | 5 to 8 h |
| 6 | **Fix the menu chart, then add optional costs.** First make it use split item rows and the date range (READINESS_CHECKLIST.md #4). Later, let owners type a cost for their top 10 items so the chart uses profit, not price. | Suggestions | Medium. The fix is needed for uploaded Square files. The cost entry only pays off if owners will type costs. | 1 to 2 h for the fix; 4 to 6 h for costs |
| 7 | **Chinese Privacy page.** | Connect (trust) | Medium for that segment, and it makes "bilingual" true. | 1 to 2 h plus a fluent review |

## Notes on the hard one (#1)

- The browser de-duplicates synced orders by fingerprint, and the price is part of the fingerprint (`public/js/parser.js:285`; see the warning at `lib/square/orders.js:6-7`). Changing how price is calculated means every already-synced row looks new on the next sync, which would double everything. De-duplicating Square rows by order ID and line, not by price, has to come first.
- How Square reports refunds and returns in the Orders API needs checking against Square's documentation before writing code. I have not verified the response shape.
- Until this ships, the label "Gross sales, before discounts and refunds" is the honest stopgap.

## Deliberately left off

- **An AI chat.** Square and Toast already have one. It would also cost money and weaken the privacy story.
- **Location filter, promo before/after, editable rows.** Real gaps, but no user has asked yet.
- **More weather.** Your one user found it not useful. Wait for a second opinion.

## Suggested order for the next two weeks

Only the labels from READINESS_CHECKLIST.md (#1 to #3) and item 3 above. Let the interviews decide between 4, 5 and 6.
