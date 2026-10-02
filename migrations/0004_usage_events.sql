-- Migration 0004: anonymous usage steps for the founder dashboard.
-- Additive only. Apply with:  npm run db:migrate:local   (remote only after separate approval)
--
-- One row per step a browser took ("upload_started", "upload_failed"...).
-- Never sales data, item names, amounts, file contents, IP addresses or
-- browser details. browser_id is a random value made by the browser (not a
-- fingerprint); deleting the app's data on that device makes a new one.
-- Events are only stored when USAGE_EVENTS = "on" for that environment.
CREATE TABLE IF NOT EXISTS usage_events (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  at                   INTEGER NOT NULL DEFAULT (unixepoch()),
  day                  TEXT NOT NULL,               -- YYYY-MM-DD (UTC), for the per-browser daily cap
  browser_id           TEXT NOT NULL,               -- 22 random url-safe characters
  event                TEXT NOT NULL,               -- allow-listed in lib/usage/events.js
  reason               TEXT,                        -- allow-listed failure code, e.g. 'bad_date'
  source               TEXT                         -- 'own' | 'sample' | 'square' | 'unknown'
);

CREATE INDEX IF NOT EXISTS idx_usage_events_at ON usage_events(at);
CREATE INDEX IF NOT EXISTS idx_usage_events_browser_day ON usage_events(browser_id, day);
