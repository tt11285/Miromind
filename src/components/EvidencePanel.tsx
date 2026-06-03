"use client";

import type {
  AgentEvidenceCard,
  EvidenceProvenanceStatus,
  HypothesisNodeDraft
} from "@/lib/agent/types";
import { useEffect, useMemo, useState } from "react";

interface EvidencePanelProps {
  selectedNodeId: string | null;
  nodes: HypothesisNodeDraft[];
  evidence: AgentEvidenceCard[];
  focusedEvidenceIds?: string[];
}

const provenanceLabel: Record<EvidenceProvenanceStatus, string> = {
  verified: "Source verified",
  "model-reported": "Model-reported",
  unavailable: "Unverified"
};

function sourceHref(reference: string): string | null {
  const match = reference.match(/https?:\/\/[^\s)]+/i);
  return match ? match[0] : null;
}

export function EvidencePanel({
  selectedNodeId,
  nodes,
  evidence,
  focusedEvidenceIds = []
}: EvidencePanelProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const node = nodes.find((item) => item.id === selectedNodeId) ?? null;
  const selectedEvidence = focusedEvidenceIds.length
    ? evidence.filter((card) => focusedEvidenceIds.includes(card.id))
    : node
      ? evidence.filter((card) => card.nodeId === node.id)
      : evidence;
  const nodeById = useMemo(
    () => new Map(nodes.map((item) => [item.id, item])),
    [nodes]
  );

  useEffect(() => {
    if (focusedEvidenceIds.length > 0 || selectedNodeId) {
      setIsPanelOpen(true);
    }
  }, [focusedEvidenceIds.length, selectedNodeId]);

  return (
    <section className="evidence-panel" aria-label="Evidence cards">
      <button
        aria-expanded={isPanelOpen}
        className="compact-panel-toggle"
        onClick={() => setIsPanelOpen((current) => !current)}
        type="button"
      >
        <div>
          <p className="eyebrow">Evidence Cards</p>
          <h2>
            {focusedEvidenceIds.length ? "Linked Evidence" : node ? node.label : "All Evidence"}
          </h2>
        </div>
        <strong>{selectedEvidence.length} cards</strong>
      </button>
      {isPanelOpen ? (
        <>
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
            className={[
              "evidence-card",
              "stack-card",
              card.direction,
              focusedEvidenceIds.includes(card.id) ? "focused" : ""
            ].join(" ")}
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
              <span className={`provenance-chip ${card.provenanceStatus}`}>
                {provenanceLabel[card.provenanceStatus]}
              </span>
            </small>
            {expandedCardId === card.id ? (
              <div className="stack-card-detail">
                <p>{card.extractedFact}</p>
                <blockquote>{card.quotedSnippet}</blockquote>
                <small>{card.reasoningImpact}</small>
                <small>
                  {card.sourceType} | {provenanceLabel[card.provenanceStatus]} |{" "}
                  {sourceHref(card.urlOrReference) ? (
                    <a
                      href={sourceHref(card.urlOrReference) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {card.urlOrReference}
                    </a>
                  ) : (
                    card.urlOrReference
                  )}
                </small>
              </div>
            ) : null}
          </button>
        ))}
      </div>
        </>
      ) : null}
    </section>
  );
}
