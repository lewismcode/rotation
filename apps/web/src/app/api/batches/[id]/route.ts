import { NextResponse } from "next/server";
import { batchesRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { apiHandler, notFound } from "@/lib/api";

export const runtime = "nodejs";

// Full batch state: batch + clips + renders. The client polls this to drive the
// per-clip resize warnings and the live render grid.
export const GET = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;
    const detail = await batchesRepo.getBatchDetail(ctx.label.id, id);
    if (!detail) notFound("Batch not found");
    return NextResponse.json(detail);
  }
);
