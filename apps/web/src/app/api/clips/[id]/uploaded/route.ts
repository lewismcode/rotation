import { NextResponse } from "next/server";
import { clipsRepo } from "@rotation/db";
import { enqueueProbe } from "@rotation/queue";
import { requireContext } from "@/lib/context";
import { apiHandler, notFound } from "@/lib/api";

export const runtime = "nodejs";

/**
 * The client calls this once its direct-to-R2 upload for a clip finishes. We
 * enqueue an async probe job (ffprobe on the worker) to fill in dimensions and
 * the resize flag. Never done inline — the request returns immediately.
 */
export const POST = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;
    const clip = await clipsRepo.getClipScoped(ctx.label.id, id);
    if (!clip) notFound("Clip not found");
    await enqueueProbe({ clipId: clip.id, labelId: ctx.label.id });
    return NextResponse.json({ ok: true });
  }
);
