import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AgentEvidenceCard,
  AgentRequest,
  EvidencePlanArtifact,
  HypothesisTreeArtifact,
  MemoArtifact,
  ScoredNodesArtifact,
  TaskFrameArtifact
} from "@/lib/agent/types";
import { LiveResearchWorkbench } from "./LiveResearchWorkbench";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const selectedRequest: AgentRequest = {
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

const taskFrame: TaskFrameArtifact = {
  type: "task-frame",
  securityName: "NVIDIA Corporation",
  ticker: "NVDA",
  sectorFrame: "AI accelerators",
  rootQuestion: selectedRequest.question,
  researchObjective: "Assess NVIDIA.",
  decisionCriteria: ["Growth"],
  evidenceCategories: ["Filings"],
  safetyNote: "Research assistance only."
};

const hypothesisTree: HypothesisTreeArtifact = {
  type: "hypothesis-tree",
  rootQuestion: selectedRequest.question,
  nodes: [
    "Revenue Growth",
    "Margin Durability",
    "Demand Sustainability",
    "Competitive Moat",
    "Valuation Sensitivity"
  ].map((label, index) => ({
    id: `node-${index + 1}`,
    label,
    claim: `${label} matters.`,
    whyItMatters: `${label} changes the view.`,
    weight: 0.2,
    evidenceNeeded: [`${label} evidence`],
    counterEvidenceNeeded: [`${label} counter evidence`]
  }))
};

const evidencePlan: EvidencePlanArtifact = {
  type: "evidence-plan",
  items: hypothesisTree.nodes.map((node) => ({
    nodeId: node.id,
    researchQuestions: [`What supports ${node.label}?`],
    preferredSourceTypes: ["earnings"],
    sourceCandidates: ["Latest earnings call"],
    supportingSignals: node.evidenceNeeded,
    refutingSignals: node.counterEvidenceNeeded
  }))
};

const memo: MemoArtifact = {
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
      id: "node-1",
      title: "Revenue Growth",
      body: "Revenue supports the thesis.",
      linkedNodeIds: ["node-1"],
      linkedEvidenceIds: ["ev-node-1"]
    }
  ],
  claims: [
    {
      id: "claim-driver-demand",
      claimType: "driver",
      text: "AI demand supports the valuation.",
      linkedNodeIds: ["node-1"],
      linkedEvidenceIds: ["ev-node-1"],
      stance: "supports",
      confidence: "Medium",
      score: 0.2
    }
  ]
};

const scoredNodes: ScoredNodesArtifact = {
  type: "scored-nodes",
  nodes: hypothesisTree.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    claim: node.claim,
    weight: node.weight,
    stance: "supports",
    confidence: "Medium",
    weightedScore: 0.2,
    reasoningNote: `${node.label} is supported.`,
    whatWouldChange: `${node.label} weakens.`,
    supportingEvidenceIds: [`ev-${node.id}`],
    counterEvidenceIds: []
  })),
  finalScore: 0.5,
  finalStance: "Partially Supported",
  confidence: "Medium"
};

function evidenceForNode(nodeId: string): AgentEvidenceCard {
  return {
    id: `ev-${nodeId}`,
    nodeId,
    sourceTitle: `${nodeId} source`,
    sourceType: "earnings",
    sourceDate: "2026-02-25",
    urlOrReference: "https://investor.example.com/",
    provenanceStatus: "model-reported",
    quotedSnippet: "Evidence snippet.",
    extractedFact: "Evidence fact.",
    direction: "supports",
    reasoningImpact: "Supports the node."
  };
}

const allEvidenceCards = hypothesisTree.nodes.map((node) => evidenceForNode(node.id));

function phaseStarted(phase: string) {
  return { type: "phase-started", phase, detail: `${phase} running.` };
}

function phaseCompleted(phase: string) {
  return { type: "phase-completed", phase, detail: `${phase} complete.` };
}

/** The ordered event stream that a successful live run emits. */
function fullRunEvents(): unknown[] {
  return [
    { type: "run-started", runId: "run-test", mode: "live-agent" },
    phaseStarted("Task Framing"),
    { type: "artifact", artifact: taskFrame },
    phaseCompleted("Task Framing"),
    phaseStarted("Hypothesis Generation"),
    { type: "artifact", artifact: hypothesisTree },
    phaseCompleted("Hypothesis Generation"),
    phaseStarted("Evidence Planning"),
    { type: "artifact", artifact: evidencePlan },
    phaseCompleted("Evidence Planning"),
    phaseStarted("Evidence Research"),
    { type: "artifact", artifact: { type: "evidence-cards", evidenceCards: allEvidenceCards } },
    phaseCompleted("Evidence Research"),
    phaseStarted("Evidence Scoring"),
    { type: "artifact", artifact: scoredNodes },
    phaseCompleted("Evidence Scoring"),
    phaseStarted("Reasoning Synthesis"),
    { type: "artifact", artifact: memo },
    phaseCompleted("Reasoning Synthesis"),
    phaseStarted("Memo Rendering"),
    phaseCompleted("Memo Rendering"),
    { type: "run-completed", run: { mode: "live-agent" } }
  ];
}

function streamResponse(lines: unknown[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      }
      controller.close();
    }
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" }
  });
}

function controlledRun() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    }
  });
  const response = new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" }
  });
  return {
    response,
    async push(...lines: unknown[]) {
      await act(async () => {
        for (const line of lines) {
          controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        }
      });
    },
    async close() {
      await act(async () => {
        controller.close();
      });
    }
  };
}

function statusResponse() {
  return Response.json({
    liveAvailable: true,
    model: "mirothinker-1-7-deepresearch",
    fallbackAvailable: true
  });
}

function successfulRunFetch() {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/research/status")) {
      return statusResponse();
    }
    if (url.includes("/api/research/run")) {
      return streamResponse(fullRunEvents());
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
}

function runDefaultQuestion() {
  fireEvent.click(screen.getByRole("button", { name: "NVIDIA / NVDA" }));
  fireEvent.change(screen.getByLabelText("Research question"), {
    target: {
      value: selectedRequest.question
    }
  });
  fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));
}

describe("LiveResearchWorkbench", () => {
  it("reveals timeline steps progressively as the run streams", async () => {
    const run = controlledRun();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return statusResponse();
      }
      if (url.includes("/api/research/run")) {
        return run.response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    expect(screen.getByRole("button", { name: "Running Research" })).toBeDisabled();
    expect(screen.getByRole("main")).toHaveClass("running-active");

    await run.push(
      { type: "run-started", runId: "run-test", mode: "live-agent" },
      phaseStarted("Task Framing")
    );

    expect(await screen.findByText("Task Framing")).toBeInTheDocument();
    expect(screen.queryByText("Hypothesis Generation")).not.toBeInTheDocument();
    expect(screen.getByText("Thinking")).toBeInTheDocument();

    // Advance through Task Framing into Hypothesis Generation, but do not finish.
    for (const event of fullRunEvents().slice(2, 5)) {
      await run.push(event);
    }
    expect(await screen.findByText("Hypothesis Generation")).toBeInTheDocument();

    // Stream the remainder and close; the timeline collapses into the summary.
    for (const event of fullRunEvents().slice(5)) {
      await run.push(event);
    }
    await run.close();

    expect(
      await screen.findByText("Deep Research complete", {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it("lets the user cancel an in-flight run and return to a runnable state", async () => {
    const encoder = new TextEncoder();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return statusResponse();
      }
      if (url.includes("/api/research/run")) {
        const stream = new ReadableStream<Uint8Array>({
          start(streamController) {
            controller = streamController;
          }
        });
        init?.signal?.addEventListener("abort", () => {
          try {
            controller.error(new DOMException("Aborted", "AbortError"));
          } catch {
            // stream already settled
          }
        });
        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8" }
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    await act(async () => {
      controller.enqueue(
        encoder.encode(
          `${JSON.stringify({ type: "run-started", runId: "run-test", mode: "live-agent" })}\n`
        )
      );
      controller.enqueue(encoder.encode(`${JSON.stringify(phaseStarted("Task Framing"))}\n`));
    });

    expect(await screen.findByText("Task Framing")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Stop research/i }));

    expect(
      await screen.findByRole("button", { name: "Run Deep Research" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Task Framing")).not.toBeInTheDocument();
  });

  it("runs the streamed agent workflow and links memo trace to evidence", async () => {
    vi.stubGlobal("fetch", successfulRunFetch());

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    expect(
      await screen.findByText("Partially Supported", {}, { timeout: 3000 })
    ).toBeInTheDocument();
    const memoPanel = screen.getByRole("region", { name: "Investment memo" });
    fireEvent.click(within(memoPanel).getByRole("button", { name: /Revenue Growth/ }));

    const evidencePanel = screen.getByRole("region", { name: "Evidence cards" });
    expect(within(evidencePanel).getByText("node-1 source")).toBeInTheDocument();
  });

  it("marks evidence research tasks complete as evidence cards stream in", async () => {
    const run = controlledRun();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return statusResponse();
      }
      if (url.includes("/api/research/run")) {
        return run.response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    await run.push(
      { type: "run-started", runId: "run-test", mode: "live-agent" },
      phaseStarted("Task Framing"),
      { type: "artifact", artifact: taskFrame },
      phaseCompleted("Task Framing"),
      phaseStarted("Hypothesis Generation"),
      { type: "artifact", artifact: hypothesisTree },
      phaseCompleted("Hypothesis Generation"),
      phaseStarted("Evidence Planning"),
      { type: "artifact", artifact: evidencePlan },
      phaseCompleted("Evidence Planning"),
      phaseStarted("Evidence Research")
    );

    const taskBoard = await screen.findByRole("region", {
      name: "Evidence research tasks"
    });
    await waitFor(() =>
      expect(taskBoard).toHaveTextContent("Researching Revenue Growth, Margin Durability")
    );

    await run.push({
      type: "artifact",
      artifact: { type: "evidence-cards", evidenceCards: [evidenceForNode("node-1")] }
    });

    await waitFor(() =>
      expect(within(taskBoard).getByRole("button", { name: /Revenue Growth/ })).toHaveTextContent(
        "complete"
      )
    );
    fireEvent.click(within(taskBoard).getByRole("button", { name: /Revenue Growth/ }));
    expect(taskBoard).toHaveTextContent("Evidence snippet.");

    await run.push(
      { type: "artifact", artifact: { type: "evidence-cards", evidenceCards: allEvidenceCards } },
      phaseCompleted("Evidence Research")
    );
    await run.close();
  });

  it("expands the completed seven-step timeline from the summary card", async () => {
    vi.stubGlobal("fetch", successfulRunFetch());

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    const summary = await screen.findByRole("button", {
      name: /Deep Research complete/
    });
    expect(summary).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(summary);

    expect(summary).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Memo Rendering")).toBeInTheDocument();
  });

  it("opens an audit trail from a memo claim and focuses linked evidence", async () => {
    vi.stubGlobal("fetch", successfulRunFetch());

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    const claimButton = await screen.findByRole("button", {
      name: /AI demand supports the valuation/i
    });
    fireEvent.click(claimButton);

    const auditTrail = screen.getByRole("region", { name: "Audit trail" });
    expect(auditTrail).toHaveTextContent("AI demand supports the valuation.");
    expect(auditTrail).toHaveTextContent("Revenue Growth");
    expect(auditTrail).toHaveTextContent("node-1 source");

    const evidencePanel = screen.getByRole("region", { name: "Evidence cards" });
    expect(within(evidencePanel).getByText("node-1 source")).toBeInTheDocument();
  });

  it("shows a server error when the run request is rejected", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return statusResponse();
      }
      if (url.includes("/api/research/run")) {
        return Response.json({ error: "Invalid research request." }, { status: 400 });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid research request.");
    await waitFor(() => expect(screen.getAllByText("failed")).toHaveLength(7));
  });

  it("surfaces a streamed run-failed event as an error", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return statusResponse();
      }
      if (url.includes("/api/research/run")) {
        return streamResponse([
          { type: "run-started", runId: "run-test", mode: "live-agent" },
          {
            type: "run-failed",
            error: "A MiroMind API key is required for this non-curated research task.",
            fallbackAvailable: false
          }
        ]);
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    expect(await screen.findByRole("alert")).toHaveTextContent("MiroMind API key is required");
    await waitFor(() => expect(screen.getAllByText("failed")).toHaveLength(7));
  });

  it("removes UI-only security fields before sending the research request", async () => {
    const fetchMock = successfulRunFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes("/api/research/run"))
      ).toBe(true)
    );
    const runCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/api/research/run")
    );
    const init = runCall?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));

    expect(body.security).toEqual(selectedRequest.security);
    expect(body.security).not.toHaveProperty("displayName");
  });
});
