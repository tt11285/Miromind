import { describe, expect, it } from "vitest";
import { scoreAgentEvidence } from "./scoring";
import type { AgentEvidenceCard, HypothesisTreeArtifact } from "./types";

const tree: HypothesisTreeArtifact = {
  type: "hypothesis-tree",
  rootQuestion: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
  nodes: [
    {
      id: "demand",
      label: "Demand Sustainability",
      claim: "AI demand remains durable.",
      whyItMatters: "Demand drives revenue assumptions.",
      weight: 0.5,
      evidenceNeeded: ["AI demand"],
      counterEvidenceNeeded: ["Demand slowdown"]
    }
  ]
};

const evidence: AgentEvidenceCard[] = [
  {
    id: "ev-1",
    nodeId: "demand",
    sourceTitle: "NVIDIA results",
    sourceType: "earnings",
    sourceDate: "2026-02-25",
    urlOrReference: "https://investor.nvidia.com/",
    provenanceStatus: "model-reported",
    quotedSnippet: "Demand remained strong.",
    extractedFact: "AI demand remained strong.",
    direction: "supports",
    reasoningImpact: "Supports demand durability."
  },
  {
    id: "ev-2",
    nodeId: "demand",
    sourceTitle: "Customer concentration concern",
    sourceType: "news",
    sourceDate: "2026-01-10",
    urlOrReference: "Analyst commentary",
    provenanceStatus: "model-reported",
    quotedSnippet: "Large customers may pause orders.",
    extractedFact: "Order timing may become uneven.",
    direction: "refutes",
    reasoningImpact: "Complicates demand durability."
  }
];

describe("scoreAgentEvidence", () => {
  it("scores generated evidence and produces node conclusions", () => {
    const scored = scoreAgentEvidence(tree, evidence);

    expect(scored.type).toBe("scored-nodes");
    expect(scored.nodes[0].label).toBe("Demand Sustainability");
    expect(scored.nodes[0].supportingEvidenceIds).toEqual(["ev-1"]);
    expect(scored.nodes[0].counterEvidenceIds).toEqual(["ev-2"]);
    expect(scored.finalStance).toBeDefined();
  });

  it("uses default score inputs when generated evidence omits score fields", () => {
    const scored = scoreAgentEvidence(tree, [evidence[0]]);

    expect(scored.nodes[0].weightedScore).toBeGreaterThan(0);
    expect(scored.nodes[0].stance).toBe("weakly-supports");
    expect(scored.nodes[0].confidence).toBe("Low");
  });
});
