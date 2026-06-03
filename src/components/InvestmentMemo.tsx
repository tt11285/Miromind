import type { AgentEvidenceCard, MemoArtifact, MemoClaim } from "@/lib/agent/types";

interface InvestmentMemoProps {
  memo: MemoArtifact;
  evidence?: AgentEvidenceCard[];
  selectedClaimId: string | null;
  onClaimSelect: (claim: MemoClaim) => void;
}

export function InvestmentMemo({
  memo,
  evidence = [],
  selectedClaimId,
  onClaimSelect
}: InvestmentMemoProps) {
  const citationOrdinal = new Map(evidence.map((card, index) => [card.id, index + 1]));
  const evidenceById = new Map(evidence.map((card) => [card.id, card]));

  return (
    <section className="memo-panel" aria-label="Investment memo">
      <div className="memo-hero">
        <p className="eyebrow">Interactive Investment Memo</p>
        <h2>{memo.finalStance}</h2>
        <p>{memo.executiveSummary}</p>
        <div className="stance-row">
          <span>Confidence: {memo.confidence}</span>
          <span>Score: {memo.finalScore}</span>
        </div>
      </div>

      <div className="memo-grid">
        <article>
          <h3>Key Drivers</h3>
          <ul>
            {memo.keyDrivers.map((driver, index) => (
              <li key={`${driver}-${index}`}>{driver}</li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Biggest Counterargument</h3>
          <p>{memo.biggestCounterargument}</p>
        </article>
      </div>

      <article className="memo-section">
        <h3>What Would Change The View</h3>
        <ul>
          {memo.whatWouldChangeTheView.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="memo-section">
        <h3>Human Review Checklist</h3>
        <ul>
          {memo.humanReviewChecklist.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </article>

      {memo.sections.map((section) => (
        <div className="trace-button-group" key={section.id}>
          <button
            className="trace-button"
            onClick={() =>
              onClaimSelect({
                id: `section-${section.id}`,
                claimType: "section",
                text: section.body,
                linkedNodeIds: section.linkedNodeIds,
                linkedEvidenceIds: section.linkedEvidenceIds
              })
            }
            type="button"
          >
            <span>{section.title}</span>
            <small>{section.body}</small>
          </button>
          {section.linkedEvidenceIds.length > 0 ? (
            <div className="citation-row" aria-label={`Sources for ${section.title}`}>
              <span className="citation-label">Sources</span>
              {section.linkedEvidenceIds.map((evidenceId) => {
                const card = evidenceById.get(evidenceId);
                const ordinal = citationOrdinal.get(evidenceId);
                return (
                  <button
                    className="citation-chip"
                    key={evidenceId}
                    title={card?.sourceTitle ?? evidenceId}
                    onClick={() =>
                      onClaimSelect({
                        id: `cite-${evidenceId}`,
                        claimType: "section",
                        text: card?.extractedFact ?? section.body,
                        linkedNodeIds: card ? [card.nodeId] : section.linkedNodeIds,
                        linkedEvidenceIds: [evidenceId]
                      })
                    }
                    type="button"
                  >
                    [{ordinal ?? "?"}]
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}

      <section className="claim-panel" aria-label="Memo claims">
        <div className="panel-heading">
          <p className="eyebrow">Claim-Level Trace</p>
          <h3>Auditable Memo Claims</h3>
        </div>
        <div className="claim-list">
          {memo.claims.map((claim) => (
            <button
              className={`claim-button ${selectedClaimId === claim.id ? "selected" : ""}`}
              key={claim.id}
              onClick={() => onClaimSelect(claim)}
              type="button"
            >
              <span>{labelForClaimType(claim.claimType)}</span>
              <strong>{claim.text}</strong>
              <small>
                {claim.linkedNodeIds.length} nodes | {claim.linkedEvidenceIds.length} evidence cards
              </small>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

function labelForClaimType(claimType: MemoClaim["claimType"]): string {
  const labels: Record<MemoClaim["claimType"], string> = {
    "executive-summary": "Executive",
    driver: "Driver",
    counterargument: "Counter",
    "view-change": "Change",
    "human-review": "Review",
    section: "Section"
  };
  return labels[claimType];
}
