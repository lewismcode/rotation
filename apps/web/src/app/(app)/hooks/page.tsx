import { redirect } from "next/navigation";
import { hooksRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { HooksAdmin } from "@/components/hooks/HooksAdmin";

export const dynamic = "force-dynamic";

export default async function HooksPage() {
  const ctx = await requireContext();
  if (ctx.user.role !== "admin") redirect("/batches");

  const hooks = await hooksRepo.listHooks(ctx.label.id);
  return <HooksAdmin initialHooks={hooks} />;
}
