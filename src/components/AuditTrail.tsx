import type {
  AgentEvidenceCard,
  HypothesisNodeDraft,
  MemoClaim,
  ScoredNode
} from "@/lib/agent/types";

interface AuditTrailProps {
  claim: MemoClaim | null;
  evidence: AgentEvidenceCard[];
  nodes: HypothesisNodeDraft[];
  scoredNodes: ScoredNode[];
}

function sourceHref(reference: string): string | null {
  const match = reference.match(/https?:\/\/[^\s)]+/i);
  return match ? match[0] : null;
}

export function AuditTrail({
  claim,
  evidence,
  nodes,
  scoredNodes
}: AuditTrailProps) {
  if (!claim) {
    return null;
  }

  const linkedNodes = claim.linkedNodeIds
    .map((nodeId) => nodes.find((node) => node.id === nodeId))
    .filter((node): node is HypothesisNodeDraft => Boolean(node));
  const linkedEvidence = claim.linkedEvidenceIds
    .map((evidenceId) => evidence.find((card) => card.id === evidenceId))
    .filter((card): card is AgentEvidenceCard => Boolean(card));
  const scoreByNodeId = new Map(scoredNodes.map((node) => [node.id, node]));

  return (
    <section className="audit-panel" aria-label="Audit trail">
      <div className="panel-heading">
        <p className="eyebrow">Audit Trail</p>
        <h2>{claim.text}</h2>
      </div>
      <div className="audit-grid">
        <article>
          <h3>Linked Hypothesis Nodes</h3>
          {linkedNodes.map((node) => {
            const score = scoreByNodeId.get(node.id);
            return (
              <div className="audit-row" key={node.id}>
                <strong>{node.label}</strong>
                <p>{node.claim}</p>
                {score ? (
                  <small>
                    {score.stance} | score {score.weightedScore} | {score.confidence}
                  </small>
                ) : null}
              </div>
            );
          })}
        </article>
        <article>
          <h3>Linked Evidence Cards</h3>
          {linkedEvidence.map((card) => {
            const url = sourceHref(card.urlOrReference);
            return (
              <div className="audit-row" key={card.id}>
                <strong>{card.sourceTitle}</strong>
                <p>{card.extractedFact}</p>
                <blockquote>{card.quotedSnippet}</blockquote>
                <small>
                  {card.direction} | {card.provenanceStatus} |{" "}
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      {card.urlOrReference}
                    </a>
                  ) : (
                    card.urlOrReference
                  )}
                </small>
              </div>
            );
          })}
        </article>
      </div>
    </section>
  );
}
