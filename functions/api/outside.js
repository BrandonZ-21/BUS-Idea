// GET /api/outside -- the cached outside data owners may see.
//
// Public, read-only, and the same for everyone: it takes no input and the
// request carries nothing about the owner (the browser calls it without
// cookies). Only FRESH values are returned; stale or failed sources are left
// out so their cards just don't appear. Any problem returns an empty answer,
// never an error page.
//
//   { enabled: true|false, sources: { bls_cpi?: { value, asOf, lastSuccessAt, name, link, license } } }
//
// Cached at Cloudflare's edge for an hour and in the browser for 12 hours
// (public/js/outside-data.js), so it costs about one D1 read per hour per
// data center -- never one per page view.

import { SOURCES } from "../../lib/outside/config.js";
import { describeSource, outsideDataOn, readSources } from "../../lib/outside/store.js";

const EDGE_TTL_SEC = 3600;

function respond(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${EDGE_TTL_SEC}` },
  });
}

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const key = new Request(new URL("/api/outside", request.url).toString(), { method: "GET" });
  try {
    if (cache) {
      const hit = await cache.match(key);
      if (hit) return hit;
    }
    let body;
    if (!env.DB || !(await outsideDataOn(env))) {
      body = { enabled: false, sources: {} };
    } else {
      const nowSec = Math.floor(Date.now() / 1000);
      const sources = {};
      for (const row of await readSources(env.DB)) {
        if (!SOURCES[row.source_id]) continue;
        const d = describeSource(row, row.source_id, nowSec);
        if (!d.value) continue; // stale, failed or never fetched: hidden from owners
        const src = SOURCES[row.source_id];
        sources[row.source_id] = {
          value: d.value, asOf: d.asOf,
          lastSuccessAt: new Date(d.lastSuccessAt * 1000).toISOString(),
          name: src.name, link: src.link, license: src.license,
        };
      }
      body = { enabled: true, sources };
    }
    const res = respond(body);
    if (cache) waitUntil(cache.put(key, res.clone()));
    return res;
  } catch {
    return respond({ enabled: true, sources: {} });
  }
}
