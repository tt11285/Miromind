"use client";

import type { AgentEvidenceCard, HypothesisNodeDraft } from "@/lib/agent/types";
import { useMemo, useState } from "react";

interface EvidencePanelProps {
  selectedNodeId: string | null;
  nodes: HypothesisNodeDraft[];
  evidence: AgentEvidenceCard[];
}

export function EvidencePanel({ selectedNodeId, nodes, evidence }: EvidencePanelProps) {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const node = nodes.find((item) => item.id === selectedNodeId) ?? null;
  const selectedEvidence = node
    ? evidence.filter((card) => card.nodeId === node.id)
    : evidence;
  const nodeById = useMemo(
    () => new Map(nodes.map((item) => [item.id, item])),
    [nodes]
  );

  return (
    <section className="evidence-panel" aria-label="Evidence cards">
      <div className="panel-heading">
        <p className="eyebrow">Evidence Cards</p>
        <h2>{node ? node.label : "All Evidence"}</h2>
      </div>
      {node ? (
        <button
          aria-expanded={isReasoningOpen}
          className="reasoning-note stack-card"
          onClick={() => setIsReasoningOpen((current) => !current)}
          type="button"
        >
          <strong>Node reasoning</strong>
          <span>{isReasoningOpen ? "Collapse" : "Expand"}</span>
          {isReasoningOpen ? (
            <div className="stack-card-detail">
              <strong>Why It Matters</strong>
              <p>{node.whyItMatters}</p>
              <strong>What Would Change</strong>
              <p>{node.counterEvidenceNeeded.join("; ")}</p>
            </div>
          ) : null}
        </button>
      ) : null}
      <div className="evidence-list">
        {selectedEvidence.map((card) => (
          <button
            aria-expanded={expandedCardId === card.id}
            className={`evidence-card stack-card ${card.direction}`}
            key={card.id}
            onClick={() =>
              setExpandedCardId((current) => (current === card.id ? null : card.id))
            }
            type="button"
          >
            <div>
              <strong>{card.sourceTitle}</strong>
              <span>{card.sourceDate}</span>
            </div>
            <small>
              {nodeById.get(card.nodeId)?.label ?? card.nodeId} | {card.direction}
            </small>
            {expandedCardId === card.id ? (
              <div className="stack-card-detail">
                <p>{card.extractedFact}</p>
                <blockquote>{card.quotedSnippet}</blockquote>
                <small>{card.reasoningImpact}</small>
                <small>
                  {card.sourceType} | {card.provenanceStatus} | {card.urlOrReference}
                </small>
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}
