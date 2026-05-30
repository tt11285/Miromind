import { describe, expect, it } from "vitest";
import { createFallbackRun, isCuratedFallbackEligible } from "./fallback";
import type { AgentRequest } from "./types";

const nvdaRequest: AgentRequest = {
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

describe("fallback", () => {
  it("allows curated NVIDIA fallback", () => {
    expect(isCuratedFallbackEligible(nvdaRequest)).toBe(true);

    const run = createFallbackRun("run-1", nvdaRequest);

    expect(run.mode).toBe("demo-fallback");
    expect(run.taskFrame?.ticker).toBe("NVDA");
    expect(run.memo?.finalScore).toBe(run.scoredNodes?.finalScore);
    expect(run.artifacts.map((artifact) => artifact.type)).toEqual([
      "task-frame",
      "hypothesis-tree",
      "evidence-cards",
      "scored-nodes",
      "memo"
    ]);
  });

  it("rejects non-curated fallback securities", () => {
    const request: AgentRequest = {
      ...nvdaRequest,
      security: {
        ...nvdaRequest.security,
        ticker: "PLTR",
        name: "Palantir Technologies Inc."
      }
    };

    expect(isCuratedFallbackEligible(request)).toBe(false);
    expect(() => createFallbackRun("run-1", request)).toThrow("No curated fallback");
  });

  it("rejects unsupported NVIDIA questions instead of fabricating fallback results", () => {
    const request: AgentRequest = {
      ...nvdaRequest,
      question: "What is NVIDIA's biggest regulatory risk next quarter?"
    };

    expect(isCuratedFallbackEligible(request)).toBe(false);
    expect(() => createFallbackRun("run-1", request)).toThrow("No curated fallback");
  });
});
