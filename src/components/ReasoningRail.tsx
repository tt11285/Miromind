import { Fragment } from "react";

export type RailState = "pending" | "active" | "done";

export interface RailStep {
  key: string;
  label: string;
  value: string;
  state: RailState;
}

interface ReasoningRailProps {
  steps: RailStep[];
}

export function ReasoningRail({ steps }: ReasoningRailProps) {
  return (
    <section className="reasoning-rail" aria-label="Reasoning chain">
      {steps.map((step, index) => (
        <Fragment key={step.key}>
          {index > 0 ? <span className="rail-connector" aria-hidden="true" /> : null}
          <div className={`rail-step ${step.state}`}>
            <span className="rail-index">{index + 1}</span>
            <div className="rail-meta">
              <small>{step.label}</small>
              <strong>{step.value}</strong>
            </div>
          </div>
        </Fragment>
      ))}
    </section>
  );
}
