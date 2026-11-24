# A/B test: home page vs benefits landing page

Set up 2026-11-24. Status: **built and tested locally; not live until pushed.**

## What's being tested

- **A (control):** the app's current home page. Lead: "Know how your business is really doing."; next step: scroll to connect/upload, or "Try with sample data" → column screen → "Looks good, continue" (2 clicks + a screen).
- **B (variant):** `/try`, a benefits page built on the brand promise "Your average Tuesday, hour by hour. Nothing to type or ask." One button, **"See a sample report"**, opens the full sample report in one tap (no sign-up, nothing to connect, no column screen).

**Hypothesis:** leading with one specific benefit and a one-tap sample gets more first-time visitors to actually see a report than the current home page.

## Links

| Use | Link |
|---|---|
| Share this (random 50/50, remembered per browser) | `bus-idea.pages.dev/go` |
| Force A (testing only, not counted with `&notrack=1`) | `bus-idea.pages.dev/go?arm=a&notrack=1` |
| Force B (testing only) | `bus-idea.pages.dev/go?arm=b&notrack=1` |

Note: the printable card (`card.html`) points at the home page, not the split. For the test, share `/go` as a link (email, DM, post).

## How to read the result

Founder page → Live data → **Sources**: rows "link tag: lp-a" and "link tag: lp-b" (first touch).

- **Primary metric:** browsers that saw a report (sample or own) ÷ browsers in the group. On the Sources table that's (sample only + own data in) ÷ browsers.
- **Secondary:** own data in (connected Square or uploaded); clicks on `lpCtaTop` vs `lpCtaBottom` (Clicks table).
- **Guardrail:** "Recent failures" doesn't rise.

## Decision rule

With this traffic (a few to a few dozen visitors), treat any difference as direction only. Keep B if it's ahead after at least 20 browsers per group and no more failures; otherwise keep A. Never call it "statistically significant" at these sizes.

## Limits

- Browsers, not people. Visitors with Do Not Track / Global Privacy Control aren't counted. Your own devices must open `?notrack=1` first.
- Anyone who opened Tally before getting the link keeps their earlier first-touch source.
- The sample chart on `/try` uses Tally's built-in sample data (4 Tuesdays, Aug 2026), labeled as such; `tests/try-page-test.html` checks it still matches the file.
- Chinese text on `/try` is marked ZH-REVIEW and needs a fluent check.
