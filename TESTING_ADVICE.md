# Testing the advice upgrade locally

Nothing here touches the live site or real Square accounts.

## 1. Automatic tests

**Server code** (PowerShell, in the project folder):

```bash
npm.cmd test
```

Expect `pass 47, fail 0`. Includes `tests/outside-unit.test.mjs`: BLS parsing, a failing source keeping its last value and backing off, stale values hidden, the off switch, `/api/outside` never erroring, the new usage events, Square location rounding.

**Browser tests:** in Claude's preview or any browser, start the local server (launch config `cafe-insights`, which runs `scripts/serve.ps1`) and open:

- `http://localhost:8080/tests/advice-test.html`: the new rules (68 checks): too little data, items bought together, channel fees entered and not entered, a promo with and without comparison days, price change, concentration, returning customers, break-even, weather ahead, school dates ahead, prices vs BLS, a failed/stale/switched-off outside source, every number in the wording, Chinese display, Ideas library rules.
- `http://localhost:8080/tests/insights-test.html` (76), `week-compare-test.html` (33), and the other pages in `tests/`.

Each page ends with "All N checks passed."

## 2. Manual test script (about 15 minutes)

Use `http://localhost:8080` (no server features) unless a step says otherwise.

| # | What to do | What you should see |
|---|---|---|
| 1 | My Data → Delete all my data. Home → "Try with sample data" → Looks good, continue. | Dashboard. **Start here** box with 3 numbered items: a bold thing to try, a grey reason, "See why". No error messages anywhere (the 404s in the browser console are expected: this server has no backend). |
| 2 | **Too little data:** Delete all data. Upload a file with under 2 weeks of sales (e.g. cut `public/sample-data.csv` to its first 100 lines). | No Start here box. "Not enough data yet" lists what each card needs ("needs 14 days with sales; you have 5"). Nothing guesses. |
| 3 | Delete all data. Upload `tests/fixtures/square-style-sample.csv` (made-up Square export) → continue. | Cards include **Price change check** (Latte (Oat) $5.00 → $5.50 around Sep 1, 2026), **Sales by channel**, **Where your sales come from**, **Refunds**. "About these numbers" says refunds in the file are subtracted. |
| 4 | Open **Sales by channel** → under "Add your fees..." leave everything empty. | "What we saw" lists sales only; "Why it matters" says sales aren't what you keep. |
| 5 | Type 25 for Delivery → Save fees. | Banner "Saved on this device." The card now says how much you keep for Delivery (75% of its sales), labeled an estimate. Clear removes it. |
| 6 | **Promo with comparison days:** Day Notes → add a note on Sep 12, 2026, tag Promo, end date Sep 18, text "Back-to-school deal". Back to the dashboard. | **Did my change work?** card: % difference, days compared (before and after), "This is a comparison, not proof." Confidence Medium or Low, never High. |
| 7 | **Promo without comparison days:** add a promo note on a date outside the data (e.g. Jan 5, 2027). Delete the Sep note. | Card gone; "Not enough data yet" says it needs 4 similar days. |
| 8 | Open any card → press Yes under "Was this useful?". | "Thanks..." replaces the buttons; reload: still answered. |
| 9 | **Chinese:** press 中文. | Every card, Start here, inputs and the "not enough" list are in Chinese; channel names (堂食, 外送, 自取) translated. Footer "隐私说明" opens the Chinese Privacy page. |
| 10 | **Phone:** browser dev tools → phone size (375 px). | No sideways scrolling; chart bars stack under their labels; inputs fit. |
| 11 | **Weather one tap:** with weather off, scroll below the advice. | "Weather tips" card explaining what's sent. Without a Square location it links to My Data, which shows the city/ZIP box with the one-sentence reason. |
| 12 | **Outside data with the server:** stop nothing; run `npm.cmd run db:migrate:local`, then the Worker test below, then start launch config `pages-dev` (port 8788) and open `http://localhost:8788/api/outside`. | JSON with `bls_cpi` (U.S. and Boston 12-month change). In the app, a Latte price-change card shows a "For context: restaurant prices across the U.S. rose ..." line and a "Uses outside data" source line. |
| 13 | **Outside source failing/stale:** in a terminal: `npx.cmd wrangler d1 execute counter-db --local --command "UPDATE outside_data SET value_json = replace(value_json, '2026-09', '2026-01')"`, reload `/api/outside` after an hour or restart pages-dev. | `sources` is empty; the market lines and card disappear; no error shown to owners. |
| 14 | **Founder page** (needs admin sign-in through the Square Sandbox on pages-dev): `#/founder` → Live data. | "Advice cards: shown and useful?", "Outside data health" with the on/off button, "Free-tier health" gauges, "Monthly review" listing the 8 placeholder ideas. |

### Running the scheduled job locally (step 12)

```bash
node node_modules/wrangler/bin/wrangler.js dev --config workers/outside-data/wrangler.jsonc --test-scheduled --persist-to .wrangler/state --port 8799
```

Then, in a second terminal (this makes ONE real request to api.bls.gov):

```bash
curl "http://127.0.0.1:8799/__scheduled?cron=17+*/6+*+*+*"
```

Check the result:

```bash
npx.cmd wrangler d1 execute counter-db --local --command "SELECT source_id, as_of, fail_count, last_error FROM outside_data; SELECT * FROM outside_runs"
```

Run the curl twice: the second run should note `nothing_due` and make 0 outside requests.
