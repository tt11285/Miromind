"use client";

import { createFixtureArtifacts } from "@/data/fixtures";
import { defaultResearchTask } from "@/lib/researchConfig";
import { scoreResearchArtifacts } from "@/lib/scoring";
import type { ResearchRun, ResearchTask } from "@/lib/types";
import { useState } from "react";
import { EvidencePanel } from "./EvidencePanel";
import { HypothesisTree } from "./HypothesisTree";
import { InvestmentMemo } from "./InvestmentMemo";
import { ResearchSetup } from "./ResearchSetup";
import { RunTimeline } from "./RunTimeline";

function createInitialRun(): ResearchRun {
  const artifacts = createFixtureArtifacts(defaultResearchTask);
  const scored = scoreResearchArtifacts(artifacts.nodes, artifacts.evidence);
  return {
    task: defaultResearchTask,
    rootQuestion: artifacts.rootQuestion,
    phases: [
      {
        name: "Task Framing",
        status: "complete",
        detail: "Normalized the company, question template, time horizon, and evidence preference."
      },
      {
        name: "Hypothesis Generation",
        status: "complete",
        detail: "Built a five-node hypothesis tree for the selected research question."
      },
      {
        name: "Evidence Collection",
        status: "complete",
        detail: "Retrieved curated evidence cards and mapped each card to a hypothesis node."
      },
      {
        name: "Evidence Scoring",
        status: "complete",
        detail: "Scored reliability, relevance, freshness, and evidence direction."
      },
      {
        name: "Reasoning Synthesis",
        status: "complete",
        detail: "Synthesized node-level conclusions from supporting and counter-evidence."
      },
      {
        name: "Memo Rendering",
        status: "complete",
        detail: "Rendered the final investment memo from traceable structured artifacts."
      }
    ],
    nodes: scored.nodes,
    evidence: artifacts.evidence,
    memo: scored.memo,
    mode: "fixture"
  };
}

const initialRun = createInitialRun();

export function ResearchWorkbench() {
  const [task, setTask] = useState<ResearchTask>(defaultResearchTask);
  const [run, setRun] = useState<ResearchRun>(initialRun);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialRun.nodes[0]?.id ?? null
  );
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);

  async function handleRun() {
    setIsRunning(true);
    try {
      const response = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task)
      });
      if (!response.ok) {
        throw new Error("Research API returned a non-success response");
      }
      const payload = (await response.json()) as { run: ResearchRun };
      setRun(payload.run);
      setSelectedNodeId(payload.run.nodes[0]?.id ?? null);
      setHighlightedNodeIds([]);
    } catch {
      const artifacts = createFixtureArtifacts(task);
      const scored = scoreResearchArtifacts(artifacts.nodes, artifacts.evidence);
      setRun({
        task,
        rootQuestion: artifacts.rootQuestion,
        phases: initialRun.phases,
        nodes: scored.nodes,
        evidence: artifacts.evidence,
        memo: scored.memo,
        mode: "fixture"
      });
      setSelectedNodeId(scored.nodes[0]?.id ?? null);
      setHighlightedNodeIds([]);
    } finally {
      setIsRunning(false);
    }
  }

  function handleMemoSectionSelect(nodeIds: string[]) {
    setHighlightedNodeIds(nodeIds);

    const firstLinkedNodeId = nodeIds.find((nodeId) =>
      run.nodes.some((node) => node.id === nodeId)
    );
    if (firstLinkedNodeId) {
      setSelectedNodeId(firstLinkedNodeId);
    }
  }

  const selectedNode = run.nodes.find((node) => node.id === selectedNodeId) ?? null;

  return (
    <main className="app-shell">
      <ResearchSetup
        task={task}
        isRunning={isRunning}
        onTaskChange={setTask}
        onRun={handleRun}
      />
      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Deep Research Track</p>
            <h2>{run.rootQuestion}</h2>
          </div>
          <span className="mode-pill">{run.mode}</span>
        </div>
        <RunTimeline phases={run.phases} />
        <InvestmentMemo memo={run.memo} onSectionSelect={handleMemoSectionSelect} />
      </section>
      <aside className="trace-column">
        <HypothesisTree
          nodes={run.nodes}
          selectedNodeId={selectedNodeId}
          highlightedNodeIds={highlightedNodeIds}
          onSelectNode={setSelectedNodeId}
        />
        <EvidencePanel node={selectedNode} evidence={run.evidence} />
      </aside>
    </main>
  );
}
