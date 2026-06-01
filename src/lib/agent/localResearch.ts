import { synthesisOutputSchema } from "./schemas";
import { buildSynthesisPrompt } from "./prompts";
import type {
  AgentEvidenceCard,
  AgentRequest,
  EvidencePlanArtifact,
  EvidencePlanItem,
  HypothesisTreeArtifact,
  MemoArtifact,
  ScoredNodesArtifact,
  TaskFrameArtifact
} from "./types";

export interface StageClient {
  completeJson<T>(
    stageName: string,
    prompt: string,
    schema: { parse(value: unknown): T }
  ): Promise<T>;
}

export function createLocalTaskFrame(request: AgentRequest): TaskFrameArtifact {
  return {
    type: "task-frame",
    securityName: request.security.name,
    ticker: request.security.ticker,
    sectorFrame: sectorFrameForTicker(request.security.ticker),
    rootQuestion: request.question,
    researchObjective: `Assess ${request.security.name} (${request.security.ticker}) against the user's research question over a ${request.timeHorizon} horizon.`,
    decisionCriteria: [
      "Growth durability",
      "Margin and cash-flow quality",
      "Competitive position",
      "Valuation sensitivity",
      "Counter-evidence strength"
    ],
    evidenceCategories: categoriesForPreference(request.evidencePreference),
    safetyNote: "Research assistance only. This is not personalized investment advice."
  };
}

export function createLocalHypothesisTree(
  frame: TaskFrameArtifact,
  request: AgentRequest
): HypothesisTreeArtifact {
  const labels = labelsForQuestion(request.question);
  const weight = Number((1 / labels.length).toFixed(2));

  return {
    type: "hypothesis-tree",
    rootQuestion: frame.rootQuestion,
    nodes: labels.map((label, index) => {
      const id = `${slugify(label)}-${index + 1}`;
      return {
        id,
        label,
        claim: `${label} is material to answering whether ${request.security.ticker} is supported by the current fundamentals and risk profile.`,
        whyItMatters: `${label} can change the conclusion by altering expected growth, durability, risk, or valuation tolerance.`,
        weight,
        evidenceNeeded: [
          `${request.security.ticker} company filings or investor materials related to ${label}`,
          `Recent earnings call commentary related to ${label}`
        ],
        counterEvidenceNeeded: [
          `Evidence that weakens the ${label} thesis`,
          `Recent market, customer, or competitive signals that contradict management commentary`
        ]
      };
    })
  };
}

export function createLocalEvidencePlan(
  tree: HypothesisTreeArtifact,
  request: AgentRequest
): EvidencePlanArtifact {
  return {
    type: "evidence-plan",
    items: tree.nodes.map<EvidencePlanItem>((node) => ({
      nodeId: node.id,
      researchQuestions: [
        `What evidence supports or refutes "${node.label}" for ${request.security.name} (${request.security.ticker})?`,
        `What changed recently that would affect this node over a ${request.timeHorizon} horizon?`
      ],
      preferredSourceTypes: sourceTypesForPreference(request.evidencePreference),
      sourceCandidates: [
        `${request.security.name} latest earnings call`,
        `${request.security.name} latest 10-K or 10-Q`,
        `${request.security.ticker} investor relations presentation`,
        `${request.security.ticker} reputable market data or industry analysis`
      ],
      supportingSignals: node.evidenceNeeded,
      refutingSignals: node.counterEvidenceNeeded
    }))
  };
}

export async function synthesizeMemoWithFallback(input: {
  stageClient: StageClient;
  taskFrame: TaskFrameArtifact;
  hypothesisTree: HypothesisTreeArtifact;
  evidence: AgentEvidenceCard[];
  scoredNodes: ScoredNodesArtifact;
}): Promise<MemoArtifact> {
  try {
    const synthesis = await input.stageClient.completeJson(
      "Reasoning Synthesis",
      buildSynthesisPrompt({
        frame: input.taskFrame,
        tree: input.hypothesisTree,
        evidence: input.evidence,
        scored: input.scoredNodes
      }),
      synthesisOutputSchema
    );
    return {
      type: "memo",
      finalScore: input.scoredNodes.finalScore,
      ...synthesis
    };
  } catch {
    return createFallbackMemo(input.taskFrame, input.evidence, input.scoredNodes);
  }
}

export function createFallbackMemo(
  frame: TaskFrameArtifact,
  evidence: AgentEvidenceCard[],
  scoredNodes: ScoredNodesArtifact
): MemoArtifact {
  const unavailableCount = evidence.filter((card) => card.provenanceStatus === "unavailable").length;
  const strongestNodes = [...scoredNodes.nodes]
    .sort((left, right) => Math.abs(right.weightedScore) - Math.abs(left.weightedScore))
    .slice(0, 3);

  return {
    type: "memo",
    executiveSummary: `The run completed with limited live evidence after one or more MiroMind calls failed or timed out. Current score is ${scoredNodes.finalScore}, so the evidence-backed stance is ${scoredNodes.finalStance}. Treat unavailable evidence cards as audit flags before making any decision.`,
    finalStance: scoredNodes.finalStance,
    confidence: scoredNodes.confidence,
    finalScore: scoredNodes.finalScore,
    keyDrivers: strongestNodes.map((node) => `${node.label}: ${node.stance}`),
    biggestCounterargument:
      unavailableCount > 0
        ? `${unavailableCount} evidence tasks did not return verified live evidence.`
        : "The strongest counter-evidence should be manually reviewed against primary sources.",
    whatWouldChangeTheView: strongestNodes.map((node) => node.whatWouldChange),
    humanReviewChecklist: [
      "Verify unavailable or model-reported evidence against primary filings and earnings transcripts.",
      "Check whether the evidence dates are current enough for the selected time horizon.",
      "Review counter-evidence before treating the final stance as decision-ready."
    ],
    sections: scoredNodes.nodes.map((node) => ({
      id: node.id,
      title: node.label,
      body: `${node.reasoningNote} Current stance: ${node.stance}. This section was rendered locally because live synthesis was unavailable.`,
      linkedNodeIds: [node.id],
      linkedEvidenceIds: [...node.supportingEvidenceIds, ...node.counterEvidenceIds]
    }))
  };
}

function sectorFrameForTicker(ticker: string): string {
  const frames: Record<string, string> = {
    NVDA: "AI accelerators, data center platforms, networking, and accelerated computing",
    MSFT: "enterprise software, cloud infrastructure, AI copilots, and productivity platforms",
    MU: "memory semiconductors, HBM, DRAM/NAND pricing cycles, and AI infrastructure supply",
    TSLA: "electric vehicles, autonomy, energy storage, and robotaxi optionality"
  };
  return frames[ticker] ?? "listed-company fundamentals, competitive position, and valuation";
}

function labelsForQuestion(question: string): string[] {
  const normalized = question.toLowerCase();
  if (normalized.includes("downside") || normalized.includes("risk")) {
    return ["Demand Risk", "Margin Risk", "Execution Risk", "Competitive Risk", "Valuation Downside"];
  }
  if (normalized.includes("bull") || normalized.includes("bear") || normalized.includes("diverge")) {
    return ["Growth Assumption Gap", "Margin Assumption Gap", "Market Size Gap", "Competition Gap", "Valuation Gap"];
  }
  if (normalized.includes("earnings")) {
    return ["Revenue Surprise", "Guidance Change", "Margin Trend", "Segment Momentum", "Management Tone"];
  }
  return ["Revenue Growth", "Margin Durability", "Demand Sustainability", "Competitive Moat", "Valuation Sensitivity"];
}

function categoriesForPreference(preference: AgentRequest["evidencePreference"]): string[] {
  if (preference === "financials") return ["Filings", "financial statements", "market data"];
  if (preference === "earnings") return ["Earnings calls", "guidance", "management commentary"];
  if (preference === "news") return ["Recent news", "industry events", "market data"];
  return ["Filings", "earnings calls", "market data", "news", "industry context"];
}

function sourceTypesForPreference(preference: AgentRequest["evidencePreference"]): EvidencePlanItem["preferredSourceTypes"] {
  if (preference === "financials") return ["filing", "market-data", "earnings"];
  if (preference === "earnings") return ["earnings", "filing", "market-data"];
  if (preference === "news") return ["news", "industry", "market-data"];
  return ["filing", "earnings", "market-data", "news"];
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
