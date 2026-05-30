import type { AgentEvidenceCard, HypothesisNodeDraft } from "@/lib/agent/types";

interface EvidencePanelProps {
  selectedNodeId: string | null;
  nodes: HypothesisNodeDraft[];
  evidence: AgentEvidenceCard[];
}

export function EvidencePanel({ selectedNodeId, nodes, evidence }: EvidencePanelProps) {
  const node = nodes.find((item) => item.id === selectedNodeId) ?? null;
  const selectedEvidence = node
    ? evidence.filter((card) => card.nodeId === node.id)
    : evidence.slice(0, 4);

  return (
    <section className="evidence-panel" aria-label="Evidence cards">
      <div className="panel-heading">
        <p className="eyebrow">Evidence Cards</p>
        <h2>{node ? node.label : "Selected Evidence"}</h2>
      </div>
      {node ? (
        <div className="reasoning-note">
          <strong>Why It Matters</strong>
          <p>{node.whyItMatters}</p>
          <strong>What Would Change</strong>
          <p>{node.counterEvidenceNeeded.join("; ")}</p>
        </div>
      ) : null}
      <div className="evidence-list">
        {selectedEvidence.map((card) => (
          <article className={`evidence-card ${card.direction}`} key={card.id}>
            <div>
              <strong>{card.sourceTitle}</strong>
              <span>{card.sourceDate}</span>
            </div>
            <p>{card.extractedFact}</p>
            <small>{card.reasoningImpact}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
