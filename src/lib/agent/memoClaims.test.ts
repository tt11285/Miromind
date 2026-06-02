import { describe, expect, it } from "vitest";
import { createMemoClaims } from "./memoClaims";
import type {
  AgentEvidenceCard,
  MemoArtifact,
  ScoredNodesArtifact
} from "./types";

describe("createMemoClaims", () => {
  it("creates auditable claims linked to hypothesis nodes and evidence cards", () => {
    const memo: MemoArtifact = {
      type: "memo",
      executiveSummary: "AI demand partially supports the valuation.",
      finalStance: "Partially Supported",
      confidence: "Medium",
      finalScore: 0.42,
      keyDrivers: ["Revenue Growth: supports"],
      biggestCounterargument: "Valuation Sensitivity remains the biggest risk.",
      whatWouldChangeTheView: ["Evidence that hyperscaler demand is slowing."],
      humanReviewChecklist: ["Verify source dates"],
      sections: [
        {
          id: "revenue-growth",
          title: "Revenue Growth",
          body: "Revenue growth supports the thesis.",
          linkedNodeIds: ["revenue-growth"],
          linkedEvidenceIds: ["ev-revenue-support"]
        }
      ],
      claims: []
    };
    const evidence: AgentEvidenceCard[] = [
      {
        id: "ev-revenue-support",
        nodeId: "revenue-growth",
        sourceTitle: "Company earnings call",
        sourceType: "earnings",
        sourceDate: "2026-02-25",
        urlOrReference: "https://investor.example.com/",
        provenanceStatus: "verified",
        quotedSnippet: "Data center revenue grew strongly.",
        extractedFact: "Revenue growth remains strong.",
        direction: "supports",
        reasoningImpact: "Supports the revenue growth node."
      },
      {
        id: "ev-valuation-risk",
        nodeId: "valuation-sensitivity",
        sourceTitle: "Market valuation data",
        sourceType: "market-data",
        sourceDate: "2026-02-26",
        urlOrReference: "https://market.example.com/",
        provenanceStatus: "model-reported",
        quotedSnippet: "The multiple remains elevated.",
        extractedFact: "Valuation is sensitive to growth assumptions.",
        direction: "refutes",
        reasoningImpact: "Refutes the valuation sensitivity node."
      }
    ];
    const scoredNodes: ScoredNodesArtifact = {
      type: "scored-nodes",
      finalScore: 0.42,
      finalStance: "Partially Supported",
      confidence: "Medium",
      nodes: [
        {
          id: "revenue-growth",
          label: "Revenue Growth",
          claim: "Revenue growth matters.",
          weight: 0.5,
          stance: "supports",
          confidence: "Medium",
          weightedScore: 0.5,
          reasoningNote: "Revenue evidence is supportive.",
          whatWouldChange: "Demand slowdown.",
          supportingEvidenceIds: ["ev-revenue-support"],
          counterEvidenceIds: []
        },
        {
          id: "valuation-sensitivity",
          label: "Valuation Sensitivity",
          claim: "Valuation sensitivity matters.",
          weight: 0.5,
          stance: "weakly-refutes",
          confidence: "Medium",
          weightedScore: -0.08,
          reasoningNote: "Valuation evidence is a risk.",
          whatWouldChange: "Multiple compression.",
          supportingEvidenceIds: [],
          counterEvidenceIds: ["ev-valuation-risk"]
        }
      ]
    };

    const claims = createMemoClaims(memo, scoredNodes, evidence);

    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimType: "driver",
          text: "Revenue Growth: supports",
          linkedNodeIds: ["revenue-growth"],
          linkedEvidenceIds: ["ev-revenue-support"]
        }),
        expect.objectContaining({
          claimType: "counterargument",
          linkedNodeIds: ["valuation-sensitivity"],
          linkedEvidenceIds: ["ev-valuation-risk"]
        }),
        expect.objectContaining({
          claimType: "section",
          text: "Revenue growth supports the thesis.",
          linkedNodeIds: ["revenue-growth"],
          linkedEvidenceIds: ["ev-revenue-support"]
        })
      ])
    );
  });
});
