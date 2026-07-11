import { NextResponse } from "next/server";
import { clipsRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { scopedUserId } from "@/lib/scope";
import { apiHandler, notFound } from "@/lib/api";

export const runtime = "nodejs";

// Archive (soft-delete) a single uploaded clip before generating.
export const DELETE = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;
    const archived = await clipsRepo.archiveClip(
      ctx.label.id,
      id,
      scopedUserId(ctx)
    );
    if (!archived) notFound("Clip not found");
    return NextResponse.json({ ok: true });
  }
);
