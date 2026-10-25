// POST /api/events -- one anonymous usage step from this site's own pages.
//
//   body: { browserId, event, reason?, source?, detail?, refHost?, refTag?, device? }
//         (all allow-listed or shape-checked in lib/usage/events.js)
//   -> 202 { collecting: true, stored }   or   200 { collecting: false }
//
// Stores nothing unless USAGE_EVENTS is "on" for this environment, so
// counting starts only when it is deliberately switched on. No cookies are
// read; the IP address is never stored (only Cloudflare's country code, on visits).

import { describeError, isSameOrigin, json, readJsonBody } from "../../lib/square/http.js";
import { MAX_EVENT_BYTES, insertEvent, validateEvent } from "../../lib/usage/events.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "bad_origin" }, 403);
  if (env.USAGE_EVENTS !== "on" || !env.DB) return json({ collecting: false });
  try {
    const body = await readJsonBody(request, MAX_EVENT_BYTES);
    if (!body.ok) return json({ error: body.error }, body.status);
    const checked = validateEvent(body.value);
    if (!checked.ok) return json({ error: "invalid_event", field: checked.field }, 400);
    // Cloudflare works out a two-letter country for every request; only that
    // code is kept (on visits), never the IP address.
    const country = request.cf && request.cf.country;
    const stored = await insertEvent(env.DB, checked.value, Date.now(), country);
    return json({ collecting: true, stored }, 202);
  } catch (err) {
    console.error("usage event failed:", describeError(err));
    return json({ error: "server_error" }, 500);
  }
}
