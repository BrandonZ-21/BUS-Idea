// Web Crypto helpers shared by the /api/square/* functions. Uses only the
// standard `crypto` global, so the same code runs in Cloudflare's runtime and
// in Node (tests/square-server.test.mjs).

const enc = new TextEncoder();
const dec = new TextDecoder();

export function bytesToBase64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function base64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function toBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return base64ToBytes(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

// URL- and cookie-safe random string (used for OAuth state and session ids).
export function randomId(byteLength = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

// Both keys in .dev.vars / Cloudflare secrets are 32 random bytes, base64.
function keyBytes(b64, name) {
  let raw;
  try {
    raw = base64ToBytes(String(b64 || "").trim());
  } catch {
    throw new ConfigError(`${name} is not valid base64`);
  }
  if (raw.length !== 32) throw new ConfigError(`${name} must be 32 bytes (base64)`);
  return raw;
}

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

// ---------- Token encryption (AES-GCM) ----------

export async function importEncryptionKey(b64) {
  return crypto.subtle.importKey("raw", keyBytes(b64, "TOKEN_ENCRYPTION_KEY"), "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Every call uses a fresh random 12-byte IV. `context` (e.g. "access:<merchant>")
// is bound in as additional data, so a ciphertext copied into another row or
// column fails to decrypt instead of quietly becoming someone else's token.
export async function encryptString(key, plaintext, context) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(context) }, key, enc.encode(plaintext));
  return { ciphertext: bytesToBase64(new Uint8Array(ct)), iv: bytesToBase64(iv) };
}

export async function decryptString(key, ciphertext, iv, context) {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv), additionalData: enc.encode(context) },
    key,
    base64ToBytes(ciphertext)
  );
  return dec.decode(pt);
}

// ---------- Signing (HMAC-SHA256) ----------

export async function importSigningKey(b64) {
  return crypto.subtle.importKey("raw", keyBytes(b64, "STATE_SIGNING_KEY"), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// "value" -> "value.signature". `value` must not contain ".".
export async function signValue(key, value) {
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return `${value}.${toBase64Url(new Uint8Array(sig))}`;
}

// Returns the original value if the signature checks out, else null.
// crypto.subtle.verify compares in constant time.
export async function verifySignedValue(key, signed) {
  const s = String(signed || "");
  const i = s.lastIndexOf(".");
  if (i < 1) return null;
  const value = s.slice(0, i);
  let sig;
  try {
    sig = fromBase64Url(s.slice(i + 1));
  } catch {
    return null;
  }
  return (await crypto.subtle.verify("HMAC", key, sig, enc.encode(value))) ? value : null;
}

// ---------- Misc ----------

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time string comparison for values that aren't HMACs.
export function safeEqual(a, b) {
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
