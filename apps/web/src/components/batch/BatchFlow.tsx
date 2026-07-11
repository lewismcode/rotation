"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Batch, Clip, Render, Hook } from "@rotation/shared/types";
import type { CaptionStyle } from "@rotation/shared/caption-styles";
import { StepShell, type StepState } from "./StepShell";
import { UploadStep } from "./UploadStep";
import { HooksStep } from "./HooksStep";
import { RenderGrid } from "./RenderGrid";
import { DeliveryStep } from "./DeliveryStep";

export interface BatchDetail {
  batch: Batch;
  clips: Clip[];
  renders: Render[];
}

type Stage = "upload" | "hooks";

export function BatchFlow({
  initialDetail,
  hooks,
}: {
  initialDetail: BatchDetail;
  hooks: Hook[];
}) {
  const [detail, setDetail] = useState<BatchDetail>(initialDetail);
  const confirmed = detail.renders.length > 0;
  const [stage, setStage] = useState<Stage>(confirmed ? "hooks" : "upload");
  const [openStep, setOpenStep] = useState<number>(0);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/batches/${detail.batch.id}`, {
      cache: "no-store",
    });
    if (res.ok) setDetail(await res.json());
  }, [detail.batch.id]);

  // Poll while anything is in flight: clips probing/uploading, or renders not
  // yet settled. Stops once everything is terminal.
  const shouldPoll = useMemo(() => {
    const clipsPending = detail.clips.some(
      (c) => c.status === "uploading" || c.status === "probing"
    );
    const rendersPending = detail.renders.some(
      (r) => r.status === "queued" || r.status === "processing"
    );
    return clipsPending || rendersPending;
  }, [detail]);

  const pollRef = useRef(shouldPoll);
  pollRef.current = shouldPoll;
  useEffect(() => {
    if (!shouldPoll) return;
    const t = setInterval(() => {
      if (pollRef.current) void refetch();
    }, 2500);
    return () => clearInterval(t);
  }, [shouldPoll, refetch]);

  // Derive the active step index from data + local pre-confirm stage.
  const currentStep = useMemo(() => {
    if (!confirmed) return stage === "upload" ? 0 : 1;
    if (detail.batch.status === "processing") return 2;
    return 3; // complete / failed → delivery
  }, [confirmed, stage, detail.batch.status]);

  // Keep the open step tracking the active one, unless the user reopened a
  // completed step to peek at it.
  useEffect(() => {
    setOpenStep(currentStep);
  }, [currentStep]);

  const readyClips = detail.clips.filter((c) => c.status === "ready");
  const selectedHookIds = useMemo(
    () => Array.from(new Set(detail.renders.map((r) => r.hook_id))),
    [detail.renders]
  );

  function stateFor(index: number): StepState {
    if (index === currentStep) return "active";
    if (index < currentStep) return "complete";
    return "locked";
  }

  function toggle(index: number, editableStage?: Stage) {
    if (stateFor(index) === "locked") return;
    if (editableStage && !confirmed) setStage(editableStage);
    setOpenStep((cur) => (cur === index ? -1 : index));
  }

  const completeCount = detail.renders.filter(
    (r) => r.status === "complete"
  ).length;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="rise mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Batch
        </h1>
        <p className="data mt-1 text-xs text-faint">{detail.batch.id}</p>
      </div>

      {/* Step 1 — Upload */}
      <StepShell
        index={1}
        title="Upload clips"
        state={stateFor(0)}
        expanded={openStep === 0}
        summary={`${detail.clips.length} clip${detail.clips.length === 1 ? "" : "s"}`}
        onToggle={() => toggle(0, "upload")}
      >
        <UploadStep
          batchId={detail.batch.id}
          clips={detail.clips}
          locked={confirmed}
          onChanged={refetch}
          onContinue={() => setStage("hooks")}
          canContinue={readyClips.length > 0}
        />
      </StepShell>

      {/* Step 2 — Hooks */}
      <StepShell
        index={2}
        title="Select hooks"
        state={stateFor(1)}
        expanded={openStep === 1}
        summary={
          confirmed
            ? `${selectedHookIds.length} hook${selectedHookIds.length === 1 ? "" : "s"}`
            : undefined
        }
        onToggle={() => toggle(1, "hooks")}
      >
        <HooksStep
          batchId={detail.batch.id}
          hooks={hooks}
          clipCount={readyClips.length}
          locked={confirmed}
          selectedHookIds={selectedHookIds}
          confirmedStyle={
            detail.renders[0]?.caption_style as CaptionStyle | undefined
          }
          onConfirmed={refetch}
        />
      </StepShell>

      {/* Step 3 — Render */}
      <StepShell
        index={3}
        title="Render"
        state={stateFor(2)}
        expanded={openStep === 2}
        summary={
          confirmed
            ? `${completeCount}/${detail.renders.length} done`
            : undefined
        }
        onToggle={() => toggle(2)}
      >
        <RenderGrid
          clips={detail.clips}
          hooks={hooks}
          renders={detail.renders}
        />
      </StepShell>

      {/* Step 4 — Deliver */}
      <StepShell
        index={4}
        title="Download"
        state={stateFor(3)}
        expanded={openStep === 3}
        onToggle={() => toggle(3)}
      >
        <DeliveryStep
          batchId={detail.batch.id}
          clips={detail.clips}
          hooks={hooks}
          renders={detail.renders}
        />
      </StepShell>
    </div>
  );
}
