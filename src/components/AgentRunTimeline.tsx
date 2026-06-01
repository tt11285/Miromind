import type { AgentPhase } from "@/lib/agent/types";

interface AgentRunTimelineProps {
  phases: AgentPhase[];
}

const loadingCopy: Record<AgentPhase["name"], string> = {
  "Task Framing": "Reading the question and framing the decision.",
  "Hypothesis Generation": "Building the hypothesis tree.",
  "Evidence Planning": "Planning source checks.",
  "Evidence Research": "Collecting evidence.",
  "Evidence Scoring": "Scoring support and counter-evidence.",
  "Reasoning Synthesis": "Reconciling the findings.",
  "Memo Rendering": "Writing the final memo."
};

export function AgentRunTimeline({ phases }: AgentRunTimelineProps) {
  return (
    <section className="timeline" aria-label="Agent run timeline">
      {phases.map((phase, index) => (
        <article className={`timeline-step ${phase.status}`} key={`${phase.name}-${index}`}>
          <span className="step-index">{index + 1}</span>
          <div>
            <h3>{phase.name}</h3>
            <p>{phase.detail}</p>
            {phase.status === "running" ? (
              <div className="phase-loading" aria-label={`${phase.name} loading`}>
                <span>{loadingCopy[phase.name]}</span>
                <strong>Thinking</strong>
                <i />
                <i />
                <i />
              </div>
            ) : null}
            <small>{phase.status}</small>
          </div>
        </article>
      ))}
    </section>
  );
}
