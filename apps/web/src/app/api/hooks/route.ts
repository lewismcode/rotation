import { NextResponse } from "next/server";
import { z } from "zod";
import { hooksRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { apiHandler, forbidden, badRequest } from "@/lib/api";

export const runtime = "nodejs";

const createSchema = z.object({ text: z.string().trim().min(1).max(300) });

export const GET = apiHandler(async (req: Request) => {
  const ctx = await requireContext();
  const activeOnly =
    new URL(req.url).searchParams.get("active") === "true";
  const hooks = await hooksRepo.listHooks(ctx.label.id, { activeOnly });
  return NextResponse.json({ hooks });
});

export const POST = apiHandler(async (req: Request) => {
  const ctx = await requireContext();
  if (ctx.user.role !== "admin") forbidden("Only admins can manage hooks");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) badRequest("Hook text is required (1–300 chars)");
  const hook = await hooksRepo.createHook({
    labelId: ctx.label.id,
    text: parsed.data!.text,
    createdBy: ctx.user.id,
  });
  return NextResponse.json({ hook }, { status: 201 });
});
