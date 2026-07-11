import { NextResponse } from "next/server";
import { z } from "zod";
import { batchesRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { apiHandler, notFound } from "@/lib/api";
import { creatorScope } from "@/lib/scope";

export const runtime = "nodejs";

// Full batch state: batch + clips + renders. Artists only see their own.
export const GET = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;
    const detail = await batchesRepo.getBatchDetail(
      ctx.label.id,
      id,
      creatorScope(ctx)
    );
    if (!detail) notFound("Batch not found");
    return NextResponse.json(detail);
  }
);

const patchSchema = z.object({ name: z.string().max(80).nullable() });

// Rename a batch (owner or admin).
export const PATCH = apiHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;
    const { name } = patchSchema.parse(await req.json());
    const batch = await batchesRepo.renameBatch(
      ctx.label.id,
      id,
      name,
      creatorScope(ctx)
    );
    if (!batch) notFound("Batch not found");
    return NextResponse.json({ batch });
  }
);
