import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { OrganizationList } from "@clerk/nextjs";
import { getContext } from "@/lib/context";

export const dynamic = "force-dynamic";

/**
 * Shown to a signed-in user who has no active label (organization) yet. Labels
 * ARE Clerk orgs, so we surface Clerk's org create/select UI. Creating or
 * picking one sets the active org; the label row auto-provisions on the next
 * request and they land in /batches.
 */
export default async function SelectLabelPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  // Already has an active org → nothing to pick.
  if (await getContext()) redirect("/batches");

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="text-center">
          <div className="mb-3 flex items-center justify-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="font-display text-lg font-medium tracking-tight text-primary">
              Rotation
            </span>
          </div>
          <p className="text-sm text-secondary">
            Choose your label to continue, or create one to get started.
          </p>
        </div>
        <OrganizationList
          hidePersonal
          afterCreateOrganizationUrl="/batches"
          afterSelectOrganizationUrl="/batches"
        />
      </div>
    </div>
  );
}
