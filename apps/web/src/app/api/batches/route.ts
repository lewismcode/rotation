import { NextResponse } from "next/server";
import { batchesRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { creatorScope } from "@/lib/scope";
import { apiHandler } from "@/lib/api";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  const ctx = await requireContext();
  // Creator-scoped: artists only see their own batches (admins see the label).
  const batches = await batchesRepo.listBatches(ctx.label.id, creatorScope(ctx));
  return NextResponse.json({ batches });
});

// Start a new (empty, uploading) batch. Clips are attached via the clips route.
export const POST = apiHandler(async () => {
  const ctx = await requireContext();
  const batch = await batchesRepo.createBatch({
    labelId: ctx.label.id,
    createdByUserId: ctx.user.id,
  });
  return NextResponse.json({ batch }, { status: 201 });
});
