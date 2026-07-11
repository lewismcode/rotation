import { NextResponse } from "next/server";
import { rendersRepo, batchesRepo } from "@rotation/db";
import { enqueueRenderRetry } from "@rotation/queue";
import { requireContext } from "@/lib/context";
import { scopedUserId } from "@/lib/scope";
import { apiHandler, badRequest } from "@/lib/api";

export const runtime = "nodejs";

/**
 * One-click retry of a single failed render. Resets it to queued (atomically,
 * guarded on status='failed' and retry_count < cap), re-enqueues just that
 * clip x hook, and flips the batch back to processing. Idempotent under
 * double-click: the DB guard means only the first click re-enqueues.
 */
export const POST = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;

    const render = await rendersRepo.retryRender(
      ctx.label.id,
      id,
      scopedUserId(ctx)
    );
    if (!render) {
      badRequest(
        "This render can't be retried — it isn't failed, or it's hit the retry limit."
      );
    }

    await enqueueRenderRetry(
      { renderId: render.id, labelId: ctx.label.id },
      render.retry_count
    );
    await batchesRepo.refreshBatchStatus(render.batch_id);

    return NextResponse.json({ ok: true, retry_count: render.retry_count });
  }
);
