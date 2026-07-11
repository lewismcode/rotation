import { NextResponse } from "next/server";
import { hooksRepo } from "@rotation/db";
import { STARTER_HOOKS } from "@rotation/shared";
import { requireContext } from "@/lib/context";
import { apiHandler, forbidden } from "@/lib/api";

export const runtime = "nodejs";

// Add the starter hook pack to this label (idempotent — skips ones already
// present). Admin only.
export const POST = apiHandler(async () => {
  const ctx = await requireContext();
  if (ctx.user.role !== "admin") forbidden("Only admins can manage hooks");
  const added = await hooksRepo.addMissingHooks(
    ctx.label.id,
    STARTER_HOOKS,
    ctx.user.id
  );
  return NextResponse.json({ added });
});
