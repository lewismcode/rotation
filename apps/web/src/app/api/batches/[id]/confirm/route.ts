import { NextResponse } from "next/server";
import { z } from "zod";
import { batchesRepo, clipsRepo, hooksRepo, rendersRepo } from "@rotation/db";
import { enqueueRenders } from "@rotation/queue";
import { LIMITS, CAPTION_STYLE_IDS, DEFAULT_CAPTION_STYLE } from "@rotation/shared";
import { requireContext } from "@/lib/context";
import { creatorScope } from "@/lib/scope";
import { apiHandler, notFound, badRequest } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({
  hookIds: z.array(z.string().uuid()).min(1).max(LIMITS.MAX_HOOKS_PER_BATCH),
  captionStyle: z.enum(CAPTION_STYLE_IDS).default(DEFAULT_CAPTION_STYLE),
});

/**
 * The fan-out step. Given the batch's ready clips and the selected hooks, create
 * one render row per clip x hook (all queued) and enqueue a render job for each.
 * Everything is label-scoped: hooks are re-resolved within the label, clips come
 * from this batch only.
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

    const { hookIds, captionStyle } = bodySchema.parse(await req.json());

    const clips = (await clipsRepo.listClips(batchId)).filter(
      (c) => c.status === "ready"
    );
    if (clips.length === 0) {
      badRequest("No ready clips to process (still uploading or probing)");
    }

    const hooks = await hooksRepo.getHooksByIds(ctx.label.id, hookIds);
    if (hooks.length === 0) badRequest("None of the selected hooks were found");

    const totalRenders = clips.length * hooks.length;
    if (totalRenders > LIMITS.MAX_RENDERS_PER_BATCH) {
      badRequest(
        `That would create ${totalRenders} renders; the limit is ${LIMITS.MAX_RENDERS_PER_BATCH}. ` +
          `Reduce clips or hooks.`
      );
    }

    const pairs = clips.flatMap((clip) =>
      hooks.map((hook) => ({ clipId: clip.id, hookId: hook.id }))
    );

    const created = await rendersRepo.createRenders(batchId, pairs, captionStyle);
    await batchesRepo.setBatchStatus(ctx.label.id, batchId, "processing");

    await enqueueRenders(
      created.map((r) => ({ renderId: r.id, labelId: ctx.label.id }))
    );

    return NextResponse.json({
      batchId,
      clips: clips.length,
      hooks: hooks.length,
      renders: created.length,
    });
  }
);
