// Request/response helpers for the /api/square/* functions: JSON replies,
// cookies, same-origin checks, config checks and safe error logging.

export const SESSION_COOKIE = "tally_session";
export const STATE_COOKIE = "tally_oauth_state";
export const SESSION_DAYS = 30;

// Every secret the integration needs (values come from .dev.vars locally, or
// `wrangler pages secret put` when deployed).
const REQUIRED_SETTINGS = ["SQUARE_APPLICATION_ID", "SQUARE_APPLICATION_SECRET", "TOKEN_ENCRYPTION_KEY", "STATE_SIGNING_KEY"];

// Names (never values) of settings that are missing or not allowed yet.
export function missingConfig(env) {
  const missing = REQUIRED_SETTINGS.filter((k) => !String(env[k] || "").trim());
  if (!env.DB) missing.push("DB (D1 binding)");
  // Sandbox only for now -- production needs a review first (see SETUP.md).
  if (env.SQUARE_ENVIRONMENT !== "sandbox") missing.push('SQUARE_ENVIRONMENT="sandbox"');
  return missing;
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

export function sessionCookie(request, sessionId) {
  return cookie(request, SESSION_COOKIE, sessionId, { path: "/api/square", maxAge: SESSION_DAYS * 86400 });
}

export function clearSessionCookie(request) {
  return cookie(request, SESSION_COOKIE, "", { path: "/api/square", maxAge: 0 });
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
