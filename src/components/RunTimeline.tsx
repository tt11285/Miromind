import type { RunPhase } from "@/lib/types";

export function RunTimeline({ phases }: { phases: RunPhase[] }) {
  return (
    <section className="timeline" aria-label="Agent workflow">
      {phases.map((phase, index) => (
        <div className="timeline-step" key={phase.name}>
          <span className="step-index">{index + 1}</span>
          <div>
            <strong>{phase.name}</strong>
            <p>{phase.detail}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
