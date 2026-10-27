// One scheduled run of the outside-data job (called by the Worker's cron
// handler). Fetches only sources that are due, keeps the last good value when
// a fetch fails, backs off after failures, and records a short run log.
// Never throws: a broken source must not break anything else.

import { fetchBlsCpi } from "./bls.js";
import { isDue, outsideDataOn, readSources, recordRun, saveFailure, saveSuccess } from "./store.js";

const FETCHERS = { bls_cpi: fetchBlsCpi };

export async function runOutsideJob(env, nowMs = Date.now(), fetchImpl = fetch) {
  const started = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const run = { at: nowSec, ok: true, outboundRequests: 0, rowsWritten: 0, note: "" };
  try {
    if (!(await outsideDataOn(env))) {
      run.skipped = "switched_off";
    } else {
      const rows = new Map((await readSources(env.DB)).map((r) => [r.source_id, r]));
      const notes = [];
      for (const [id, fetcher] of Object.entries(FETCHERS)) {
        const row = rows.get(id);
        if (!isDue(row, id, nowSec)) continue;
        const result = await fetcher(env, nowMs, fetchImpl);
        run.outboundRequests += result.requests || 0;
        if (result.ok) {
          await saveSuccess(env.DB, id, result, nowSec);
          notes.push(`${id}:ok`);
        } else {
          await saveFailure(env.DB, id, result.error, nowSec, row ? row.fail_count : 0);
          run.ok = false;
          notes.push(`${id}:${result.error}`);
        }
        run.rowsWritten++;
      }
      run.note = notes.join(" ") || "nothing_due";
    }
  } catch (err) {
    run.ok = false;
    run.note = "job_error";
    console.error("outside-data job failed:", err && err.name ? err.name : "error");
  }
  run.durationMs = Date.now() - started;
  try {
    await recordRun(env.DB, run);
  } catch {
    // the run log is nice to have; never fail the job over it
  }
  return run;
}
