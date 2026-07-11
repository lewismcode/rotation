import { NextResponse } from "next/server";
import { clipsRepo } from "@rotation/db";
import { presignGet } from "@rotation/shared";
import { requireContext } from "@/lib/context";
import { apiHandler, notFound } from "@/lib/api";

export const runtime = "nodejs";

// Redirect to a presigned GET of the original clip so the crop UI can show the
// source footage in a <video>. Auth+label-scoped; the URL is short-lived.
export const GET = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;
    const clip = await clipsRepo.getClipScoped(ctx.label.id, id);
    if (!clip) notFound("Clip not found");
    const url = await presignGet(clip.r2_key_original, undefined, 60 * 60);
    return NextResponse.redirect(url, {
      headers: { "Cache-Control": "private, max-age=1800" },
    });
  }
);
