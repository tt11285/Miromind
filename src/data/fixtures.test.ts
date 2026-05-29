import { describe, expect, it } from "vitest";
import { createFixtureArtifacts } from "./fixtures";
import { defaultResearchTask } from "@/lib/researchConfig";

describe("fixture artifacts", () => {
  it("builds a complete NVIDIA golden path", () => {
    const artifacts = createFixtureArtifacts(defaultResearchTask);
    expect(artifacts.rootQuestion).toBe(
      "Is NVIDIA's current valuation justified by AI growth fundamentals?"
    );
    expect(artifacts.nodes).toHaveLength(5);
    expect(artifacts.evidence.length).toBeGreaterThanOrEqual(10);
    expect(artifacts.nodes.map((node) => node.label)).toEqual([
      "Revenue Growth",
      "Margin Durability",
      "Demand Sustainability",
      "Competitive Moat",
      "Valuation Sensitivity"
    ]);
    expect(artifacts.nodes.map((node) => node.id)).toEqual([
      "revenue-growth",
      "margin-durability",
      "demand-sustainability",
      "competitive-moat",
      "valuation-sensitivity"
    ]);
    expect(artifacts.nodes.map((node) => node.weight)).toEqual([0.2, 0.15, 0.25, 0.2, 0.2]);
    expect(artifacts.evidence.map((card) => [card.claimNodeId, card.direction])).toEqual([
      ["revenue-growth", "supports"],
      ["revenue-growth", "supports"],
      ["margin-durability", "supports"],
      ["margin-durability", "refutes"],
      ["demand-sustainability", "supports"],
      ["demand-sustainability", "refutes"],
      ["competitive-moat", "supports"],
      ["competitive-moat", "refutes"],
      ["valuation-sensitivity", "refutes"],
      ["valuation-sensitivity", "supports"]
    ]);
    expect(artifacts.evidence.some((card) => card.direction === "refutes")).toBe(true);
  });

  it("builds lighter artifacts for every supported company and template", () => {
    const companyIds = ["nvda", "msft", "mu", "tsla"] as const;
    const templateIds = [
      "valuation-growth",
      "downside-risk",
      "bull-bear",
      "earnings-thesis"
    ] as const;

    for (const companyId of companyIds) {
      for (const questionTemplateId of templateIds) {
        const artifacts = createFixtureArtifacts({
          companyId,
          questionTemplateId,
          timeHorizon: "12M",
          evidencePreference: "balanced"
        });
        expect(artifacts.nodes).toHaveLength(5);
        expect(artifacts.evidence.length).toBeGreaterThanOrEqual(3);
        const nodeIds = new Set(artifacts.nodes.map((node) => node.id));
        const evidenceIds = artifacts.evidence.map((card) => card.id);
        expect(artifacts.evidence.every((card) => nodeIds.has(card.claimNodeId))).toBe(true);
        expect(new Set(evidenceIds).size).toBe(evidenceIds.length);
        expect(artifacts.nodes.map((node) => node.weight)).toEqual(
          questionTemplateId === "valuation-growth"
            ? [0.2, 0.15, 0.25, 0.2, 0.2]
            : [0.22, 0.18, 0.2, 0.2, 0.2]
        );
      }
    }
  });

  it("returns fresh evidence arrays and card objects on repeated calls", () => {
    const first = createFixtureArtifacts(defaultResearchTask);
    const second = createFixtureArtifacts(defaultResearchTask);

    expect(first.evidence).not.toBe(second.evidence);
    expect(first.evidence[0]).not.toBe(second.evidence[0]);
  });
});
