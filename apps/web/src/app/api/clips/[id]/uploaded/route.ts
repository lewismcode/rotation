import { NextResponse } from "next/server";
import { clipsRepo } from "@rotation/db";
import { enqueueProbe } from "@rotation/queue";
import { objectSize, deleteObject, LIMITS } from "@rotation/shared";
import { requireContext } from "@/lib/context";
import { scopedUserId } from "@/lib/scope";
import { apiHandler, notFound, badRequest } from "@/lib/api";

export const runtime = "nodejs";

/**
 * The client calls this once its direct-to-R2 upload for a clip finishes. We
 * enqueue an async probe job (ffprobe on the worker) to fill in dimensions and
 * the resize flag. Never done inline — the request returns immediately.
 *
 * Creator-scoped so an artist can only touch their own clip. The presigned PUT
 * can't bind a max content-length, so the declared-size check at presign time
 * is only advisory — this is where the REAL uploaded size is enforced (HEAD the
 * object); an oversized upload is deleted and the clip failed before any probe.
 */
export const POST = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;
    const clip = await clipsRepo.getClipScoped(
      ctx.label.id,
      id,
      scopedUserId(ctx)
    );
    if (!clip) notFound("Clip not found");

    const size = await objectSize(clip.r2_key_original);
    if (size != null && size > LIMITS.MAX_UPLOAD_BYTES) {
      await deleteObject(clip.r2_key_original).catch(() => {});
      await clipsRepo.setClipStatus(clip.id, "failed");
      badRequest(
        `File exceeds ${Math.round(LIMITS.MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit`
      );
    }

    await enqueueProbe({ clipId: clip.id, labelId: ctx.label.id });
    return NextResponse.json({ ok: true });
  }
);
