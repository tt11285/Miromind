import { describe, expect, it } from "vitest";
import { createFixtureArtifacts } from "@/data/fixtures";
import { defaultResearchTask } from "./researchConfig";
import { scoreResearchArtifacts, scoreToFinalStance } from "./scoring";
import type { EvidenceCard, EvidenceDirection, HypothesisNode } from "./types";

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
      "mixed"
    );
  });

  it("uses plan thresholds for node stance boundaries", () => {
    const nodes = [createNode("support-boundary"), createNode("mixed-boundary")];
    const scored = scoreResearchArtifacts(nodes, [
      createEvidence("support-boundary-1", "support-boundary", "supports", 0.58),
      createEvidence("support-boundary-2", "support-boundary", "supports", 0.57),
      createEvidence("mixed-boundary-1", "mixed-boundary", "refutes", 0.2)
    ]);

    expect(scored.nodes.find((node) => node.id === "support-boundary")?.stance).toBe(
      "supports"
    );
    expect(scored.nodes.find((node) => node.id === "mixed-boundary")?.stance).toBe("mixed");
  });

  it("clamps node scores before weighting and stance decisions", () => {
    const scored = scoreResearchArtifacts([createNode("over-supported")], [
      createEvidence("over-supported-1", "over-supported", "supports", 1),
      createEvidence("over-supported-2", "over-supported", "supports", 1),
      createEvidence("over-supported-3", "over-supported", "supports", 1)
    ]);
    const node = scored.nodes[0];

    expect(node.weightedScore).toBe(2);
    expect(node.stance).toBe("supports");
    expect(scored.memo.finalScore).toBe(2);
  });
});

function createNode(id: string): HypothesisNode {
  return {
    id,
    label: id,
    claim: `${id} claim`,
    weight: 1,
    stance: "mixed",
    confidence: "Medium",
    weightedScore: 0,
    reasoningNote: `${id} reasoning`,
    whatWouldChange: `${id} change condition`
  };
}

function createEvidence(
  id: string,
  claimNodeId: string,
  direction: EvidenceDirection,
  score: number
): EvidenceCard {
  return {
    id,
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId,
    sourceTitle: id,
    sourceType: "filing",
    sourceDate: "2026-05-29",
    quotedSnippet: id,
    extractedFact: id,
    direction,
    reliabilityScore: score,
    relevanceScore: score,
    freshnessScore: score,
    reasoningImpact: id,
    urlOrReference: id
  };
}
