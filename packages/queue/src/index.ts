import { Queue } from "bullmq";
import { QUEUE, type ProbeJob, type RenderJob, type ZipJob } from "@rotation/shared";
import { connection } from "./connection.js";

export { connection } from "./connection.js";

const globalForQueues = globalThis as unknown as {
  __rotationQueues?: {
    probe: Queue<ProbeJob>;
    render: Queue<RenderJob>;
    zip: Queue<ZipJob>;
  };
};

function queues() {
  if (globalForQueues.__rotationQueues) return globalForQueues.__rotationQueues;
  const conn = connection();
  const opts = {
    connection: conn,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 5_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 500 },
    },
  };
  const made = {
    probe: new Queue<ProbeJob>(QUEUE.PROBE, opts),
    render: new Queue<RenderJob>(QUEUE.RENDER, opts),
    zip: new Queue<ZipJob>(QUEUE.ZIP, opts),
  };
  globalForQueues.__rotationQueues = made;
  return made;
}

export async function enqueueProbe(job: ProbeJob): Promise<void> {
  await queues().probe.add("probe", job, { jobId: `probe:${job.clipId}` });
}

export async function enqueueRender(job: RenderJob): Promise<void> {
  await queues().render.add("render", job, { jobId: `render:${job.renderId}` });
}

export async function enqueueRenders(jobs: RenderJob[]): Promise<void> {
  if (jobs.length === 0) return;
  await queues().render.addBulk(
    jobs.map((job) => ({
      name: "render",
      data: job,
      opts: { jobId: `render:${job.renderId}` },
    }))
  );
}

export async function enqueueZip(job: ZipJob): Promise<void> {
  await queues().zip.add("zip", job, { jobId: `zip:${job.batchId}:${Date.now()}` });
}
