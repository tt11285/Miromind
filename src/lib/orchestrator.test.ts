import { describe, expect, it, vi } from "vitest";
import { defaultResearchTask } from "./researchConfig";
import { runResearch, type ResearchReasoner } from "./orchestrator";
import type { ResearchTask } from "./types";

describe("research orchestrator", () => {
  it("returns a complete six-stage research run", async () => {
    const run = await runResearch(defaultResearchTask);
    expect(run.mode).toBe("fixture");
    expect(run.phases.map((phase) => phase.name)).toEqual([
      "Task Framing",
      "Hypothesis Generation",
      "Evidence Collection",
      "Evidence Scoring",
      "Reasoning Synthesis",
      "Memo Rendering"
    ]);
    expect(run.phases.every((phase) => phase.status === "complete")).toBe(true);
    expect(run.rootQuestion).toBe(
      "Is NVIDIA's current valuation justified by AI growth fundamentals?"
    );
    expect(run.nodes).toHaveLength(5);
    expect(run.memo.finalStance).toBe("Partially Supported");
  });

  it("uses an optional reasoner note when provided", async () => {
    const fixtureRun = await runResearch(defaultResearchTask);
    const run = await runResearch(defaultResearchTask, {
      reasoner: async () => ({
        summary: "MiroMind confirms that valuation sensitivity is the key caveat."
      })
    });
    expect(run.mode).toBe("miromind-augmented");
    expect(run.memo.sections[0].body).toContain(fixtureRun.memo.sections[0].body);
    expect(run.memo.sections[0].body).toContain("MiroMind confirms");
  });

  it("passes the normalized non-default root question and node labels to the reasoner", async () => {
    const task: ResearchTask = {
      companyId: "msft",
      questionTemplateId: "valuation-growth",
      timeHorizon: "3Y",
      evidencePreference: "balanced"
    };
    const reasoner = vi.fn<ResearchReasoner>(async () => ({
      summary: "MiroMind used the normalized Microsoft context."
    }));

    const run = await runResearch(task, { reasoner });
    const reasonerInput = reasoner.mock.calls[0][0];

    expect(run.rootQuestion).toBe(
      "Microsoft (MSFT) over 3Y: Is the current valuation justified by growth fundamentals?"
    );
    expect(reasonerInput.rootQuestion).toBe(run.rootQuestion);
    expect(reasonerInput.nodeLabels).toEqual([
      "Revenue Growth",
      "Margin Durability",
      "Demand Sustainability",
      "Competitive Moat",
      "Valuation Sensitivity"
    ]);
    expect(Object.keys(reasonerInput).sort()).toEqual([
      "nodeLabels",
      "rootQuestion",
      "task"
    ]);
  });
});
