-- Migration 0001: tables for the read-only Square OAuth integration.
-- Apply with:  npm run db:migrate:local   (or db:migrate:remote before a real deploy)
--
-- Times are Unix epoch SECONDS (INTEGER) so they compare cheaply.
-- Tokens are never stored in plain text: each is AES-GCM encrypted with
-- TOKEN_ENCRYPTION_KEY, base64-encoded, and gets its OWN random 12-byte IV
-- (reusing an IV with the same key breaks AES-GCM).

-- One row per connected Square seller (merchant).
CREATE TABLE IF NOT EXISTS connections (
  merchant_id          TEXT PRIMARY KEY,            -- Square merchant ID from the token response
  access_token_enc     TEXT NOT NULL,               -- base64 AES-GCM ciphertext of the access token
  access_token_iv      TEXT NOT NULL,               -- base64 IV used for access_token_enc
  refresh_token_enc    TEXT,                        -- base64 AES-GCM ciphertext of the refresh token
  refresh_token_iv     TEXT,                        -- base64 IV used for refresh_token_enc
  expires_at           INTEGER NOT NULL,            -- when the access token expires
  scopes               TEXT,                        -- space-separated scopes granted (all *_READ)
  sync_cursor          TEXT,                        -- where the next sync resumes (e.g. last payment time / API cursor)
  last_synced_at       INTEGER,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at           INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Browser sessions. Only the SHA-256 hash of the session id is stored, so a
-- leaked database can't be used to impersonate a logged-in browser.
CREATE TABLE IF NOT EXISTS sessions (
  session_id_hash      TEXT PRIMARY KEY,            -- hex SHA-256 of the random session id in the cookie
  merchant_id          TEXT NOT NULL REFERENCES connections(merchant_id) ON DELETE CASCADE,
  expires_at           INTEGER NOT NULL,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_merchant ON sessions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires  ON sessions(expires_at);
