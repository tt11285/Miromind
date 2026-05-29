import type { EvidenceCard, NodeConclusion } from "@/lib/types";

interface EvidencePanelProps {
  node: NodeConclusion | null;
  evidence: EvidenceCard[];
}

export function EvidencePanel({ node, evidence }: EvidencePanelProps) {
  const visibleEvidence = node
    ? evidence.filter((card) => card.claimNodeId === node.id)
    : evidence.slice(0, 4);

  return (
    <section className="evidence-panel" aria-label="Evidence cards">
      <div className="panel-heading">
        <p className="eyebrow">Evidence Cards</p>
        <h2>{node ? node.label : "Selected Evidence"}</h2>
      </div>
      {node ? (
        <div className="reasoning-note">
          <strong>Reasoning Note</strong>
          <p>{node.reasoningNote}</p>
          <strong>What Would Change</strong>
          <p>{node.whatWouldChange}</p>
        </div>
      ) : null}
      <div className="evidence-list">
        {visibleEvidence.map((card) => (
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
