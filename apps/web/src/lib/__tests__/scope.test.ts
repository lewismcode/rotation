import { describe, it, expect } from "vitest";
import { creatorScope, scopedUserId } from "../scope";
import type { RequestContext } from "../context";

// Minimal context factory — scope only reads user.role / user.id.
function ctx(role: "admin" | "artist", id = "user_1"): RequestContext {
  return {
    label: { id: "label_1" },
    user: { id, role },
    clerkUserId: "clerk_1",
  } as unknown as RequestContext;
}

describe("creatorScope (label-admin-sees-all / artist-solo)", () => {
  it("gives an admin the whole label (no creator filter)", () => {
    expect(creatorScope(ctx("admin"))).toEqual({});
  });

  it("scopes an artist to their own rows", () => {
    expect(creatorScope(ctx("artist", "user_42"))).toEqual({
      createdByUserId: "user_42",
    });
  });
});

describe("scopedUserId", () => {
  it("is undefined for admins", () => {
    expect(scopedUserId(ctx("admin"))).toBeUndefined();
  });

  it("is the artist's own id", () => {
    expect(scopedUserId(ctx("artist", "user_42"))).toBe("user_42");
  });
});
