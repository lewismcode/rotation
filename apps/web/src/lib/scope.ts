import type { RequestContext } from "./context";

/**
 * Role → data scope. Label admins see the whole label; artists are scoped to
 * their own batches. This is the label-admin-sees-all / artist-solo boundary.
 */
export function creatorScope(ctx: RequestContext): { createdByUserId?: string } {
  return ctx.user.role === "admin" ? {} : { createdByUserId: ctx.user.id };
}

/** Same rule, as a plain id (or undefined) for the stats queries. */
export function scopedUserId(ctx: RequestContext): string | undefined {
  return ctx.user.role === "admin" ? undefined : ctx.user.id;
}
