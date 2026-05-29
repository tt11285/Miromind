import { describe, expect, it } from "vitest";
import { defaultResearchTask } from "./researchConfig";
import { runResearch } from "./orchestrator";

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
    expect(run.nodes).toHaveLength(5);
    expect(run.memo.finalStance).toBe("Partially Supported");
  });

  it("uses an optional reasoner note when provided", async () => {
    const run = await runResearch(defaultResearchTask, {
      reasoner: async () => ({
        summary: "MiroMind confirms that valuation sensitivity is the key caveat."
      })
    });
    expect(run.mode).toBe("miromind-augmented");
    expect(run.memo.sections[0].body).toContain("MiroMind confirms");
  });
});
