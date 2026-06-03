import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const nvdaRequest = {
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

const originalKey = process.env.MIROMIND_API_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.MIROMIND_API_KEY;
  } else {
    process.env.MIROMIND_API_KEY = originalKey;
  }
  vi.unstubAllGlobals();
});

function planRequest(body: unknown): Request {
  return new Request("http://localhost/api/research/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function miroResponse(content: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] })
  );
}

describe("POST /api/research/plan", () => {
  it("uses local templated artifacts when no API key is configured", async () => {
    delete process.env.MIROMIND_API_KEY;

    const response = await POST(planRequest(nvdaRequest));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.taskFrame.ticker).toBe("NVDA");
    expect(body.hypothesisTree.nodes.map((node: { label: string }) => node.label)).toContain(
      "Revenue Growth"
    );
    expect(body.telemetry).toEqual([]);
  });

  it("generates the task frame and hypothesis tree via MiroMind when a key is present", async () => {
    process.env.MIROMIND_API_KEY = "test-key";
    const modelNodes = [
      { id: "sovereign", label: "Sovereign AI Demand", claim: "c", whyItMatters: "w", weight: 0.25, evidenceNeeded: ["e"], counterEvidenceNeeded: ["c"] },
      { id: "supply", label: "HBM Supply", claim: "c", whyItMatters: "w", weight: 0.25, evidenceNeeded: ["e"], counterEvidenceNeeded: ["c"] },
      { id: "moat", label: "CUDA Moat", claim: "c", whyItMatters: "w", weight: 0.25, evidenceNeeded: ["e"], counterEvidenceNeeded: ["c"] },
      { id: "multiple", label: "Multiple Risk", claim: "c", whyItMatters: "w", weight: 0.25, evidenceNeeded: ["e"], counterEvidenceNeeded: ["c"] }
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const prompt = JSON.parse(String(init?.body)).messages[0].content as string;
        if (prompt.includes("TaskFrameOutput")) {
          return miroResponse({
            securityName: "NVIDIA Corporation",
            ticker: "NVDA",
            sectorFrame: "model sector frame",
            rootQuestion: nvdaRequest.question,
            researchObjective: "model objective",
            decisionCriteria: ["model criterion"],
            evidenceCategories: ["model category"],
            safetyNote: "Research assistance only."
          });
        }
        return miroResponse({ rootQuestion: nvdaRequest.question, nodes: modelNodes });
      })
    );

    const response = await POST(planRequest(nvdaRequest));
    const body = await response.json();

    expect(body.taskFrame.sectorFrame).toBe("model sector frame");
    expect(body.hypothesisTree.nodes.map((node: { label: string }) => node.label)).toContain(
      "Sovereign AI Demand"
    );
    expect(body.telemetry.length).toBeGreaterThan(0);
  });

  it("falls back to local artifacts when MiroMind returns unusable output", async () => {
    process.env.MIROMIND_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }))
      )
    );

    const response = await POST(planRequest(nvdaRequest));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hypothesisTree.nodes.map((node: { label: string }) => node.label)).toContain(
      "Revenue Growth"
    );
  });
});
