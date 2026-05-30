import type { AgentPhase } from "@/lib/agent/types";

interface AgentRunTimelineProps {
  phases: AgentPhase[];
}

export function AgentRunTimeline({ phases }: AgentRunTimelineProps) {
  return (
    <section className="timeline" aria-label="Agent run timeline">
      {phases.map((phase, index) => (
        <article className={`timeline-step ${phase.status}`} key={`${phase.name}-${index}`}>
          <span className="step-index">{index + 1}</span>
          <div>
            <h3>{phase.name}</h3>
            <p>{phase.detail}</p>
            <small>{phase.status}</small>
          </div>
        </article>
      ))}
    </section>
  );
}
