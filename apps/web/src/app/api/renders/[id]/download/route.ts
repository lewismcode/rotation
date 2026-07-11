import { NextResponse } from "next/server";
import { rendersRepo, clipsRepo, hooksRepo } from "@rotation/db";
import { presignGet, outputFilename } from "@rotation/shared";
import { requireContext } from "@/lib/context";
import { scopedUserId } from "@/lib/scope";
import { apiHandler, notFound, badRequest } from "@/lib/api";

export const runtime = "nodejs";

// Presigned GET for a single completed render, with a human-readable download
// filename. Creator-scoped: an artist can only download their own renders.
export const GET = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;

    const render = await rendersRepo.getRenderScoped(
      ctx.label.id,
      id,
      scopedUserId(ctx)
    );
    if (!render) notFound("Render not found");
    if (render.status !== "complete" || !render.r2_key_output) {
      badRequest("Render is not complete yet");
    }

    const [clip, hook] = await Promise.all([
      clipsRepo.getClipScoped(ctx.label.id, render.clip_id),
      hooksRepo.getHook(ctx.label.id, render.hook_id),
    ]);
    const name =
      clip && hook
        ? outputFilename(clip.original_filename, hook.text)
        : `render-${render.id}.mp4`;

    const url = await presignGet(render.r2_key_output!, name);
    return NextResponse.json({ url, filename: name });
  }
);
