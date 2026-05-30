"use client";

import { parseJsonLines } from "@/lib/agent/streamClient";
import type {
  AgentEvent,
  AgentPhase,
  AgentRequest,
  EvidenceCardsArtifact,
  HypothesisTreeArtifact,
  MemoArtifact
} from "@/lib/agent/types";
import { useEffect, useState } from "react";
import { AgentInputPanel } from "./AgentInputPanel";
import { AgentRunTimeline } from "./AgentRunTimeline";
import { EvidencePanel } from "./EvidencePanel";
import { HypothesisTree } from "./HypothesisTree";
import { InvestmentMemo } from "./InvestmentMemo";

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

  useEffect(() => {
    fetch("/api/research/status")
      .then((response) => response.json())
      .then((status: { liveAvailable: boolean }) => {
        setModeLabel(status.liveAvailable ? "Live Agent" : "Demo Fallback");
      })
      .catch(() => setModeLabel("Error"));
  }, []);

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
    setIsRunning(true);
    setError(null);
    setTree(null);
    setEvidence(null);
    setMemo(null);
    setSelectedNodeId(null);
    setHighlightedNodeIds([]);
    setPhases(initialPhases());

    try {
      const response = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });

      if (!response.body) {
        setError("Research run did not return a stream.");
        return;
      }

      for await (const event of parseJsonLines<AgentEvent>(response.body)) {
        handleEvent(event);
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Research run failed.");
    } finally {
      setIsRunning(false);
    }
  }

  function handleEvent(event: AgentEvent) {
    if (event.type === "run-started") {
      setModeLabel(event.mode === "live-agent" ? "Live Agent" : "Demo Fallback");
    }
    if (event.type === "phase-started") {
      updatePhase(event.phase, "running", event.detail);
    }
    if (event.type === "phase-completed") {
      updatePhase(event.phase, "complete", event.detail);
    }
    if (event.type === "phase-failed") {
      updatePhase(event.phase, "failed", event.error);
    }
    if (event.type === "artifact") {
      if (event.artifact.type === "hypothesis-tree") {
        setTree(event.artifact);
        setSelectedNodeId(event.artifact.nodes[0]?.id ?? null);
      }
      if (event.artifact.type === "evidence-cards") {
        setEvidence(event.artifact);
      }
      if (event.artifact.type === "memo") {
        setMemo(event.artifact);
      }
    }
    if (event.type === "run-completed" && event.run.phases.length > 0) {
      setPhases(event.run.phases);
    }
    if (event.type === "run-failed") {
      setError(event.error);
    }
  }

  return (
    <main className="app-shell">
      <AgentInputPanel isRunning={isRunning} modeLabel={modeLabel} onRun={handleRun} />
      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">MiroMind Deep Research</p>
            <h2>{tree?.rootQuestion ?? "Run a listed-company research question"}</h2>
          </div>
          <span className="mode-pill">{modeLabel}</span>
        </div>
        {error ? <div className="error-panel">{error}</div> : null}
        <AgentRunTimeline phases={phases} />
        {memo ? (
          <InvestmentMemo
            memo={memo}
            onSectionSelect={(nodeIds) => {
              setHighlightedNodeIds(nodeIds);
              setSelectedNodeId(nodeIds[0] ?? null);
            }}
          />
        ) : null}
      </section>
      <aside className="trace-column">
        <HypothesisTree
          nodes={tree?.nodes ?? []}
          selectedNodeId={selectedNodeId}
          highlightedNodeIds={highlightedNodeIds}
          onSelectNode={setSelectedNodeId}
        />
        <EvidencePanel
          selectedNodeId={selectedNodeId}
          nodes={tree?.nodes ?? []}
          evidence={evidence?.evidenceCards ?? []}
        />
      </aside>
    </main>
  );
}
