import { NextResponse } from "next/server";
import { batchesRepo, rendersRepo } from "@rotation/db";
import { enqueueZip } from "@rotation/queue";
import {
  presignGet,
  objectExists,
  deleteObject,
  R2_PREFIX,
  batchDisplayName,
  slugify,
} from "@rotation/shared";
import { requireContext } from "@/lib/context";
import { creatorScope } from "@/lib/scope";
import { apiHandler, notFound, badRequest } from "@/lib/api";

export const runtime = "nodejs";

// POST enqueues a zip build of all completed renders in the batch.
export const POST = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id: batchId } = await params;
    const batch = await batchesRepo.getBatch(
      ctx.label.id,
      batchId,
      creatorScope(ctx)
    );
    if (!batch) notFound("Batch not found");

    const complete = await rendersRepo.listCompleteRenders(batchId);
    if (complete.length === 0) badRequest("No completed renders to zip yet");

    // Drop any previous zip first so the GET poll can't hand back a stale
    // archive (built before the latest renders/retries) while this one rebuilds.
    await deleteObject(R2_PREFIX.zip(ctx.label.id, batchId)).catch(() => {});
    await enqueueZip({ batchId, labelId: ctx.label.id });
    return NextResponse.json({ ok: true, queued: complete.length });
  }
);

// GET polls whether the zip is ready and, if so, returns a presigned link.
export const GET = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id: batchId } = await params;
    const batch = await batchesRepo.getBatch(
      ctx.label.id,
      batchId,
      creatorScope(ctx)
    );
    if (!batch) notFound("Batch not found");

    const key = R2_PREFIX.zip(ctx.label.id, batchId);
    if (!(await objectExists(key))) {
      return NextResponse.json({ ready: false }, { status: 202 });
    }
    // Human-readable zip filename from the batch's display name.
    const url = await presignGet(key, `${slugify(batchDisplayName(batch), 60)}.zip`);
    return NextResponse.json({ ready: true, url });
  }
);
