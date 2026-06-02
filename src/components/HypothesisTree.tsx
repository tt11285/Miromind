"use client";

import type { HypothesisNodeDraft, ScoredNode } from "@/lib/agent/types";
import { useState } from "react";

interface HypothesisTreeProps {
  nodes: HypothesisNodeDraft[];
  highlightedNodeIds: string[];
  selectedNodeId: string | null;
  scoredNodes?: ScoredNode[];
  onSelectNode: (nodeId: string) => void;
}

export function HypothesisTree({
  nodes,
  highlightedNodeIds,
  selectedNodeId,
  scoredNodes = [],
  onSelectNode
}: HypothesisTreeProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const scoreByNodeId = new Map(scoredNodes.map((node) => [node.id, node]));

  return (
    <section className="tree-panel" aria-label="Hypothesis tree">
      <button
        aria-expanded={isPanelOpen}
        className="compact-panel-toggle"
        onClick={() => setIsPanelOpen((current) => !current)}
        type="button"
      >
        <div>
          <p className="eyebrow">Reasoning Trace</p>
          <h2>Hypothesis Tree</h2>
        </div>
        <strong>{nodes.length} nodes</strong>
      </button>
      {isPanelOpen ? (
        <div className="tree-list">
        {nodes.map((node) => {
          const score = scoreByNodeId.get(node.id);
          return (
          <button
            aria-expanded={expandedNodeId === node.id}
            aria-pressed={selectedNodeId === node.id}
            className={[
              "tree-node",
              "stack-card",
              expandedNodeId === node.id ? "expanded" : "collapsed",
              selectedNodeId === node.id ? "selected" : "",
              highlightedNodeIds.includes(node.id) ? "highlighted" : ""
            ].join(" ")}
            key={node.id}
            onClick={() => {
              setExpandedNodeId((current) => (current === node.id ? null : node.id));
              onSelectNode(node.id);
            }}
            type="button"
          >
            <span className="stack-card-title">{node.label}</span>
            <strong>
              {score
                ? `${score.stance} | ${score.weightedScore}`
                : `${Math.round(node.weight * 100)}% weight`}
            </strong>
            {expandedNodeId === node.id ? (
              <div className="stack-card-detail">
                <p>{node.claim}</p>
                <small>{node.whyItMatters}</small>
                {score ? (
                  <div className="node-score-strip">
                    <span>Confidence: {score.confidence}</span>
                    <span>Score: {score.weightedScore}</span>
                    <span>
                      Evidence: {score.supportingEvidenceIds.length} support /{" "}
                      {score.counterEvidenceIds.length} counter
                    </span>
                  </div>
                ) : null}
                <small>
                  {node.evidenceNeeded.length} evidence needs |{" "}
                  {node.counterEvidenceNeeded.length} counter checks
                </small>
              </div>
            ) : null}
          </button>
        );
        })}
        </div>
      ) : null}
    </section>
  );
}
