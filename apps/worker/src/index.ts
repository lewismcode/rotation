import express from "express";
import { Worker } from "bullmq";
import { connection } from "@rotation/queue";
import {
  QUEUE,
  type ProbeJob,
  type RenderJob,
  type ZipJob,
} from "@rotation/shared";
import { processProbe } from "./processors/probe.js";
import { processRender } from "./processors/render.js";
import { processZip } from "./processors/zip.js";

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

for (const [name, w] of [
  ["probe", probeWorker],
  ["render", renderWorker],
  ["zip", zipWorker],
] as const) {
  w.on("failed", (job, err) =>
    console.error(`[${name}] job ${job?.id} failed:`, err?.message)
  );
  w.on("completed", (job) => console.log(`[${name}] job ${job.id} completed`));
}

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
  ]);
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
