-- Migration 0006: more detail on anonymous usage steps for the founder
-- dashboard. Additive only: existing rows keep NULL in the new columns.
-- Apply with:  npm run db:migrate:local   (remote only after separate approval,
-- and BEFORE pushing the code that writes these columns).
--
-- Every value is allow-listed or shape-checked in lib/usage/events.js:
--   detail    which page was opened ('items'), or which button was clicked,
--             named by the code ('langToggleBtn') -- never text the user typed
--   ref_host  the site that linked here, host name only ('reddit.com'), on visits
--   ref_tag   a campaign tag from the link (?ref=reddit), on visits
--   country   two-letter country from Cloudflare (the IP itself is not stored), on visits
--   device    'mobile' | 'tablet' | 'desktop', on visits
ALTER TABLE usage_events ADD COLUMN detail TEXT;
ALTER TABLE usage_events ADD COLUMN ref_host TEXT;
ALTER TABLE usage_events ADD COLUMN ref_tag TEXT;
ALTER TABLE usage_events ADD COLUMN country TEXT;
ALTER TABLE usage_events ADD COLUMN device TEXT;
