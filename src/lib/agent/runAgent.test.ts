import { describe, expect, it, vi } from "vitest";
import { agentEventSchema } from "./schemas";
import { runAgent } from "./runAgent";
import type { AgentRequest } from "./types";

const request: AgentRequest = {
  security: {
    name: "NVIDIA Corporation",
    ticker: "NVDA",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  question: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
  timeHorizon: "12M",
  researchDepth: "deep",
  evidencePreference: "balanced",
  fallbackAllowed: true
};

describe("runAgent", () => {
  it("streams live events in order", async () => {
    const stageClient = {
      completeJson: vi
        .fn()
        .mockResolvedValueOnce({
          securityName: "NVIDIA Corporation",
          ticker: "NVDA",
          sectorFrame: "AI accelerators",
          rootQuestion: request.question,
          researchObjective: "Assess valuation support.",
          decisionCriteria: ["Revenue durability"],
          evidenceCategories: ["Earnings"],
          safetyNote: "Research assistance only."
        })
        .mockResolvedValueOnce({
          rootQuestion: request.question,
          nodes: [
            createNode("demand", "Demand Sustainability"),
            createNode("margin", "Margin Durability"),
            createNode("moat", "Competitive Moat"),
            createNode("valuation", "Valuation Sensitivity")
          ]
        })
        .mockResolvedValueOnce({
          items: [
            {
              nodeId: "demand",
              researchQuestions: ["Is AI demand durable?"],
              preferredSourceTypes: ["earnings"],
              sourceCandidates: ["NVIDIA earnings"],
              supportingSignals: ["Strong demand"],
              refutingSignals: ["Order slowdown"]
            }
          ]
        })
        .mockResolvedValueOnce({
          evidenceCards: [
            {
              id: "ev-1",
              nodeId: "demand",
              sourceTitle: "NVIDIA earnings",
              sourceType: "earnings",
              sourceDate: "2026-02-25",
              urlOrReference: "https://investor.nvidia.com/",
              provenanceStatus: "model-reported",
              quotedSnippet: "Demand strong.",
              extractedFact: "AI demand remains strong.",
              direction: "supports",
              reasoningImpact: "Supports demand."
            }
          ]
        })
        .mockResolvedValueOnce({
          executiveSummary: "The thesis is partially supported.",
          finalStance: "Partially Supported",
          confidence: "Medium",
          keyDrivers: ["Demand"],
          biggestCounterargument: "Valuation sensitivity.",
          whatWouldChangeTheView: ["Demand slowdown"],
          humanReviewChecklist: ["Verify filings"],
          sections: [
            {
              id: "demand",
              title: "Demand Sustainability",
              body: "Demand supports the thesis.",
              linkedNodeIds: ["demand"],
              linkedEvidenceIds: ["ev-1"]
            }
          ]
        })
    };

    const events = [];
    for await (const event of runAgent(request, { stageClient, runId: "run-live" })) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: "run-started",
      runId: "run-live",
      mode: "live-agent"
    });
    expect(events.filter((event) => event.type === "phase-started")).toHaveLength(7);
    expect(events.some((event) => event.type === "artifact")).toBe(true);
    expect(events.at(-1)?.type).toBe("run-completed");
    expect(stageClient.completeJson).toHaveBeenCalledTimes(5);
  });

  it("emits a run-completed event that satisfies the agent event schema", async () => {
    const stageClient = createStageClient();
    const events = [];

    for await (const event of runAgent(request, { stageClient, runId: "run-live" })) {
      events.push(event);
    }

    const completed = events.at(-1);
    const parsed = agentEventSchema.parse(completed);

    expect(parsed.type).toBe("run-completed");
    if (parsed.type !== "run-completed") {
      throw new Error("Expected a run-completed event.");
    }
    expect(parsed.run.taskFrame?.ticker).toBe("NVDA");
    expect(parsed.run.phases.every((phase) => phase.status === "complete")).toBe(true);
    expect(parsed.run.memo?.finalScore).toBe(parsed.run.scoredNodes?.finalScore);
  });
});

function createNode(id: string, label: string) {
  return {
    id,
    label,
    claim: `${label} claim.`,
    whyItMatters: `${label} matters.`,
    weight: 0.25,
    evidenceNeeded: [`${label} evidence`],
    counterEvidenceNeeded: [`${label} counter evidence`]
  };
}

function createStageClient() {
  return {
    completeJson: vi
      .fn()
      .mockResolvedValueOnce({
        securityName: "NVIDIA Corporation",
        ticker: "NVDA",
        sectorFrame: "AI accelerators",
        rootQuestion: request.question,
        researchObjective: "Assess valuation support.",
        decisionCriteria: ["Revenue durability"],
        evidenceCategories: ["Earnings"],
        safetyNote: "Research assistance only."
      })
      .mockResolvedValueOnce({
        rootQuestion: request.question,
        nodes: [
          createNode("demand", "Demand Sustainability"),
          createNode("margin", "Margin Durability"),
          createNode("moat", "Competitive Moat"),
          createNode("valuation", "Valuation Sensitivity")
        ]
      })
      .mockResolvedValueOnce({
        items: [
          {
            nodeId: "demand",
            researchQuestions: ["Is AI demand durable?"],
            preferredSourceTypes: ["earnings"],
            sourceCandidates: ["NVIDIA earnings"],
            supportingSignals: ["Strong demand"],
            refutingSignals: ["Order slowdown"]
          }
        ]
      })
      .mockResolvedValueOnce({
        evidenceCards: [
          {
            id: "ev-1",
            nodeId: "demand",
            sourceTitle: "NVIDIA earnings",
            sourceType: "earnings",
            sourceDate: "2026-02-25",
            urlOrReference: "https://investor.nvidia.com/",
            provenanceStatus: "model-reported",
            quotedSnippet: "Demand strong.",
            extractedFact: "AI demand remains strong.",
            direction: "supports",
            reasoningImpact: "Supports demand."
          }
        ]
      })
      .mockResolvedValueOnce({
        executiveSummary: "The thesis is partially supported.",
        finalStance: "Partially Supported",
        confidence: "Medium",
        keyDrivers: ["Demand"],
        biggestCounterargument: "Valuation sensitivity.",
        whatWouldChangeTheView: ["Demand slowdown"],
        humanReviewChecklist: ["Verify filings"],
        sections: [
          {
            id: "demand",
            title: "Demand Sustainability",
            body: "Demand supports the thesis.",
            linkedNodeIds: ["demand"],
            linkedEvidenceIds: ["ev-1"]
          }
        ]
      })
  };
}
