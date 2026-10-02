-- Migration 0003: accounts (a Square sign-in is the Tally account), opt-in
-- saved report summaries, and an audit log for role changes.
-- Additive only: no existing table or row is changed.
-- Apply with:  npm run db:migrate:local   (remote only after separate approval)

-- One row per signed-in seller. The role is set by the server, never by a
-- request: every account starts as 'user'; 'admin' is granted only with
-- scripts/set-role.mjs by the owner.
CREATE TABLE IF NOT EXISTS accounts (
  merchant_id          TEXT PRIMARY KEY,
  role                 TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at           INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Sellers already connected before this migration become ordinary users.
INSERT OR IGNORE INTO accounts (merchant_id) SELECT merchant_id FROM connections;

-- Report summaries an owner chose to save ("Save to my account"). Only
-- aggregates (totals, weekday/hour averages, top items, insight text) --
-- never individual sales rows or customer data. The server validates and
-- re-builds summary_json from an allow-list before storing it.
CREATE TABLE IF NOT EXISTS saved_reports (
  id                   TEXT PRIMARY KEY,            -- random, made by the server
  merchant_id          TEXT NOT NULL REFERENCES accounts(merchant_id) ON DELETE CASCADE,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  source               TEXT NOT NULL CHECK (source IN ('csv', 'square', 'mixed')),
  period_start         TEXT NOT NULL,               -- YYYY-MM-DD
  period_end           TEXT NOT NULL,               -- YYYY-MM-DD
  summary_json         TEXT NOT NULL CHECK (length(summary_json) <= 65536)
);

-- Lists are always "my reports, newest first".
CREATE INDEX IF NOT EXISTS idx_saved_reports_owner ON saved_reports(merchant_id, created_at DESC);

-- Privileged changes only (role changes). No secrets, no sales data.
CREATE TABLE IF NOT EXISTS audit_log (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  at                   INTEGER NOT NULL DEFAULT (unixepoch()),
  actor                TEXT NOT NULL,               -- 'owner-cli' for scripts/set-role.mjs
  action               TEXT NOT NULL,               -- e.g. 'role_change'
  subject              TEXT,                        -- merchant id affected
  detail               TEXT                         -- e.g. 'user->admin'
);
