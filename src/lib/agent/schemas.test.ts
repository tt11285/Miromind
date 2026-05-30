import { describe, expect, it } from "vitest";
import {
  agentRequestSchema,
  evidenceResearchOutputSchema,
  hypothesisOutputSchema,
  taskFrameOutputSchema
} from "./schemas";

const nvdaSecurity = {
  name: "NVIDIA Corporation",
  ticker: "NVDA",
  exchange: "NASDAQ",
  country: "US",
  assetType: "Equity"
};

describe("agent schemas", () => {
  it("accepts a selected listed security request", () => {
    const parsed = agentRequestSchema.parse({
      security: nvdaSecurity,
      question: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
      timeHorizon: "12M",
      researchDepth: "deep",
      evidencePreference: "balanced",
      fallbackAllowed: true
    });

    expect(parsed.security.ticker).toBe("NVDA");
    expect(parsed.question).toContain("valuation");
  });

  it("rejects a raw company string request", () => {
    const result = agentRequestSchema.safeParse({
      company: "NVIDIA",
      question: "Is the valuation justified?",
      timeHorizon: "12M",
      researchDepth: "deep",
      evidencePreference: "balanced",
      fallbackAllowed: true
    });

    expect(result.success).toBe(false);
  });

  it("validates task framing output", () => {
    const parsed = taskFrameOutputSchema.parse({
      securityName: "NVIDIA Corporation",
      ticker: "NVDA",
      sectorFrame: "AI accelerators and data center platforms",
      rootQuestion: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
      researchObjective: "Assess whether AI-driven fundamentals support the current valuation.",
      decisionCriteria: ["Revenue durability", "Margin durability"],
      evidenceCategories: ["Filings", "Earnings calls", "Market data"],
      safetyNote: "Research assistance only, not investment advice."
    });

    expect(parsed.ticker).toBe("NVDA");
  });

  it("validates generated hypothesis nodes", () => {
    const node = {
      id: "demand-sustainability",
      label: "Demand Sustainability",
      claim: "AI demand can remain strong enough to support valuation assumptions.",
      whyItMatters: "Demand durability is central to forward revenue expectations.",
      weight: 0.24,
      evidenceNeeded: ["Cloud capex commentary"],
      counterEvidenceNeeded: ["Signs of order pull-forward"]
    };
    const parsed = hypothesisOutputSchema.parse({
      rootQuestion: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
      nodes: [
        node,
        { ...node, id: "margin-durability", label: "Margin Durability" },
        { ...node, id: "competitive-moat", label: "Competitive Moat" },
        { ...node, id: "valuation-sensitivity", label: "Valuation Sensitivity" }
      ]
    });

    expect(parsed.nodes[0].id).toBe("demand-sustainability");
  });

  it("requires evidence provenance status", () => {
    const parsed = evidenceResearchOutputSchema.parse({
      evidenceCards: [
        {
          id: "ev-demand-1",
          nodeId: "demand-sustainability",
          sourceTitle: "NVIDIA quarterly results",
          sourceType: "earnings",
          sourceDate: "2026-02-25",
          urlOrReference: "https://investor.nvidia.com/",
          provenanceStatus: "model-reported",
          quotedSnippet: "Data center demand remained strong.",
          extractedFact: "Management reported strong AI data center demand.",
          direction: "supports",
          reasoningImpact: "Supports the demand sustainability node."
        }
      ]
    });

    expect(parsed.evidenceCards[0].provenanceStatus).toBe("model-reported");
  });
});
