// Request/response helpers for the /api/* functions: JSON replies, cookies,
// capped JSON bodies, same-origin checks, config checks and safe error logging.

export const SESSION_COOKIE = "tally_session";
export const STATE_COOKIE = "tally_oauth_state";
export const SESSION_DAYS = 30;

// Every secret the integration needs (values come from .dev.vars locally, or
// `wrangler pages secret put` when deployed).
const REQUIRED_SETTINGS = ["SQUARE_APPLICATION_ID", "SQUARE_APPLICATION_SECRET", "TOKEN_ENCRYPTION_KEY", "STATE_SIGNING_KEY"];

export const ENVIRONMENTS = ["sandbox", "production"];

// Names (never values) of settings that are missing or don't fit together.
export function missingConfig(env) {
  const missing = REQUIRED_SETTINGS.filter((k) => !String(env[k] || "").trim());
  if (!env.DB) missing.push("DB (D1 binding)");
  if (!ENVIRONMENTS.includes(env.SQUARE_ENVIRONMENT)) {
    missing.push('SQUARE_ENVIRONMENT ("sandbox" or "production")');
  } else if (env.SQUARE_APPLICATION_ID && isSandboxAppId(env.SQUARE_APPLICATION_ID) !== (env.SQUARE_ENVIRONMENT === "sandbox")) {
    // Sandbox app ids start "sandbox-"; production ones don't. Refusing a mix
    // keeps test keys off real sellers and real keys out of local testing.
    missing.push("SQUARE_APPLICATION_ID (doesn't match SQUARE_ENVIRONMENT)");
  }
  return missing;
}

function isSandboxAppId(appId) {
  return String(appId).trim().startsWith("sandbox-");
}

export function json(body, status = 200, headers) {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json; charset=utf-8");
  h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: h });
}

// 302 to a path on this same site, setting any cookies given.
export function redirectHome(request, pathAndQuery, cookies = []) {
  const h = new Headers({ Location: new URL(pathAndQuery, request.url).toString(), "Cache-Control": "no-store" });
  cookies.forEach((c) => h.append("Set-Cookie", c));
  return new Response(null, { status: 302, headers: h });
}

export function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // ignore a malformed cookie rather than failing the request
    }
  }
  return out;
}

// HttpOnly so page scripts can't read it; SameSite=Lax so it still arrives on
// Square's redirect back to /callback (a top-level GET) but not on cross-site
// POSTs. Secure whenever the site is served over https.
export function cookie(request, name, value, { path, maxAge }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (new URL(request.url).protocol === "https:") parts.push("Secure");
  return parts.join("; ");
}

// Path=/api so the account and saved-report endpoints see the session too.
export function sessionCookie(request, sessionId) {
  return cookie(request, SESSION_COOKIE, sessionId, { path: "/api", maxAge: SESSION_DAYS * 86400 });
}

// Set-Cookie values that sign this browser out. Also clears the older
// Path=/api/square cookie that earlier versions set.
export function clearSessionCookies(request) {
  return ["/api", "/api/square"].map((path) => cookie(request, SESSION_COOKIE, "", { path, maxAge: 0 }));
}

// [["Set-Cookie", ...], ...] for passing several cookies to json()/Headers.
export function setCookieHeaders(cookies) {
  return cookies.map((c) => ["Set-Cookie", c]);
}

// Reads a JSON request body, stopping as soon as it passes maxBytes so an
// oversized upload is never held in memory. Returns { ok, value } or
// { ok: false, status, error }.
export async function readJsonBody(request, maxBytes) {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return { ok: false, status: 415, error: "json_required" };
  }
  const declared = Number(request.headers.get("Content-Length"));
  if (declared > maxBytes) return { ok: false, status: 413, error: "too_large" };
  if (!request.body) return { ok: false, status: 400, error: "bad_json" };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, status: 413, error: "too_large" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, status: 400, error: "bad_json" };
  }
}

// State-changing endpoints (sync, disconnect) only accept POSTs sent by this
// site's own pages. Browsers always send Origin on POST.
export function isSameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

// For console.error: describes a failure without ever including tokens,
// secrets or request bodies.
export function describeError(err) {
  if (!err) return "unknown error";
  if (err.name === "SquareError") return `Square API ${err.status} ${err.code || ""}`.trim();
  if (err.name === "ConfigError") return `config: ${err.message}`;
  return err.name || "Error";
}
