-- Migration 0005: browsers the founder dashboard should not count (the
-- admin's own devices). Additive only.
-- Apply with:  npm run db:migrate:local   (remote only after separate approval)
--
-- Holds only random browser ids (see usage_events.browser_id). An excluded
-- browser's past events stay in usage_events but are left out of every
-- dashboard number, and new events from it are not stored.
CREATE TABLE IF NOT EXISTS usage_excluded_browsers (
  browser_id           TEXT PRIMARY KEY,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch())
);
