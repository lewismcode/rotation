import { NextResponse } from "next/server";
import { z } from "zod";
import { clipsRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { scopedUserId } from "@/lib/scope";
import { apiHandler, notFound } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

// Persist a manual crop anchor for a clip that will be reframed to 9:16.
// Creator-scoped so an artist can only reframe their own uploads.
export const PATCH = apiHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;
    const { x, y } = bodySchema.parse(await req.json());
    const clip = await clipsRepo.setClipCrop(
      ctx.label.id,
      id,
      x,
      y,
      scopedUserId(ctx)
    );
    if (!clip) notFound("Clip not found");
    return NextResponse.json({ ok: true });
  }
);
