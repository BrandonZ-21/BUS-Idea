// Tally's outside-data job: a separate, tiny Cloudflare Worker whose only job
// is to run on a schedule (Cron Trigger) and refresh public statistics in the
// shared D1 database. Cloudflare Pages (where the Tally site lives) can't run
// scheduled jobs, which is why this is its own Worker.
//
// It never touches sales or owners. It has no public web address
// (workers_dev is off in wrangler.jsonc); a web request gets a 404.
//
// Turn it off without a deploy: Founder page -> "Outside data: off".
// Turn it off with a deploy: set OUTSIDE_DATA to "off" in wrangler.jsonc.

import { runOutsideJob } from "../../lib/outside/run.js";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runOutsideJob(env, event.scheduledTime || Date.now()));
  },
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
