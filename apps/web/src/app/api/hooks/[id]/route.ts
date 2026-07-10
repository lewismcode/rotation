import { NextResponse } from "next/server";
import { z } from "zod";
import { hooksRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { apiHandler, forbidden, notFound } from "@/lib/api";

export const runtime = "nodejs";

const patchSchema = z.object({
  text: z.string().trim().min(1).max(300).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = apiHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    if (ctx.user.role !== "admin") forbidden("Only admins can manage hooks");
    const { id } = await params;
    const patch = patchSchema.parse(await req.json());
    const hook = await hooksRepo.updateHook(ctx.label.id, id, patch);
    if (!hook) notFound("Hook not found");
    return NextResponse.json({ hook });
  }
);
