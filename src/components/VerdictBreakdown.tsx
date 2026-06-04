import type { ScoredNodesArtifact } from "@/lib/agent/types";

interface VerdictBreakdownProps {
  scored: ScoredNodesArtifact;
}

export function VerdictBreakdown({ scored }: VerdictBreakdownProps) {
  const maxAbs = Math.max(
    0.01,
    ...scored.nodes.map((node) => Math.abs(node.weightedScore))
  );

  return (
    <section className="verdict-breakdown" aria-label="Verdict breakdown">
      <div className="panel-heading">
        <p className="eyebrow">How the verdict adds up</p>
        <h3>
          {scored.finalStance} · support score {scored.finalScore}
        </h3>
      </div>
      <p className="verdict-explainer">
        The support score is an evidence-weighted sum of every hypothesis below
        (direction × source reliability × relevance × node weight). It is not a 0–100
        grade — positive favors the thesis, negative opposes it, and magnitude reflects
        how strong the evidence is.
      </p>
      <div className="verdict-scale" aria-label="Stance scale">
        <span>≥1.2 Supported</span>
        <span>≥0.25 Partially</span>
        <span>~0 Inconclusive</span>
        <span>≤−0.25 Weak</span>
        <span>≤−1.2 Not supported</span>
      </div>
      <ul className="verdict-list">
        {scored.nodes.map((node) => {
          const positive = node.weightedScore >= 0;
          const width = `${(Math.abs(node.weightedScore) / maxAbs) * 50}%`;
          return (
            <li className="verdict-row" key={node.id}>
              <span className="verdict-label">{node.label}</span>
              <div className="diverging-track">
                <span className="diverging-axis" aria-hidden="true" />
                <span
                  className={`diverging-fill ${positive ? "pos" : "neg"}`}
                  style={positive ? { left: "50%", width } : { right: "50%", width }}
                />
              </div>
              <small className="verdict-value">{node.weightedScore}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
