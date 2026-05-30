import { describe, expect, it } from "vitest";
import {
  agentRequestSchema,
  agentEventSchema,
  evidenceCardSchema,
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

  it("rejects unknown fields on selected listed security requests", () => {
    const result = agentRequestSchema.safeParse({
      security: nvdaSecurity,
      company: "NVIDIA",
      question: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
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

  it("preserves optional evidence scores", () => {
    const parsed = evidenceCardSchema.parse({
      id: "ev-demand-1",
      nodeId: "demand-sustainability",
      sourceTitle: "NVIDIA quarterly results",
      sourceType: "earnings",
      sourceDate: "2026-02-25",
      urlOrReference: "https://investor.nvidia.com/",
      provenanceStatus: "verified",
      quotedSnippet: "Data center demand remained strong.",
      extractedFact: "Management reported strong AI data center demand.",
      direction: "supports",
      reasoningImpact: "Supports the demand sustainability node.",
      reliabilityScore: 0.9,
      relevanceScore: 0.85,
      freshnessScore: 0.8
    });

    expect(parsed.reliabilityScore).toBe(0.9);
    expect(parsed.relevanceScore).toBe(0.85);
    expect(parsed.freshnessScore).toBe(0.8);
  });

  it("validates a completed agent run event", () => {
    const taskFrame = {
      type: "task-frame",
      securityName: "NVIDIA Corporation",
      ticker: "NVDA",
      sectorFrame: "AI accelerators and data center platforms",
      rootQuestion: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
      researchObjective: "Assess whether AI-driven fundamentals support the current valuation.",
      decisionCriteria: ["Revenue durability"],
      evidenceCategories: ["Filings"],
      safetyNote: "Research assistance only, not investment advice."
    };
    const scoredNodes = {
      type: "scored-nodes",
      nodes: [
        {
          id: "demand-sustainability",
          label: "Demand Sustainability",
          claim: "AI demand can remain strong enough to support valuation assumptions.",
          weight: 0.24,
          stance: "supports",
          confidence: "Medium-High",
          weightedScore: 0.18,
          reasoningNote: "Evidence supports demand durability.",
          whatWouldChange: "A sustained cloud capex slowdown.",
          supportingEvidenceIds: ["ev-demand-1"],
          counterEvidenceIds: []
        }
      ],
      finalScore: 0.68,
      finalStance: "Partially Supported",
      confidence: "Medium"
    };
    const memo = {
      type: "memo",
      executiveSummary: "AI-driven fundamentals partially support the current valuation.",
      finalStance: "Partially Supported",
      confidence: "Medium",
      finalScore: 0.68,
      keyDrivers: ["Data center demand"],
      biggestCounterargument: "Expectations may already discount durable growth.",
      whatWouldChangeTheView: ["Evidence of demand pull-forward"],
      humanReviewChecklist: ["Verify cited source dates"],
      sections: [
        {
          id: "summary",
          title: "Summary",
          body: "Demand remains the central driver.",
          linkedNodeIds: ["demand-sustainability"],
          linkedEvidenceIds: ["ev-demand-1"]
        }
      ]
    };

    const parsed = agentEventSchema.parse({
      type: "run-completed",
      run: {
        runId: "run-1",
        mode: "live-agent",
        request: {
          security: nvdaSecurity,
          question: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
          timeHorizon: "12M",
          researchDepth: "deep",
          evidencePreference: "balanced",
          fallbackAllowed: true
        },
        phases: [
          {
            name: "Task Framing",
            status: "complete",
            detail: "Framed the research task."
          }
        ],
        artifacts: [taskFrame, scoredNodes, memo],
        taskFrame,
        scoredNodes,
        memo
      }
    });

    if (parsed.type !== "run-completed") {
      throw new Error(`Expected run-completed event, received ${parsed.type}`);
    }

    expect(parsed.run.artifacts[1].type).toBe("scored-nodes");
    expect(parsed.run.memo?.sections[0].linkedEvidenceIds).toEqual(["ev-demand-1"]);
  });

  it("rejects unknown fields on agent events", () => {
    const result = agentEventSchema.safeParse({
      type: "phase-started",
      phase: "Task Framing",
      detail: "Framing the task.",
      unexpected: "silently stripped before strict validation"
    });

    expect(result.success).toBe(false);
  });
});
