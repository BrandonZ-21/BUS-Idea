-- Migration 0007: a tiny cache of outside data (public statistics), filled by
-- the scheduled Worker in workers/outside-data/ and read by /api/outside.
-- Additive only. Apply with:  npm run db:migrate:local   (remote only after
-- separate approval, BEFORE deploying the Worker or pushing code that reads it).
--
-- Nothing here is about any owner: no sales, no merchant ids, no locations.
-- A handful of rows in total.

-- One row per outside source (e.g. 'bls_cpi'): the last GOOD value, kept
-- even when later fetches fail.
CREATE TABLE IF NOT EXISTS outside_data (
  source_id        TEXT PRIMARY KEY,            -- 'bls_cpi'
  value_json       TEXT,                        -- the last good value, JSON
  as_of            TEXT,                        -- the period the value describes, e.g. '2026-09'
  last_success_at  INTEGER,                     -- unix seconds of the last good fetch
  last_attempt_at  INTEGER,                     -- unix seconds of the last try, good or bad
  fail_count       INTEGER NOT NULL DEFAULT 0,  -- failures in a row since the last success
  next_retry_at    INTEGER,                     -- don't try again before this (backoff)
  last_error       TEXT                         -- short code, e.g. 'http_503', 'bad_shape' (never a key)
);

-- One row per scheduled run (pruned to the last 200), for the Founder page.
CREATE TABLE IF NOT EXISTS outside_runs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  at                 INTEGER NOT NULL,          -- unix seconds
  ok                 INTEGER NOT NULL,          -- 1 = no source failed
  skipped            TEXT,                      -- 'switched_off' when the switch is off
  outbound_requests  INTEGER NOT NULL DEFAULT 0,
  rows_written       INTEGER NOT NULL DEFAULT 0,
  duration_ms        INTEGER NOT NULL DEFAULT 0,
  note               TEXT                       -- short codes only
);
CREATE INDEX IF NOT EXISTS idx_outside_runs_at ON outside_runs(at);

-- Site-wide switches the admin can flip from the Founder page, no deploy.
--   outside_data = 'on' | 'off'
CREATE TABLE IF NOT EXISTS app_switches (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
