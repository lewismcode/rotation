import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { batchesRepo, clipsRepo } from "@rotation/db";
import {
  presignPut,
  R2_PREFIX,
  LIMITS,
  ALLOWED_VIDEO_MIME,
} from "@rotation/shared";
import { requireContext } from "@/lib/context";
import { creatorScope } from "@/lib/scope";
import { apiHandler, notFound, badRequest } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({
  filename: z.string().min(1).max(300),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

/**
 * Register one clip and hand back a presigned PUT so the browser uploads bytes
 * straight to R2 (never proxied through Node). We pre-create the clip row so the
 * R2 key is deterministic and the row exists to be probed after upload.
 */
export const POST = apiHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id: batchId } = await params;

    const batch = await batchesRepo.getBatch(
      ctx.label.id,
      batchId,
      creatorScope(ctx)
    );
    if (!batch) notFound("Batch not found");

    const { filename, contentType, size } = bodySchema.parse(await req.json());

    if (!ALLOWED_VIDEO_MIME.includes(contentType as never)) {
      badRequest(`Unsupported file type: ${contentType}`);
    }
    if (size > LIMITS.MAX_UPLOAD_BYTES) {
      badRequest(
        `File exceeds ${Math.round(LIMITS.MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit`
      );
    }

    const existing = await clipsRepo.listClips(batchId);
    if (existing.length >= LIMITS.MAX_CLIPS_PER_BATCH) {
      badRequest(`A batch is limited to ${LIMITS.MAX_CLIPS_PER_BATCH} clips`);
    }

    // Reserve the clip id so the R2 key is stable before the row is inserted.
    const clipId = randomUUID();
    const key = R2_PREFIX.original(ctx.label.id, batchId, clipId, filename);

    const clip = await clipsRepo.createClip({
      id: clipId,
      batchId,
      originalFilename: filename,
      r2KeyOriginal: key,
    });

    const uploadUrl = await presignPut(key, contentType);
    return NextResponse.json({ clip, uploadUrl }, { status: 201 });
  }
);
