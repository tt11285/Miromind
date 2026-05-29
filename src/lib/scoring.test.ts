import { describe, expect, it } from "vitest";
import { createFixtureArtifacts } from "@/data/fixtures";
import { defaultResearchTask } from "./researchConfig";
import { scoreResearchArtifacts, scoreToFinalStance } from "./scoring";

describe("research scoring", () => {
  it("maps weighted scores to final stance labels", () => {
    expect(scoreToFinalStance(1.4)).toBe("Supported");
    expect(scoreToFinalStance(0.7)).toBe("Partially Supported");
    expect(scoreToFinalStance(0)).toBe("Inconclusive");
    expect(scoreToFinalStance(-0.7)).toBe("Weakly Unsupported");
    expect(scoreToFinalStance(-1.4)).toBe("Not Supported");
  });

  it("scores the NVIDIA golden path as partially supported", () => {
    const artifacts = createFixtureArtifacts(defaultResearchTask);
    const scored = scoreResearchArtifacts(artifacts.nodes, artifacts.evidence);
    expect(scored.memo.finalStance).toBe("Partially Supported");
    expect(scored.memo.confidence).toBe("Medium-High");
    expect(scored.nodes).toHaveLength(5);
    expect(scored.nodes.find((node) => node.id === "valuation-sensitivity")?.stance).toBe(
      "weakly-refutes"
    );
  });
});
