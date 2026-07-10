import { NextResponse } from "next/server";
import { z } from "zod";
import { usersRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { apiHandler } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({ theme: z.enum(["light", "dark"]) });

// Persist the theme on the user record so the preference follows them across
// devices (per the spec: per-user, not per-device).
export const POST = apiHandler(async (req: Request) => {
  const ctx = await requireContext();
  const { theme } = bodySchema.parse(await req.json());
  await usersRepo.setThemePreference(ctx.user.id, theme);
  return NextResponse.json({ ok: true, theme });
});
