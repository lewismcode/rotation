import { auth, clerkClient } from "@clerk/nextjs/server";
import { cache } from "react";
import { labelsRepo, usersRepo } from "@rotation/db";
import type { Label, User } from "@rotation/shared";

export interface RequestContext {
  label: Label;
  user: User;
  clerkUserId: string;
}

/**
 * Resolves the current label (Clerk org) + user (Clerk user), auto-provisioning
 * the rows on first sight. This is THE tenant boundary: every data access in the
 * app derives label_id from here, never from client input. Cached per request.
 *
 * Returns null when there is no authenticated user with an active org — callers
 * treat that as "needs to pick/join an org".
 */
export const getContext = cache(async (): Promise<RequestContext | null> => {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return null;

  let label = await labelsRepo.getLabelByClerkOrg(orgId);
  if (!label) {
    // Provision the label from Clerk org data on first request.
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({
      organizationId: orgId,
    });
    label = await labelsRepo.upsertLabel({
      clerkOrgId: orgId,
      name: org.name,
      displayName: org.name,
      logoUrl: org.imageUrl ?? null,
    });
  }

  const role = orgRole === "org:admin" ? "admin" : "artist";
  const user = await usersRepo.upsertUser({
    clerkUserId: userId,
    labelId: label.id,
    role,
  });

  return { label, user, clerkUserId: userId };
});

/** Throwing variant for API routes / server actions that require a tenant. */
export async function requireContext(): Promise<RequestContext> {
  const ctx = await getContext();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated or no active organization");
    this.name = "UnauthorizedError";
  }
}
