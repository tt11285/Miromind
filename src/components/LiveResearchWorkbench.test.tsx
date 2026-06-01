import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
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

function deferredStream() {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    }
  });

  return {
    stream,
    emit(line: unknown) {
      streamController.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
    },
    close() {
      streamController.close();
    }
  };
}

describe("LiveResearchWorkbench", () => {
  it("launches with motion state and reveals timeline steps progressively", async () => {
    const agentStream = deferredStream();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/research/status")) {
          return Response.json({
            liveAvailable: true,
            model: "mirothinker-1-7-deepresearch",
            fallbackAvailable: true
          });
        }
        if (url.includes("/api/research/run")) {
          return new Response(agentStream.stream, {
            headers: { "Content-Type": "application/x-ndjson" }
          });
        }
        throw new Error(`Unexpected fetch ${url}`);
      })
    );

    render(<LiveResearchWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "NVIDIA / NVDA" }));
    fireEvent.change(screen.getByLabelText("Research question"), {
      target: {
        value: "Is NVIDIA's current valuation justified by AI growth fundamentals?"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));

    expect(screen.getByRole("button", { name: "Running Research" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Running Research" })).not.toHaveClass("launching");
    expect(screen.getByRole("main")).toHaveClass("launching-active");
    expect(await screen.findByText("Task Framing")).toBeInTheDocument();
    expect(screen.queryByText("Hypothesis Generation")).not.toBeInTheDocument();

    await act(async () => {
      agentStream.emit({
        type: "phase-started",
        phase: "Task Framing",
        detail: "Framing the selected security and research question."
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Reading the question and framing the decision.")).toBeInTheDocument();
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.queryByText("Hypothesis Generation")).not.toBeInTheDocument();

    await act(async () => {
      agentStream.emit({
        type: "phase-completed",
        phase: "Task Framing",
        detail: "Framed the research task."
      });
      agentStream.emit({
        type: "phase-started",
        phase: "Hypothesis Generation",
        detail: "Building the hypothesis tree."
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Hypothesis Generation")).toBeInTheDocument();
    expect(screen.queryByText("Evidence Planning")).not.toBeInTheDocument();
    await act(async () => {
      agentStream.close();
      await Promise.resolve();
    });
  });

  it("collapses the completed research timeline into a summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/research/status")) {
          return Response.json({
            liveAvailable: true,
            model: "mirothinker-1-7-deepresearch",
            fallbackAvailable: true
          });
        }
        if (url.includes("/api/research/run")) {
          return new Response(
            streamFromLines([
              { type: "run-started", runId: "run-complete", mode: "live-agent" },
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
                      linkedEvidenceIds: []
                    }
                  ]
                }
              },
              {
                type: "run-completed",
                run: {
                  runId: "run-complete",
                  mode: "live-agent",
                  phases: [
                    { name: "Task Framing", status: "complete", detail: "Done" },
                    { name: "Hypothesis Generation", status: "complete", detail: "Done" },
                    { name: "Evidence Planning", status: "complete", detail: "Done" },
                    { name: "Evidence Research", status: "complete", detail: "Done" },
                    { name: "Evidence Scoring", status: "complete", detail: "Done" },
                    { name: "Reasoning Synthesis", status: "complete", detail: "Done" },
                    { name: "Memo Rendering", status: "complete", detail: "Done" }
                  ],
                  artifacts: []
                }
              }
            ]),
            { headers: { "Content-Type": "application/x-ndjson" } }
          );
        }
        throw new Error(`Unexpected fetch ${url}`);
      })
    );

    render(<LiveResearchWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "NVIDIA / NVDA" }));
    fireEvent.change(screen.getByLabelText("Research question"), {
      target: {
        value: "Is NVIDIA's current valuation justified by AI growth fundamentals?"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));

    expect(await screen.findByText("Deep Research complete")).toBeInTheDocument();
    expect(screen.getByText("7/7 steps complete")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Agent run timeline" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Investment memo" })).toBeInTheDocument();
  });

  it("starts as a full-screen agent and reveals the workspace after running", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/research/status")) {
          return Response.json({
            liveAvailable: true,
            model: "mirothinker-1-7-deepresearch",
            fallbackAvailable: true
          });
        }
        if (url.includes("/api/research/run")) {
          return new Response(
            streamFromLines([
              { type: "run-started", runId: "run-intro", mode: "live-agent" },
              { type: "phase-started", phase: "Task Framing", detail: "Framing" },
              {
                type: "run-completed",
                run: { runId: "run-intro", mode: "live-agent", phases: [], artifacts: [] }
              }
            ]),
            { headers: { "Content-Type": "application/x-ndjson" } }
          );
        }
        throw new Error(`Unexpected fetch ${url}`);
      })
    );

    render(<LiveResearchWorkbench />);

    expect(screen.getByRole("main")).toHaveClass("intro-active");
    expect(screen.queryByText("MiroMind Deep Research")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "NVIDIA / NVDA" }));
    fireEvent.change(screen.getByLabelText("Research question"), {
      target: {
        value: "Is NVIDIA's current valuation justified by AI growth fundamentals?"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));

    expect(await screen.findByText("MiroMind Deep Research")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("workbench-active");
  });

  it("resizes the active workbench columns with drag handles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/research/status")) {
          return Response.json({
            liveAvailable: true,
            model: "mirothinker-1-7-deepresearch",
            fallbackAvailable: true
          });
        }
        if (url.includes("/api/research/run")) {
          return new Response(
            streamFromLines([
              { type: "run-started", runId: "run-resize", mode: "live-agent" },
              {
                type: "artifact",
                artifact: {
                  type: "hypothesis-tree",
                  rootQuestion: "Question",
                  nodes: [
                    {
                      id: "demand",
                      label: "Demand",
                      claim: "Demand remains strong.",
                      whyItMatters: "Demand matters.",
                      weight: 1,
                      evidenceNeeded: ["Demand"],
                      counterEvidenceNeeded: ["Slowdown"]
                    }
                  ]
                }
              }
            ]),
            { headers: { "Content-Type": "application/x-ndjson" } }
          );
        }
        throw new Error(`Unexpected fetch ${url}`);
      })
    );

    render(<LiveResearchWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "NVIDIA / NVDA" }));
    fireEvent.change(screen.getByLabelText("Research question"), {
      target: {
        value: "Is NVIDIA's current valuation justified by AI growth fundamentals?"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));

    const shell = screen.getByRole("main");
    await screen.findByRole("separator", { name: "Resize agent and workspace columns" });
    const before = shell.style.gridTemplateColumns;

    fireEvent.mouseDown(
      screen.getByRole("separator", { name: "Resize agent and workspace columns" }),
      { clientX: 320 }
    );
    fireEvent.mouseMove(window, { clientX: 380 });
    fireEvent.mouseUp(window);

    expect(shell.style.gridTemplateColumns).not.toEqual(before);
  });

  it("runs a streamed agent workflow and links memo trace to evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/research/status")) {
          return Response.json({
            liveAvailable: true,
            model: "mirothinker-1-7-deepresearch",
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

  it("shows a server error instead of silently ignoring a failed run response", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return Response.json({
          liveAvailable: true,
          model: "mirothinker-1-7-deepresearch",
          fallbackAvailable: true
        });
      }
      if (url.includes("/api/research/run")) {
        return Response.json({ error: "Invalid research request." }, { status: 400 });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "NVIDIA / NVDA" }));
    fireEvent.change(screen.getByLabelText("Research question"), {
      target: {
        value: "Is NVIDIA's current valuation justified by AI growth fundamentals?"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid research request."
    );
    await waitFor(() => expect(screen.getAllByText("failed")).toHaveLength(7));
    const runCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/api/research/run")
    );
    expect(runCall).toBeDefined();
  });

  it("removes UI-only security fields before sending the research request", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return Response.json({
          liveAvailable: true,
          model: "mirothinker-1-7-deepresearch",
          fallbackAvailable: true
        });
      }
      if (url.includes("/api/research/run")) {
        return new Response(
          streamFromLines([
            { type: "run-started", runId: "run-clean", mode: "live-agent" },
            {
              type: "run-completed",
              run: { runId: "run-clean", mode: "live-agent", phases: [], artifacts: [] }
            }
          ]),
          { headers: { "Content-Type": "application/x-ndjson" } }
        );
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal(
      "fetch",
      fetchMock
    );

    render(<LiveResearchWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "NVIDIA / NVDA" }));
    fireEvent.change(screen.getByLabelText("Research question"), {
      target: {
        value: "Is NVIDIA's current valuation justified by AI growth fundamentals?"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/research/run")
        )
      ).toBe(true)
    );
    const runCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/api/research/run")
    );
    const init = runCall?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));

    expect(body.security).toEqual({
      name: "NVIDIA Corporation",
      ticker: "NVDA",
      exchange: "NASDAQ",
      country: "US",
      assetType: "Equity"
    });
    expect(body.security).not.toHaveProperty("displayName");
  });
});
