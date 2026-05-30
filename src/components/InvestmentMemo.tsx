import type { MemoArtifact } from "@/lib/agent/types";

interface InvestmentMemoProps {
  memo: MemoArtifact;
  onSectionSelect: (nodeIds: string[]) => void;
}

export function InvestmentMemo({ memo, onSectionSelect }: InvestmentMemoProps) {
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
        <button
          className="trace-button"
          key={section.id}
          onClick={() => onSectionSelect(section.linkedNodeIds)}
          type="button"
        >
          <span>{section.title}</span>
          <small>{section.body}</small>
        </button>
      ))}
    </section>
  );
}
