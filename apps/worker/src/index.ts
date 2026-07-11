import { captureError } from "./sentry.js"; // import first so Sentry inits early
import express from "express";
import { Worker, Queue } from "bullmq";
import { connection } from "@rotation/queue";
import {
  QUEUE,
  type ProbeJob,
  type RenderJob,
  type ZipJob,
} from "@rotation/shared";
import { processProbe, markClipFailedFinal } from "./processors/probe.js";
import { processRender, markRenderFailedFinal } from "./processors/render.js";
import { processZip } from "./processors/zip.js";
import { processPurge } from "./processors/purge.js";

/**
 * The worker is a long-running process (Railway service, not serverless) that
 * drains the probe/render/zip queues. It also exposes a tiny HTTP health
 * endpoint so the platform can health-check it.
 */

// Render concurrency: ffmpeg is CPU-heavy, so keep this modest and let Railway
// scale horizontally. Tunable via env.
const RENDER_CONCURRENCY = Number(process.env.RENDER_CONCURRENCY ?? 2);
const PROBE_CONCURRENCY = Number(process.env.PROBE_CONCURRENCY ?? 4);

const conn = connection();

const probeWorker = new Worker<ProbeJob>(
  QUEUE.PROBE,
  async (job) => processProbe(job.data),
  { connection: conn, concurrency: PROBE_CONCURRENCY }
);

const renderWorker = new Worker<RenderJob>(
  QUEUE.RENDER,
  async (job) => processRender(job.data),
  { connection: conn, concurrency: RENDER_CONCURRENCY }
);

const zipWorker = new Worker<ZipJob>(
  QUEUE.ZIP,
  async (job) => processZip(job.data),
  { connection: conn, concurrency: 1 }
);

// Retention purge: a repeatable job (deduped centrally by BullMQ, so multiple
// worker replicas don't double-run it) every 12h, plus one run at startup.
const purgeWorker = new Worker(
  QUEUE.PURGE,
  async () => processPurge(),
  { connection: conn, concurrency: 1 }
);
const purgeQueue = new Queue(QUEUE.PURGE, { connection: conn });
void purgeQueue
  .add("purge", {}, {
    repeat: { every: 12 * 60 * 60 * 1000 },
    jobId: "purge-cycle",
    removeOnComplete: true,
    removeOnFail: true,
  })
  .catch((err) => console.error("[purge] schedule failed:", err?.message));
void purgeQueue
  .add("purge-startup", {}, { removeOnComplete: true, removeOnFail: true })
  .catch(() => {});

// A job only "really" failed once BullMQ has spent every attempt (or stalled
// past recovery). Until then it will be retried, so we neither alert nor touch
// the DB — that's what prevents a transient failure from racing a manual retry.
function isFinalAttempt(job?: {
  attemptsMade: number;
  opts?: { attempts?: number };
}): boolean {
  if (!job) return true;
  return job.attemptsMade >= (job.opts?.attempts ?? 1);
}

for (const [name, w] of [
  ["probe", probeWorker],
  ["render", renderWorker],
  ["zip", zipWorker],
  ["purge", purgeWorker],
] as const) {
  w.on("failed", (job, err) => {
    const final = isFinalAttempt(job);
    console.error(
      `[${name}] job ${job?.id} failed${final ? "" : " (will retry)"}:`,
      err?.message
    );
    if (final) captureError(err, { queue: name, jobId: job?.id });
  });
  w.on("completed", (job) => console.log(`[${name}] job ${job.id} completed`));
}

// Reconcile the DB once (and only once) a job's attempts are exhausted — this
// also covers a worker killed mid-job: BullMQ recovers the stalled job, retries
// it, and if it still can't finish this fires and clears the stuck row.
renderWorker.on("failed", (job, err) => {
  if (isFinalAttempt(job) && job?.data) {
    void markRenderFailedFinal(job.data, err?.message ?? "Render failed").catch(
      (e) => console.error("[render] reconcile failed:", e?.message)
    );
  }
});
probeWorker.on("failed", (job, err) => {
  if (isFinalAttempt(job) && job?.data) {
    void markClipFailedFinal(job.data).catch((e) =>
      console.error("[probe] reconcile failed:", e?.message)
    );
  }
});

const app = express();
app.get("/health", (_req, res) => res.json({ ok: true, service: "worker" }));
const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => console.log(`[worker] health server on :${port}`));

async function shutdown() {
  console.log("[worker] shutting down…");
  await Promise.allSettled([
    probeWorker.close(),
    renderWorker.close(),
    zipWorker.close(),
    purgeWorker.close(),
  ]);
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
