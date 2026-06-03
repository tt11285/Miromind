"use client";

import type {
  AgentArtifact,
  AgentEvent,
  AgentEvidenceCard,
  AgentPhase,
  AgentRequest,
  AgentTelemetryMetric,
  EvidenceCardsArtifact,
  HypothesisTreeArtifact,
  MemoArtifact,
  MemoClaim,
  ScoredNodesArtifact
} from "@/lib/agent/types";
import { parseJsonLines } from "@/lib/agent/streamClient";
import { useEffect, useState } from "react";
import { AgentInputPanel } from "./AgentInputPanel";
import { AgentRunTimeline } from "./AgentRunTimeline";
import { AuditTrail } from "./AuditTrail";
import { EvidencePanel } from "./EvidencePanel";
import { HypothesisTree } from "./HypothesisTree";
import { InvestmentMemo } from "./InvestmentMemo";

type WorkbenchStage = "intro" | "running" | "complete" | "error";

interface EvidenceTaskView {
  nodeId: string;
  title: string;
  prompt: string;
  status: "queued" | "running" | "complete";
  evidenceCards: AgentEvidenceCard[];
  retryMessage?: string;
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

export function LiveResearchWorkbench() {
  const [modeLabel, setModeLabel] =
    useState<"Live Agent" | "Demo Fallback" | "Error">("Demo Fallback");
  const [isRunning, setIsRunning] = useState(false);
  const [phases, setPhases] = useState<AgentPhase[]>(initialPhases);
  const [tree, setTree] = useState<HypothesisTreeArtifact | null>(null);
  const [evidence, setEvidence] = useState<EvidenceCardsArtifact | null>(null);
  const [scoredNodes, setScoredNodes] = useState<ScoredNodesArtifact | null>(null);
  const [memo, setMemo] = useState<MemoArtifact | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<MemoClaim | null>(null);
  const [focusedEvidenceIds, setFocusedEvidenceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [telemetryMetrics, setTelemetryMetrics] = useState<AgentTelemetryMetric[]>([]);
  const [workbenchStage, setWorkbenchStage] = useState<WorkbenchStage>("intro");
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [evidenceTasks, setEvidenceTasks] = useState<EvidenceTaskView[]>([]);
  const [expandedEvidenceTaskIndex, setExpandedEvidenceTaskIndex] = useState<number | null>(null);
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
    setScoredNodes(null);
    setMemo(null);
    setSelectedNodeId(null);
    setHighlightedNodeIds([]);
    setSelectedClaim(null);
    setFocusedEvidenceIds([]);
    setIsTimelineExpanded(false);
    setEvidenceTasks([]);
    setExpandedEvidenceTaskIndex(null);
    setTelemetryMetrics([]);
    setPhases(initialPhases());

    let latestTree: HypothesisTreeArtifact | null = null;
    let runFailure: string | null = null;

    function applyArtifact(artifact: AgentArtifact) {
      switch (artifact.type) {
        case "hypothesis-tree":
          latestTree = artifact;
          setTree(artifact);
          setSelectedNodeId(null);
          break;
        case "evidence-plan":
          setEvidenceTasks(
            artifact.items.map((item) => ({
              nodeId: item.nodeId,
              title:
                latestTree?.nodes.find((node) => node.id === item.nodeId)?.label ?? item.nodeId,
              prompt: item.researchQuestions[0] ?? "Evidence research task",
              status: "queued",
              evidenceCards: []
            }))
          );
          break;
        case "evidence-cards":
          setEvidence(artifact);
          setEvidenceTasks((current) =>
            current.map((task) => {
              const cards = artifact.evidenceCards.filter((card) => card.nodeId === task.nodeId);
              return cards.length > 0
                ? { ...task, status: "complete", evidenceCards: cards }
                : task;
            })
          );
          break;
        case "scored-nodes":
          setScoredNodes(artifact);
          break;
        case "memo":
          setMemo(artifact);
          break;
        default:
          break;
      }
    }

    try {
      const cleanedRequest = sanitizeAgentRequest(request);
      const response = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedRequest)
      });

      if (!response.ok || !response.body) {
        throw new Error(await extractErrorMessage(response));
      }

      for await (const event of parseJsonLines<AgentEvent>(response.body)) {
        switch (event.type) {
          case "run-started":
            setModeLabel(event.mode === "demo-fallback" ? "Demo Fallback" : "Live Agent");
            break;
          case "phase-started":
            updatePhase(event.phase, "running", event.detail);
            if (event.phase === "Evidence Research") {
              setEvidenceTasks((current) =>
                current.map((task) =>
                  task.status === "queued" ? { ...task, status: "running" } : task
                )
              );
            }
            break;
          case "phase-completed":
            updatePhase(event.phase, "complete", event.detail);
            if (event.phase === "Evidence Research") {
              setEvidenceTasks((current) =>
                current.map((task) =>
                  task.status === "complete" ? task : { ...task, status: "complete" }
                )
              );
            }
            break;
          case "phase-failed":
            updatePhase(event.phase, "failed", event.error);
            break;
          case "telemetry":
            appendTelemetry([event.metric]);
            break;
          case "artifact":
            applyArtifact(event.artifact);
            break;
          case "run-failed":
            runFailure = event.error;
            break;
          case "run-completed":
          default:
            break;
        }
      }
    } catch (runError) {
      runFailure = runError instanceof Error ? runError.message : "Research run failed.";
    } finally {
      setIsRunning(false);
    }

    if (runFailure) {
      handleRunFailure(runFailure);
      return;
    }
    setWorkbenchStage("complete");
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
              <CompletedRunSummary
                isExpanded={isTimelineExpanded}
                onToggle={() => setIsTimelineExpanded((current) => !current)}
                phases={phases}
              />
            ) : (
              <AgentRunTimeline phases={renderedPhases} />
            )}
            {workbenchStage === "complete" && isTimelineExpanded ? (
              <AgentRunTimeline phases={phases} />
            ) : null}
            {evidenceTasks.length > 0 ? (
              <EvidenceTaskBoard
                expandedIndex={expandedEvidenceTaskIndex}
                onToggle={(index) =>
                  setExpandedEvidenceTaskIndex((current) =>
                    current === index ? null : index
                  )
                }
                tasks={evidenceTasks}
              />
            ) : null}
            {telemetryMetrics.length > 0 && workbenchStage !== "complete" ? (
              <RunDiagnostics metrics={telemetryMetrics} />
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
                    scoredNodes={scoredNodes?.nodes ?? []}
                    onSelectNode={(nodeId) => {
                      setSelectedNodeId(nodeId);
                      setSelectedClaim(null);
                      setFocusedEvidenceIds([]);
                    }}
                  />
                ) : null}
                {evidence ? (
                  <EvidencePanel
                    selectedNodeId={selectedNodeId}
                    nodes={tree?.nodes ?? []}
                    evidence={evidence.evidenceCards}
                    focusedEvidenceIds={focusedEvidenceIds}
                  />
                ) : null}
              </aside>
            </>
          ) : null}
          {memo ? (
            <section className="memo-span progressive-panel">
              <InvestmentMemo
                memo={memo}
                selectedClaimId={selectedClaim?.id ?? null}
                onClaimSelect={(claim) => {
                  setSelectedClaim(claim);
                  setHighlightedNodeIds(claim.linkedNodeIds);
                  setSelectedNodeId(claim.linkedNodeIds[0] ?? null);
                  setFocusedEvidenceIds(claim.linkedEvidenceIds);
                }}
              />
              <AuditTrail
                claim={selectedClaim}
                evidence={evidence?.evidenceCards ?? []}
                nodes={tree?.nodes ?? []}
                scoredNodes={scoredNodes?.nodes ?? []}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function CompletedRunSummary({
  isExpanded,
  onToggle,
  phases
}: {
  isExpanded: boolean;
  onToggle: () => void;
  phases: AgentPhase[];
}) {
  const completedCount = phases.filter((phase) => phase.status === "complete").length;

  return (
    <button
      aria-expanded={isExpanded}
      className="completed-summary compact-card-button"
      onClick={onToggle}
      type="button"
    >
      <div>
        <h3>Deep Research complete</h3>
        <p>{completedCount}/7 steps complete</p>
      </div>
      <span>{isExpanded ? "Collapse" : "Expand"}</span>
    </button>
  );
}

function EvidenceTaskBoard({
  expandedIndex,
  onToggle,
  tasks
}: {
  expandedIndex: number | null;
  onToggle: (index: number) => void;
  tasks: EvidenceTaskView[];
}) {
  const completedCount = tasks.filter((task) => task.status === "complete").length;
  const runningTasks = tasks.filter((task) => task.status === "running");

  return (
    <section className="evidence-task-board" aria-label="Evidence research tasks">
      <div className="compact-section-heading">
        <div>
          <p className="eyebrow">Evidence Research</p>
          <h3>{completedCount}/{tasks.length} evidence tasks complete</h3>
        </div>
        {runningTasks.length > 0 ? (
          <span>Researching {runningTasks.map((task) => task.title).join(", ")}</span>
        ) : null}
      </div>
      <div className="evidence-task-list">
        {tasks.map((task, index) => (
          <button
            aria-expanded={expandedIndex === index}
            className={`evidence-task-card stack-card ${task.status}`}
            key={task.nodeId}
            onClick={() => onToggle(index)}
            type="button"
          >
            <div className="evidence-task-summary">
              <strong>{task.title}</strong>
              <span>{task.status}</span>
            </div>
            <small>{task.prompt}</small>
            {expandedIndex === index ? (
              <div className="stack-card-detail">
                {task.evidenceCards.length > 0 ? (
                  task.evidenceCards.map((card) => (
                    <article className="task-evidence-detail" key={card.id}>
                      <strong>{card.sourceTitle}</strong>
                      <p>{card.extractedFact}</p>
                      <blockquote>{card.quotedSnippet}</blockquote>
                      <small>
                        {card.sourceType} | {card.sourceDate} | {card.urlOrReference}
                      </small>
                      <small>{card.reasoningImpact}</small>
                    </article>
                  ))
                ) : (
                  <p>Still researching this evidence task.</p>
                )}
              </div>
            ) : null}
          </button>
        ))}
      </div>
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
