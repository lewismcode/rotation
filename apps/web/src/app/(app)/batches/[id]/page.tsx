import { notFound } from "next/navigation";
import { batchesRepo, hooksRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { BatchFlow } from "@/components/batch/BatchFlow";

export const dynamic = "force-dynamic";

export default async function BatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;

  const detail = await batchesRepo.getBatchDetail(ctx.label.id, id);
  if (!detail) notFound();

  // Only active hooks are selectable in a batch.
  const hooks = await hooksRepo.listHooks(ctx.label.id, { activeOnly: true });

  return (
    <BatchFlow
      initialDetail={detail}
      hooks={hooks}
    />
  );
}
