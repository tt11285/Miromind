import {
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

function statusResponse() {
  return Response.json({
    liveAvailable: true,
    model: "mirothinker-1-7-deepresearch",
    fallbackAvailable: true
  });
}

function successfulFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/research/status")) {
      return statusResponse();
    }
    if (url.includes("/api/research/plan")) {
      return Response.json({ taskFrame, hypothesisTree, evidencePlan });
    }
    if (url.includes("/api/research/evidence")) {
      const body = JSON.parse(String(init?.body)) as {
        item: EvidencePlanArtifact["items"][number];
      };
      return Response.json({ evidenceCards: [evidenceForNode(body.item.nodeId)] });
    }
    if (url.includes("/api/research/synthesis")) {
      return Response.json({ memo });
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
  it("launches with motion state and reveals timeline steps progressively", async () => {
    let resolvePlan: (response: Response) => void = () => {};
    let holdEvidence = true;
    const evidenceResolvers: Array<() => void> = [];
    const planPromise = new Promise<Response>((resolve) => {
      resolvePlan = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return statusResponse();
      }
      if (url.includes("/api/research/plan")) {
        return planPromise;
      }
      if (url.includes("/api/research/evidence")) {
        const body = JSON.parse(String(init?.body)) as {
          item: EvidencePlanArtifact["items"][number];
        };
        if (!holdEvidence) {
          return Response.json({ evidenceCards: [evidenceForNode(body.item.nodeId)] });
        }
        return new Promise<Response>((resolve) => {
          evidenceResolvers.push(() => {
            resolve(Response.json({ evidenceCards: [evidenceForNode(body.item.nodeId)] }));
          });
        });
      }
      if (url.includes("/api/research/synthesis")) {
        return Response.json({ memo });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    expect(screen.getByRole("button", { name: "Running Research" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Running Research" })).not.toHaveClass("launching");
    expect(screen.getByRole("main")).toHaveClass("running-active");
    expect(await screen.findByText("Task Framing")).toBeInTheDocument();
    expect(screen.queryByText("Hypothesis Generation")).not.toBeInTheDocument();
    expect(screen.getByText("Thinking")).toBeInTheDocument();

    resolvePlan(Response.json({ taskFrame, hypothesisTree, evidencePlan }));

    expect(await screen.findByText("Hypothesis Generation")).toBeInTheDocument();
    expect(await screen.findByText("Evidence Research")).toBeInTheDocument();
    holdEvidence = false;
    evidenceResolvers.splice(0).forEach((resolve) => resolve());
    expect(await screen.findByText("Deep Research complete", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("runs evidence tasks as separate requests with frontend concurrency capped at 2", async () => {
    let activeEvidenceRequests = 0;
    let maxActiveEvidenceRequests = 0;
    const evidenceResolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return statusResponse();
      }
      if (url.includes("/api/research/plan")) {
        return Response.json({ taskFrame, hypothesisTree, evidencePlan });
      }
      if (url.includes("/api/research/evidence")) {
        activeEvidenceRequests += 1;
        maxActiveEvidenceRequests = Math.max(maxActiveEvidenceRequests, activeEvidenceRequests);
        const body = JSON.parse(String(init?.body)) as {
          item: EvidencePlanArtifact["items"][number];
        };
        return new Promise<Response>((resolve) => {
          evidenceResolvers.push((response) => {
            activeEvidenceRequests -= 1;
            resolve(response);
          });
          void body;
        });
      }
      if (url.includes("/api/research/synthesis")) {
        return Response.json({ memo });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    await waitFor(() => expect(evidenceResolvers).toHaveLength(2));
    expect(maxActiveEvidenceRequests).toBe(2);

    evidenceResolvers.splice(0, 2).forEach((resolve, index) => {
      resolve(Response.json({ evidenceCards: [evidenceForNode(evidencePlan.items[index].nodeId)] }));
    });
    await waitFor(() => expect(evidenceResolvers).toHaveLength(2));
    expect(maxActiveEvidenceRequests).toBe(2);

    evidenceResolvers.splice(0, 2).forEach((resolve, index) => {
      resolve(Response.json({ evidenceCards: [evidenceForNode(evidencePlan.items[index + 2].nodeId)] }));
    });
    await waitFor(() => expect(evidenceResolvers).toHaveLength(1));
    expect(maxActiveEvidenceRequests).toBe(2);

    evidenceResolvers.splice(0, 1).forEach((resolve) => {
      resolve(Response.json({ evidenceCards: [evidenceForNode(evidencePlan.items[4].nodeId)] }));
    });

    expect(await screen.findByText("Deep Research complete", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/research/evidence"))).toHaveLength(5);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/research/run"))).toBe(false);
  });

  it("retries a failed evidence task after a 5 second delay before synthesis", async () => {
    let firstNodeAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return statusResponse();
      }
      if (url.includes("/api/research/plan")) {
        return Response.json({ taskFrame, hypothesisTree, evidencePlan });
      }
      if (url.includes("/api/research/evidence")) {
        const body = JSON.parse(String(init?.body)) as {
          item: EvidencePlanArtifact["items"][number];
        };
        if (body.item.nodeId === "node-1") {
          firstNodeAttempts += 1;
          if (firstNodeAttempts === 1) {
            return Response.json({ error: "Temporary evidence failure." }, { status: 502 });
          }
        }
        return Response.json({ evidenceCards: [evidenceForNode(body.item.nodeId)] });
      }
      if (url.includes("/api/research/synthesis")) {
        return Response.json({ memo });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    await waitFor(() => expect(firstNodeAttempts).toBe(1));
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/research/synthesis"))).toBe(false);

    await waitFor(() => expect(firstNodeAttempts).toBe(2), { timeout: 7000 });
    expect(await screen.findByText("Deep Research complete", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/research/synthesis"))).toBe(true);
  }, 8000);

  it("runs the agent workflow and links memo trace to evidence", async () => {
    vi.stubGlobal("fetch", successfulFetch());

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    expect(await screen.findByText("Partially Supported", {}, { timeout: 3000 })).toBeInTheDocument();
    const memoPanel = screen.getByRole("region", { name: "Investment memo" });
    fireEvent.click(
      within(memoPanel).getByRole("button", { name: /Revenue Growth/ })
    );

    const evidencePanel = screen.getByRole("region", { name: "Evidence cards" });
    expect(within(evidencePanel).getByText("node-1 source")).toBeInTheDocument();
  });

  it("opens an audit trail from a memo claim and focuses linked evidence", async () => {
    vi.stubGlobal("fetch", successfulFetch());

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

  it("shows a server error instead of silently ignoring a failed plan response", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/research/status")) {
        return statusResponse();
      }
      if (url.includes("/api/research/plan")) {
        return Response.json({ error: "Invalid research request." }, { status: 400 });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid research request."
    );
    await waitFor(() => expect(screen.getAllByText("failed")).toHaveLength(7));
  });

  it("removes UI-only security fields before sending the research request", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveResearchWorkbench />);
    runDefaultQuestion();

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/research/plan")
        )
      ).toBe(true)
    );
    const planCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/api/research/plan")
    );
    const init = planCall?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));

    expect(body.security).toEqual(selectedRequest.security);
    expect(body.security).not.toHaveProperty("displayName");
  });
});
