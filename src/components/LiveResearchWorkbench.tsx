"use client";

import pLimit from "p-limit";
import type {
  AgentEvidenceCard,
  AgentPhase,
  AgentRequest,
  AgentTelemetryMetric,
  EvidenceCardsArtifact,
  EvidencePlanArtifact,
  HypothesisTreeArtifact,
  MemoArtifact,
  TaskFrameArtifact
} from "@/lib/agent/types";
import { useEffect, useState } from "react";
import { AgentInputPanel } from "./AgentInputPanel";
import { AgentRunTimeline } from "./AgentRunTimeline";
import { EvidencePanel } from "./EvidencePanel";
import { HypothesisTree } from "./HypothesisTree";
import { InvestmentMemo } from "./InvestmentMemo";

type WorkbenchStage = "intro" | "running" | "complete" | "error";

interface PlanResponse {
  taskFrame: TaskFrameArtifact;
  hypothesisTree: HypothesisTreeArtifact;
  evidencePlan: EvidencePlanArtifact;
}

interface EvidenceTaskResponse {
  evidenceCards: AgentEvidenceCard[];
  telemetry?: AgentTelemetryMetric[];
}

interface SynthesisResponse {
  memo: MemoArtifact;
  telemetry?: AgentTelemetryMetric[];
}

interface EvidenceQueueCallbacks {
  onProgress?: (completedCount: number) => void;
  onRetry?: (message: string) => void;
}

type DragState = {
  handle: "agent" | "trace";
  startX: number;
  startLeft: number;
  startRight: number;
};

interface ColumnWidths {
  left: number;
  right: number;
}

const phaseNames: AgentPhase["name"][] = [
  "Task Framing",
  "Hypothesis Generation",
  "Evidence Planning",
  "Evidence Research",
  "Evidence Scoring",
  "Reasoning Synthesis",
  "Memo Rendering"
];

function initialPhases(): AgentPhase[] {
  return phaseNames.map((name) => ({
    name,
    status: "queued",
    detail: "Waiting to run."
  }));
}

function visiblePhases(phases: AgentPhase[], hasStarted: boolean): AgentPhase[] {
  if (!hasStarted) {
    return [];
  }

  let lastActiveIndex = -1;
  for (let index = phases.length - 1; index >= 0; index -= 1) {
    if (phases[index].status !== "queued") {
      lastActiveIndex = index;
      break;
    }
  }
  if (lastActiveIndex === -1) {
    return phases.slice(0, 1);
  }
  if (phases.every((phase) => phase.status === "failed")) {
    return phases;
  }

  return phases.slice(0, lastActiveIndex + 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function failedPhases(detail: string): AgentPhase[] {
  return phaseNames.map((name) => ({
    name,
    status: "failed",
    detail
  }));
}

function sanitizeAgentRequest(request: AgentRequest): AgentRequest {
  const { name, ticker, exchange, country, assetType } = request.security;
  return {
    ...request,
    security: {
      name,
      ticker,
      exchange,
      country,
      assetType
    }
  };
}

function formatServerError(message: string): string {
  try {
    const parsed = JSON.parse(message) as Array<{
      code?: string;
      keys?: string[];
      message?: string;
    }>;
    const unrecognizedKeys = parsed
      .filter((item) => item.code === "unrecognized_keys" && item.keys?.length)
      .flatMap((item) => item.keys ?? []);
    if (unrecognizedKeys.length > 0) {
      return `Invalid research request: unexpected field(s) ${unrecognizedKeys.join(", ")}.`;
    }
    const firstMessage = parsed.find((item) => item.message)?.message;
    return firstMessage ?? message;
  } catch {
    return message;
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  const fallback = `Research run failed with status ${response.status}.`;
  const text = await response.text();
  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text) as { error?: string; message?: string };
    const message = payload.message ?? payload.error;
    return message ? formatServerError(message) : fallback;
  } catch {
    return text;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export function LiveResearchWorkbench() {
  const [modeLabel, setModeLabel] =
    useState<"Live Agent" | "Demo Fallback" | "Error">("Demo Fallback");
  const [isRunning, setIsRunning] = useState(false);
  const [phases, setPhases] = useState<AgentPhase[]>(initialPhases);
  const [tree, setTree] = useState<HypothesisTreeArtifact | null>(null);
  const [evidence, setEvidence] = useState<EvidenceCardsArtifact | null>(null);
  const [memo, setMemo] = useState<MemoArtifact | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [telemetryMetrics, setTelemetryMetrics] = useState<AgentTelemetryMetric[]>([]);
  const [workbenchStage, setWorkbenchStage] = useState<WorkbenchStage>("intro");
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    left: 320,
    right: 380
  });
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    fetch("/api/research/status")
      .then((response) => response.json())
      .then((status: { liveAvailable: boolean }) => {
        setModeLabel(status.liveAvailable ? "Live Agent" : "Demo Fallback");
      })
      .catch(() => setModeLabel("Error"));
  }, []);

  useEffect(() => {
    if (!dragState) {
      return;
    }
    const activeDrag = dragState;

    function handleMouseMove(event: MouseEvent) {
      const deltaX = event.clientX - activeDrag.startX;
      setColumnWidths((current) => {
        if (activeDrag.handle === "agent") {
          return {
            ...current,
            left: clamp(activeDrag.startLeft + deltaX, 260, 560)
          };
        }

        return {
          ...current,
          right: clamp(activeDrag.startRight - deltaX, 300, 620)
        };
      });
    }

    function handleMouseUp() {
      setDragState(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState]);

  function updatePhase(
    name: AgentPhase["name"],
    status: AgentPhase["status"],
    detail: string
  ) {
    setPhases((current) =>
      current.map((phase) => (phase.name === name ? { ...phase, status, detail } : phase))
    );
  }

  async function handleRun(request: AgentRequest) {
    setWorkbenchStage("running");
    setIsRunning(true);
    setError(null);
    setTree(null);
    setEvidence(null);
    setMemo(null);
    setSelectedNodeId(null);
    setHighlightedNodeIds([]);
    setTelemetryMetrics([]);
    setPhases(initialPhases());

    try {
      const cleanedRequest = sanitizeAgentRequest(request);
      setModeLabel("Live Agent");

      updatePhase("Task Framing", "running", "Reading the question and framing the decision.");
      const plan = await postJson<PlanResponse>("/api/research/plan", cleanedRequest);
      let evidenceProgressVisible = false;
      let completedEvidenceCount = 0;
      let latestEvidenceMessage = "";
      const evidencePromise = runEvidenceQueue(
        cleanedRequest,
        plan.evidencePlan,
        {
          onProgress: (completedCount) => {
          completedEvidenceCount = completedCount;
          if (evidenceProgressVisible) {
            updatePhase(
              "Evidence Research",
              "running",
              `${completedCount}/${plan.evidencePlan.items.length} evidence tasks complete.`
            );
          }
          },
          onRetry: (message) => {
            latestEvidenceMessage = message;
            if (evidenceProgressVisible) {
              updatePhase("Evidence Research", "running", message);
            }
          }
        }
      );

      updatePhase("Task Framing", "complete", "Research task framed.");
      await delay(120);

      updatePhase("Hypothesis Generation", "running", "Building the hypothesis tree.");
      setTree(plan.hypothesisTree);
      setSelectedNodeId(null);
      await delay(180);
      updatePhase("Hypothesis Generation", "complete", "Hypothesis tree generated.");
      await delay(90);

      updatePhase("Evidence Planning", "running", "Planning source checks.");
      await delay(140);
      updatePhase("Evidence Planning", "complete", "Evidence plan generated.");
      await delay(80);

      evidenceProgressVisible = true;
      updatePhase(
        "Evidence Research",
        "running",
        latestEvidenceMessage
          ? latestEvidenceMessage
          : completedEvidenceCount > 0
          ? `${completedEvidenceCount}/${plan.evidencePlan.items.length} evidence tasks complete.`
          : `Running ${plan.evidencePlan.items.length} evidence tasks with 2 concurrent workers.`
      );
      const evidenceCards = await evidencePromise;
      const evidenceArtifact: EvidenceCardsArtifact = {
        type: "evidence-cards",
        evidenceCards
      };
      setEvidence(evidenceArtifact);
      updatePhase(
        "Evidence Research",
        "complete",
        `All ${plan.evidencePlan.items.length} evidence tasks returned successfully.`
      );

      updatePhase("Evidence Scoring", "running", "Scoring evidence and node conclusions.");
      const synthesis = await postJson<SynthesisResponse>("/api/research/synthesis", {
        request: cleanedRequest,
        taskFrame: plan.taskFrame,
        hypothesisTree: plan.hypothesisTree,
        evidenceCards
      });
      appendTelemetry(synthesis.telemetry);
      updatePhase("Evidence Scoring", "complete", "Evidence scored.");

      updatePhase("Reasoning Synthesis", "running", "Synthesizing the investment memo.");
      setMemo(synthesis.memo);
      updatePhase("Reasoning Synthesis", "complete", "Memo synthesized.");

      updatePhase("Memo Rendering", "running", "Rendering the final memo.");
      updatePhase("Memo Rendering", "complete", "Final memo ready.");
      setWorkbenchStage("complete");
    } catch (runError) {
      handleRunFailure(
        runError instanceof Error ? runError.message : "Research run failed."
      );
    } finally {
      setIsRunning(false);
    }
  }

  async function runEvidenceQueue(
    request: AgentRequest,
    evidencePlan: EvidencePlanArtifact,
    callbacks: EvidenceQueueCallbacks = {}
  ): Promise<AgentEvidenceCard[]> {
    const limit = pLimit(2);
    const completedGroups: AgentEvidenceCard[][] = Array.from({
      length: evidencePlan.items.length
    });
    let completedCount = 0;

    const tasks = evidencePlan.items.map((item, index) =>
      limit(async () => {
        const result = await runEvidenceTaskUntilSuccess(
          request,
          item,
          index,
          callbacks.onRetry
        );
        completedGroups[index] = result.evidenceCards;
        completedCount += 1;
        const mergedCards = completedGroups.flatMap((group) => group ?? []);
        setEvidence({
          type: "evidence-cards",
          evidenceCards: mergedCards
        });
        callbacks.onProgress?.(completedCount);
        appendTelemetry(result.telemetry);
      })
    );

    await Promise.all(tasks);
    return completedGroups.flatMap((group) => group ?? []);
  }

  async function runEvidenceTaskUntilSuccess(
    request: AgentRequest,
    item: EvidencePlanArtifact["items"][number],
    index: number,
    onRetry?: (message: string) => void
  ): Promise<EvidenceTaskResponse> {
    let attempt = 1;

    while (true) {
      try {
        const result = await postJson<EvidenceTaskResponse>("/api/research/evidence", {
          request,
          item
        });
        if (result.evidenceCards.length === 0) {
          throw new Error("Evidence task returned no evidence cards.");
        }
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Evidence task failed.";
        console.warn(
          `Evidence task ${index + 1} failed on attempt ${attempt}; retrying in 5 seconds.`,
          error
        );
        onRetry?.(`Task ${index + 1} attempt ${attempt} failed: ${message}. Retrying in 5 seconds.`);
        attempt += 1;
        await delay(5000);
      }
    }
  }

  function appendTelemetry(metrics: AgentTelemetryMetric[] | undefined) {
    if (!metrics?.length) {
      return;
    }
    setTelemetryMetrics((current) => [...current, ...metrics]);
  }

  function handleRunFailure(message: string) {
    setError(message);
    setModeLabel("Error");
    setWorkbenchStage("error");
    setPhases(failedPhases(message));
  }

  const hasStarted = workbenchStage !== "intro";
  const showWorkspace = hasStarted;
  const showTraceColumn = Boolean(tree || evidence);
  const renderedPhases = visiblePhases(phases, hasStarted);
  const gridTemplateColumns = showTraceColumn
    ? `${columnWidths.left}px 12px minmax(420px, 1fr) 12px ${columnWidths.right}px`
    : `${columnWidths.left}px 12px minmax(420px, 1fr)`;
  const shellClassName = [
    "app-shell",
    hasStarted ? "workbench-active" : "intro-active",
    `${workbenchStage}-active`,
    showTraceColumn ? "trace-visible" : "trace-hidden"
  ].join(" ");

  return (
    <main
      className={shellClassName}
      style={hasStarted ? { gridTemplateColumns } : undefined}
    >
      <AgentInputPanel
        isRunning={isRunning}
        modeLabel={modeLabel}
        onRun={handleRun}
      />
      {showWorkspace ? (
        <>
          <button
            aria-label="Resize agent and workspace columns"
            className="column-resizer"
            onMouseDown={(event) =>
              setDragState({
                handle: "agent",
                startX: event.clientX,
                startLeft: columnWidths.left,
                startRight: columnWidths.right
              })
            }
            role="separator"
            type="button"
          />
          <section className="workspace progressive-panel">
            <div className="workspace-header">
              <div>
                <p className="eyebrow">MiroMind Deep Research</p>
                <h2>{tree?.rootQuestion ?? "Run a listed-company research question"}</h2>
              </div>
              <span className="mode-pill">{modeLabel}</span>
            </div>
            {error ? (
              <div aria-live="assertive" className="error-panel error-toast" role="alert">
                {error}
              </div>
            ) : null}
            {workbenchStage === "complete" ? (
              <CompletedRunSummary phases={phases} />
            ) : (
              <AgentRunTimeline phases={renderedPhases} />
            )}
            {telemetryMetrics.length > 0 && workbenchStage !== "complete" ? (
              <RunDiagnostics metrics={telemetryMetrics} />
            ) : null}
            {memo ? (
              null
            ) : null}
          </section>
          {showTraceColumn ? (
            <>
              <button
                aria-label="Resize workspace and trace columns"
                className="column-resizer"
                onMouseDown={(event) =>
                  setDragState({
                    handle: "trace",
                    startX: event.clientX,
                    startLeft: columnWidths.left,
                    startRight: columnWidths.right
                  })
                }
                role="separator"
                type="button"
              />
              <aside className="trace-column progressive-panel">
                {tree ? (
                  <HypothesisTree
                    nodes={tree.nodes}
                    selectedNodeId={selectedNodeId}
                    highlightedNodeIds={highlightedNodeIds}
                    onSelectNode={setSelectedNodeId}
                  />
                ) : null}
                {evidence ? (
                  <EvidencePanel
                    selectedNodeId={selectedNodeId}
                    nodes={tree?.nodes ?? []}
                    evidence={evidence.evidenceCards}
                  />
                ) : null}
              </aside>
            </>
          ) : null}
          {memo ? (
            <section className="memo-span progressive-panel">
              <InvestmentMemo
                memo={memo}
                onSectionSelect={(nodeIds) => {
                  setHighlightedNodeIds(nodeIds);
                  setSelectedNodeId(nodeIds[0] ?? null);
                }}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function CompletedRunSummary({ phases }: { phases: AgentPhase[] }) {
  const completedCount = phases.filter((phase) => phase.status === "complete").length;

  return (
    <section className="completed-summary" aria-label="Completed research summary">
      <div>
        <h3>Deep Research complete</h3>
        <p>{completedCount}/7 steps complete</p>
      </div>
      <span>Collapsed</span>
    </section>
  );
}

function RunDiagnostics({ metrics }: { metrics: AgentTelemetryMetric[] }) {
  const phaseMetrics = metrics.filter((metric) => metric.kind === "phase");
  const requestMetrics = metrics.filter((metric) => metric.kind === "miromind-request");
  const repairCount = requestMetrics.filter((metric) => metric.attempt === "repair").length;
  const failedRequests = requestMetrics.filter((metric) => metric.status === "failed").length;
  const totalPhaseMs = phaseMetrics.reduce((sum, metric) => sum + metric.durationMs, 0);
  const latestMetrics = metrics.slice(-5);

  return (
    <section className="diagnostics-panel" aria-label="Run diagnostics">
      <div>
        <h3>Run Diagnostics</h3>
        <p>
          {formatDuration(totalPhaseMs)} measured · {requestMetrics.length} API calls ·{" "}
          {repairCount} repairs · {failedRequests} failed
        </p>
      </div>
      <ul>
        {latestMetrics.map((metric, index) => (
          <li key={`${metric.kind}-${index}-${metric.durationMs}`}>
            {metric.kind === "phase"
              ? `${metric.phase}: ${formatDuration(metric.durationMs)}`
              : `${metric.stageName} ${metric.attempt}: ${formatDuration(metric.durationMs)} ${metric.status}`}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}
