"use client";

import type { HypothesisNodeDraft } from "@/lib/agent/types";
import { useState } from "react";

interface HypothesisTreeProps {
  nodes: HypothesisNodeDraft[];
  highlightedNodeIds: string[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function HypothesisTree({
  nodes,
  highlightedNodeIds,
  selectedNodeId,
  onSelectNode
}: HypothesisTreeProps) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  return (
    <section className="tree-panel" aria-label="Hypothesis tree">
      <div className="panel-heading">
        <p className="eyebrow">Reasoning Trace</p>
        <h2>Hypothesis Tree</h2>
      </div>
      <div className="tree-list">
        {nodes.map((node) => (
          <button
            aria-expanded={expandedNodeId === node.id}
            aria-pressed={selectedNodeId === node.id}
            className={[
              "tree-node",
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
            <strong>{Math.round(node.weight * 100)}% weight</strong>
            {expandedNodeId === node.id ? (
              <div className="stack-card-detail">
                <p>{node.claim}</p>
                <small>{node.whyItMatters}</small>
                <small>
                  {node.evidenceNeeded.length} evidence needs |{" "}
                  {node.counterEvidenceNeeded.length} counter checks
                </small>
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}
