import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveResearchWorkbench } from "./LiveResearchWorkbench";

afterEach(() => {
  vi.unstubAllGlobals();
});

function streamFromLines(lines: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      }
      controller.close();
    }
  });
}

describe("LiveResearchWorkbench", () => {
  it("runs a streamed agent workflow and links memo trace to evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/research/status")) {
          return Response.json({
            liveAvailable: true,
            model: "gpt-oss-120b",
            fallbackAvailable: true
          });
        }
        if (url.includes("/api/securities/search")) {
          return Response.json({
            results: [
              {
                name: "NVIDIA Corporation",
                ticker: "NVDA",
                exchange: "NASDAQ",
                country: "US",
                assetType: "Equity"
              }
            ]
          });
        }
        return new Response(
          streamFromLines([
            { type: "run-started", runId: "run-1", mode: "live-agent" },
            { type: "phase-started", phase: "Task Framing", detail: "Framing" },
            {
              type: "artifact",
              artifact: {
                type: "hypothesis-tree",
                rootQuestion: "Question",
                nodes: [
                  {
                    id: "demand",
                    label: "Demand Sustainability",
                    claim: "Demand remains strong.",
                    whyItMatters: "Demand matters.",
                    weight: 1,
                    evidenceNeeded: ["Demand"],
                    counterEvidenceNeeded: ["Slowdown"]
                  }
                ]
              }
            },
            {
              type: "artifact",
              artifact: {
                type: "evidence-cards",
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
              }
            },
            {
              type: "artifact",
              artifact: {
                type: "memo",
                executiveSummary: "Partially supported.",
                finalStance: "Partially Supported",
                confidence: "Medium",
                finalScore: 0.5,
                keyDrivers: ["Demand"],
                biggestCounterargument: "Valuation sensitivity.",
                whatWouldChangeTheView: ["Demand slowdown"],
                humanReviewChecklist: ["Verify sources"],
                sections: [
                  {
                    id: "demand",
                    title: "Demand Sustainability",
                    body: "Demand supports the thesis.",
                    linkedNodeIds: ["demand"],
                    linkedEvidenceIds: ["ev-1"]
                  }
                ]
              }
            },
            {
              type: "run-completed",
              run: { runId: "run-1", mode: "live-agent", phases: [], artifacts: [] }
            }
          ]),
          { headers: { "Content-Type": "application/x-ndjson" } }
        );
      })
    );

    render(<LiveResearchWorkbench />);

    fireEvent.change(await screen.findByLabelText("Company or ticker"), {
      target: { value: "nvda" }
    });
    await waitFor(() => expect(screen.getByText("NVIDIA Corporation")).toBeInTheDocument());
    fireEvent.click(screen.getByText("NVIDIA Corporation"));
    fireEvent.change(screen.getByLabelText("Research question"), {
      target: {
        value: "Is NVIDIA's current valuation justified by AI growth fundamentals?"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));

    expect(await screen.findByText("Partially Supported")).toBeInTheDocument();
    const memoPanel = screen.getByRole("region", { name: "Investment memo" });
    fireEvent.click(
      within(memoPanel).getByRole("button", { name: /Demand Sustainability/ })
    );

    const evidencePanel = screen.getByRole("region", { name: "Evidence cards" });
    expect(within(evidencePanel).getByText("NVIDIA earnings")).toBeInTheDocument();
  });
});
