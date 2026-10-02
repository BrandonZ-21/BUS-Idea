// D1 access for the Square integration and the accounts built on it (a
// Square sign-in IS the Tally account). Tokens are encrypted before they are
// written and only decrypted in memory for the request that needs them.
// Session ids are stored only as SHA-256 hashes.

import { encryptString, decryptString, randomId, sha256Hex } from "./crypto.js";
import { parseCookies, SESSION_COOKIE, SESSION_DAYS } from "./http.js";

const now = () => Math.floor(Date.now() / 1000);

// token: the response from Square's /oauth2/token.
export async function saveConnection(db, encKey, token, { scopes, businessName }) {
  const merchantId = token.merchant_id;
  const access = await encryptString(encKey, token.access_token, `access:${merchantId}`);
  const refresh = token.refresh_token ? await encryptString(encKey, token.refresh_token, `refresh:${merchantId}`) : null;
  // Re-connecting keeps the existing sync position.
  await db
    .prepare(
      `INSERT INTO connections (merchant_id, access_token_enc, access_token_iv, refresh_token_enc, refresh_token_iv,
                                expires_at, scopes, business_name, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(merchant_id) DO UPDATE SET
         access_token_enc = excluded.access_token_enc, access_token_iv = excluded.access_token_iv,
         refresh_token_enc = excluded.refresh_token_enc, refresh_token_iv = excluded.refresh_token_iv,
         expires_at = excluded.expires_at, scopes = excluded.scopes,
         business_name = excluded.business_name, updated_at = excluded.updated_at`
    )
    .bind(
      merchantId,
      access.ciphertext,
      access.iv,
      refresh ? refresh.ciphertext : null,
      refresh ? refresh.iv : null,
      toEpoch(token.expires_at),
      scopes.join(" "),
      businessName || null,
      now()
    )
    .run();
}

export async function updateAccessToken(db, encKey, merchantId, token) {
  const access = await encryptString(encKey, token.access_token, `access:${merchantId}`);
  await db
    .prepare("UPDATE connections SET access_token_enc = ?1, access_token_iv = ?2, expires_at = ?3, updated_at = ?4 WHERE merchant_id = ?5")
    .bind(access.ciphertext, access.iv, toEpoch(token.expires_at), now(), merchantId)
    .run();
}

// Row without tokens (safe for status).
export function getConnectionInfo(db, merchantId) {
  return db
    .prepare("SELECT merchant_id, business_name, expires_at, sync_cursor, last_synced_at FROM connections WHERE merchant_id = ?1")
    .bind(merchantId)
    .first();
}

// Row plus decrypted tokens, or null.
export async function loadConnection(db, encKey, merchantId) {
  const row = await db.prepare("SELECT * FROM connections WHERE merchant_id = ?1").bind(merchantId).first();
  if (!row) return null;
  return {
    merchantId,
    businessName: row.business_name,
    expiresAt: row.expires_at,
    syncCursor: row.sync_cursor,
    accessToken: await decryptString(encKey, row.access_token_enc, row.access_token_iv, `access:${merchantId}`),
    refreshToken: row.refresh_token_enc
      ? await decryptString(encKey, row.refresh_token_enc, row.refresh_token_iv, `refresh:${merchantId}`)
      : null,
  };
}

export async function finishSync(db, merchantId, syncedThroughIso) {
  await db
    .prepare("UPDATE connections SET sync_cursor = ?1, last_synced_at = ?2, updated_at = ?2 WHERE merchant_id = ?3")
    .bind(syncedThroughIso, now(), merchantId)
    .run();
}

// "Disconnect Square & delete my account": tokens, sessions, saved reports
// and the account row, in one batch (D1 runs a batch as one transaction).
export async function deleteMerchant(db, merchantId) {
  await db.batch([
    db.prepare("DELETE FROM saved_reports WHERE merchant_id = ?1").bind(merchantId),
    db.prepare("DELETE FROM sessions WHERE merchant_id = ?1").bind(merchantId),
    db.prepare("DELETE FROM connections WHERE merchant_id = ?1").bind(merchantId),
    db.prepare("DELETE FROM accounts WHERE merchant_id = ?1").bind(merchantId),
  ]);
}

// ---------- Accounts ----------

// Every new account is an ordinary user. Never changes an existing role --
// roles are only changed by the owner with scripts/set-role.mjs.
export async function ensureAccount(db, merchantId) {
  await db.prepare("INSERT INTO accounts (merchant_id) VALUES (?1) ON CONFLICT(merchant_id) DO NOTHING").bind(merchantId).run();
}

// Current role from the database (never from the request or the cookie).
export async function getRole(db, merchantId) {
  const row = await db.prepare("SELECT role FROM accounts WHERE merchant_id = ?1").bind(merchantId).first();
  return row ? row.role : null;
}

// ---------- Sessions ----------

// Returns the raw session id for the cookie; only its hash is stored.
export async function createSession(db, merchantId) {
  const sessionId = randomId(32);
  await db
    .prepare("INSERT INTO sessions (session_id_hash, merchant_id, expires_at) VALUES (?1, ?2, ?3)")
    .bind(await sha256Hex(sessionId), merchantId, now() + SESSION_DAYS * 86400)
    .run();
  return sessionId;
}

// The merchant id this browser's session cookie belongs to, or null.
export async function findSession(db, request) {
  const sessionId = parseCookies(request)[SESSION_COOKIE];
  if (!sessionId) return null;
  await db.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(now()).run();
  const row = await db
    .prepare("SELECT merchant_id FROM sessions WHERE session_id_hash = ?1")
    .bind(await sha256Hex(sessionId))
    .first();
  return row ? { merchantId: row.merchant_id } : null;
}

export async function deleteSession(db, request) {
  const sessionId = parseCookies(request)[SESSION_COOKIE];
  if (!sessionId) return;
  await db.prepare("DELETE FROM sessions WHERE session_id_hash = ?1").bind(await sha256Hex(sessionId)).run();
}

function toEpoch(iso) {
  const ms = Date.parse(iso);
  // Square documents 30-day access tokens; assume that if the date is missing.
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : now() + 30 * 86400;
}
