"use client";

import type { AgentEvidenceCard, EvidenceProvenanceStatus } from "@/lib/agent/types";
import { useState } from "react";

interface SourcesSummaryProps {
  evidence: AgentEvidenceCard[];
}

const chipLabel: Record<EvidenceProvenanceStatus, string> = {
  verified: "verified",
  "model-reported": "reported",
  unavailable: "unverified"
};

function sourceHref(reference: string): string | null {
  const match = reference.match(/https?:\/\/[^\s)]+/i);
  return match ? match[0] : null;
}

export function SourcesSummary({ evidence }: SourcesSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (evidence.length === 0) {
    return null;
  }

  const verifiedCount = evidence.filter(
    (card) => card.provenanceStatus === "verified"
  ).length;

  return (
    <section className="sources-summary" aria-label="Sources">
      <button
        aria-expanded={isOpen}
        className="compact-panel-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <div>
          <p className="eyebrow">Provenance</p>
          <h2>Sources</h2>
        </div>
        <strong>
          {verifiedCount}/{evidence.length} verified
        </strong>
      </button>
      {isOpen ? (
        <ul className="sources-list">
          {evidence.map((card) => {
            const url = sourceHref(card.urlOrReference);
            return (
              <li className={`source-row ${card.provenanceStatus}`} key={card.id}>
                <span className={`provenance-chip ${card.provenanceStatus}`}>
                  {chipLabel[card.provenanceStatus]}
                </span>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    {card.sourceTitle}
                  </a>
                ) : (
                  <span>{card.sourceTitle}</span>
                )}
                <small>{card.sourceType}</small>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
