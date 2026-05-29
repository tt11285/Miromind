"use client";

import { companies, questionTemplates } from "@/lib/researchConfig";
import type { EvidencePreference, ResearchTask, TimeHorizon } from "@/lib/types";

interface ResearchSetupProps {
  task: ResearchTask;
  isRunning: boolean;
  onTaskChange: (task: ResearchTask) => void;
  onRun: () => void;
}

const horizons: TimeHorizon[] = ["3M", "12M", "3Y"];
const preferences: Array<{ id: EvidencePreference; label: string }> = [
  { id: "balanced", label: "Balanced" },
  { id: "financials", label: "Financials" },
  { id: "earnings", label: "Earnings calls" },
  { id: "news", label: "News/events" }
];

export function ResearchSetup({ task, isRunning, onTaskChange, onRun }: ResearchSetupProps) {
  return (
    <section className="setup-panel" aria-label="Research setup">
      <div>
        <p className="eyebrow">Research Setup</p>
        <h1>ValuationLens</h1>
        <p className="lede">Turn a stock question into an auditable memo.</p>
      </div>

      <label>
        Company
        <select
          value={task.companyId}
          onChange={(event) =>
            onTaskChange({ ...task, companyId: event.target.value as ResearchTask["companyId"] })
          }
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Research Question
        <select
          value={task.questionTemplateId}
          onChange={(event) =>
            onTaskChange({
              ...task,
              questionTemplateId: event.target.value as ResearchTask["questionTemplateId"]
            })
          }
        >
          {questionTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
            </option>
          ))}
        </select>
      </label>

      <div className="segmented" aria-label="Time horizon">
        {horizons.map((horizon) => (
          <button
            key={horizon}
            aria-pressed={task.timeHorizon === horizon}
            className={task.timeHorizon === horizon ? "active" : ""}
            onClick={() => onTaskChange({ ...task, timeHorizon: horizon })}
            type="button"
          >
            {horizon}
          </button>
        ))}
      </div>

      <label>
        Evidence Preference
        <select
          value={task.evidencePreference}
          onChange={(event) =>
            onTaskChange({
              ...task,
              evidencePreference: event.target.value as EvidencePreference
            })
          }
        >
          {preferences.map((preference) => (
            <option key={preference.id} value={preference.id}>
              {preference.label}
            </option>
          ))}
        </select>
      </label>

      <button className="primary-action" disabled={isRunning} onClick={onRun} type="button">
        {isRunning ? "Running Research" : "Run Deep Research"}
      </button>
    </section>
  );
}
