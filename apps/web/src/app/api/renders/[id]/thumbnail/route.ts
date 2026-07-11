import { NextResponse } from "next/server";
import { rendersRepo } from "@rotation/db";
import { presignGet } from "@rotation/shared";
import { requireContext } from "@/lib/context";
import { apiHandler, notFound } from "@/lib/api";

export const runtime = "nodejs";

// Redirect to a presigned GET for the render's thumbnail. Using an <img src> to
// this stable URL lets the browser cache the image; the endpoint itself is
// auth+label-scoped so thumbnails aren't public.
export const GET = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireContext();
    const { id } = await params;
    const render = await rendersRepo.getRenderScoped(ctx.label.id, id);
    if (!render?.thumbnail_r2_key) notFound("No thumbnail");
    const url = await presignGet(render.thumbnail_r2_key, undefined, 60 * 60);
    return NextResponse.redirect(url, {
      headers: { "Cache-Control": "private, max-age=1800" },
    });
  }
);
