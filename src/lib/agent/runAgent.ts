import { evidenceResearchOutputSchema, synthesisOutputSchema } from "./schemas";
import { scoreAgentEvidence } from "./scoring";
import {
  buildEvidenceResearchItemPrompt,
  buildEvidenceResearchPrompt,
  buildSynthesisPrompt
} from "./prompts";
import type {
  AgentArtifact,
  AgentEvent,
  AgentEvidenceCard,
  EvidencePlanItem,
  AgentPhase,
  AgentPhaseName,
  AgentRequest,
  AgentRun,
  EvidenceCardsArtifact,
  EvidencePlanArtifact,
  HypothesisTreeArtifact,
  MemoArtifact,
  ScoredNodesArtifact,
  TaskFrameArtifact
} from "./types";

interface StageClient {
  completeJson<T>(
    stageName: string,
    prompt: string,
    schema: { parse(value: unknown): T }
  ): Promise<T>;
}

interface RunAgentOptions {
  stageClient: StageClient;
  runId: string;
  now?: () => number;
}

const phaseNames: AgentPhaseName[] = [
  "Task Framing",
  "Hypothesis Generation",
  "Evidence Planning",
  "Evidence Research",
  "Evidence Scoring",
  "Reasoning Synthesis",
  "Memo Rendering"
];

const evidenceResearchConcurrency = 5;

export async function* runAgent(
  request: AgentRequest,
  options: RunAgentOptions
): AsyncGenerator<AgentEvent> {
  const now = options.now ?? Date.now;
  const phases = phaseNames.map<AgentPhase>((name) => ({
    name,
    status: "queued",
    detail: "Waiting to run."
  }));
  const artifacts: AgentArtifact[] = [];

  yield { type: "run-started", runId: options.runId, mode: "live-agent" };

  let phaseStartedAt = now();
  yield* phaseStarted(phases, "Task Framing", "Framing the selected security and research question.");
  const taskFrame = createLocalTaskFrame(request);
  artifacts.push(taskFrame);
  yield { type: "artifact", artifact: taskFrame };
  yield* phaseCompleted(phases, "Task Framing", "Research task framed.");
  yield phaseMetric("Task Framing", phaseStartedAt, now, "complete");

  phaseStartedAt = now();
  yield* phaseStarted(phases, "Hypothesis Generation", "Generating a hypothesis tree.");
  const hypothesisTree = createLocalHypothesisTree(taskFrame, request);
  artifacts.push(hypothesisTree);
  yield { type: "artifact", artifact: hypothesisTree };
  yield* phaseCompleted(phases, "Hypothesis Generation", "Hypothesis tree generated.");
  yield phaseMetric("Hypothesis Generation", phaseStartedAt, now, "complete");

  phaseStartedAt = now();
  yield* phaseStarted(phases, "Evidence Planning", "Planning evidence collection.");
  const evidencePlan = createLocalEvidencePlan(hypothesisTree, request);
  artifacts.push(evidencePlan);
  yield { type: "artifact", artifact: evidencePlan };
  yield* phaseCompleted(phases, "Evidence Planning", "Evidence plan generated.");
  yield phaseMetric("Evidence Planning", phaseStartedAt, now, "complete");

  phaseStartedAt = now();
  yield* phaseStarted(
    phases,
    "Evidence Research",
    `Researching ${evidencePlan.items.length} evidence tasks with up to ${Math.min(
      evidenceResearchConcurrency,
      evidencePlan.items.length
    )} concurrent workers.`
  );
  let evidenceArtifact: EvidenceCardsArtifact | null = null;
  for await (const artifact of researchEvidenceItems(evidencePlan, options.stageClient)) {
    evidenceArtifact = artifact;
    yield { type: "artifact", artifact };
  }
  if (!evidenceArtifact) {
    evidenceArtifact = {
      type: "evidence-cards",
      ...(await options.stageClient.completeJson(
        "Evidence Research",
        buildEvidenceResearchPrompt(evidencePlan),
        evidenceResearchOutputSchema
      ))
    };
    yield { type: "artifact", artifact: evidenceArtifact };
  }
  artifacts.push(evidenceArtifact);
  yield* phaseCompleted(
    phases,
    "Evidence Research",
    `Evidence cards generated from ${evidencePlan.items.length} research tasks.`
  );
  yield phaseMetric("Evidence Research", phaseStartedAt, now, "complete");

  phaseStartedAt = now();
  yield* phaseStarted(phases, "Evidence Scoring", "Scoring evidence and node conclusions.");
  const scoredNodes = scoreAgentEvidence(hypothesisTree, evidenceArtifact.evidenceCards);
  artifacts.push(scoredNodes);
  yield { type: "artifact", artifact: scoredNodes };
  yield* phaseCompleted(phases, "Evidence Scoring", "Evidence scored.");
  yield phaseMetric("Evidence Scoring", phaseStartedAt, now, "complete");

  phaseStartedAt = now();
  yield* phaseStarted(phases, "Reasoning Synthesis", "Synthesizing the investment memo.");
  const memo = await synthesizeMemoWithFallback({
    stageClient: options.stageClient,
    taskFrame,
    hypothesisTree,
    evidence: evidenceArtifact.evidenceCards,
    scoredNodes
  });
  artifacts.push(memo);
  yield { type: "artifact", artifact: memo };
  yield* phaseCompleted(phases, "Reasoning Synthesis", "Memo synthesized.");
  yield phaseMetric("Reasoning Synthesis", phaseStartedAt, now, "complete");

  phaseStartedAt = now();
  yield* phaseStarted(phases, "Memo Rendering", "Rendering the final memo.");
  yield* phaseCompleted(phases, "Memo Rendering", "Final memo ready.");
  yield phaseMetric("Memo Rendering", phaseStartedAt, now, "complete");

  const run: AgentRun = {
    runId: options.runId,
    mode: "live-agent",
    request,
    phases,
    artifacts,
    taskFrame,
    hypothesisTree,
    evidencePlan,
    evidenceCards: evidenceArtifact.evidenceCards,
    scoredNodes,
    memo
  };

  yield { type: "run-completed", run };
}

function createLocalTaskFrame(request: AgentRequest): TaskFrameArtifact {
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

function createLocalHypothesisTree(
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

function createLocalEvidencePlan(
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

async function synthesizeMemoWithFallback(input: {
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

function createFallbackMemo(
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

function phaseMetric(
  phase: AgentPhaseName,
  startedAt: number,
  now: () => number,
  status: "complete" | "failed"
): AgentEvent {
  return {
    type: "telemetry",
    metric: {
      kind: "phase",
      phase,
      durationMs: Math.max(0, now() - startedAt),
      status
    }
  };
}

async function* researchEvidenceItems(
  evidencePlan: EvidencePlanArtifact,
  stageClient: StageClient
): AsyncGenerator<EvidenceCardsArtifact> {
  const pendingItems = [...evidencePlan.items];
  const running = new Set<Promise<EvidenceCardsArtifact>>();
  const accumulatedCards: AgentEvidenceCard[] = [];
  const failedCards: AgentEvidenceCard[] = [];
  const failures: unknown[] = [];

  function startNextItem() {
    const item = pendingItems.shift();
    if (!item) {
      return;
    }

    const task = Promise.resolve()
      .then(() => stageClient.completeJson(
        "Evidence Research",
        buildEvidenceResearchItemPrompt(item),
        evidenceResearchOutputSchema
      ))
      .then((result) => ({
        type: "evidence-cards" as const,
        evidenceCards: result.evidenceCards
      }))
      .catch((error) => {
        failures.push(error);
        return {
          type: "evidence-cards" as const,
          evidenceCards: [createUnavailableEvidenceCard(item.nodeId, error)]
        };
      })
      .finally(() => {
        running.delete(task);
      });

    running.add(task);
  }

  while (running.size < evidenceResearchConcurrency && pendingItems.length > 0) {
    startNextItem();
  }

  while (running.size > 0) {
    const completed = await Promise.race(running);
    const newCards = completed.evidenceCards;
    if (newCards.every((card) => card.provenanceStatus === "unavailable")) {
      failedCards.push(...newCards);
    } else {
      accumulatedCards.push(...newCards);
    }

    while (running.size < evidenceResearchConcurrency && pendingItems.length > 0) {
      startNextItem();
    }

    yield {
      type: "evidence-cards",
      evidenceCards: [...accumulatedCards, ...failedCards]
    };
  }

  void failures;
}

function createUnavailableEvidenceCard(nodeId: string, error: unknown): AgentEvidenceCard {
  const message = error instanceof Error ? error.message : "Evidence research failed.";
  return {
    id: `ev-${nodeId}-unavailable`,
    nodeId,
    sourceTitle: "Evidence research unavailable",
    sourceType: "other",
    sourceDate: new Date().toISOString().slice(0, 10),
    urlOrReference: "No verified source returned by the live research call.",
    provenanceStatus: "unavailable",
    quotedSnippet: "Evidence research for this node did not return a verified source.",
    extractedFact: "The agent could not retrieve evidence for this node during the live run.",
    direction: "complicates",
    reasoningImpact: `Treat this node with caution until manually verified. ${message}`
  };
}

function* phaseStarted(
  phases: AgentPhase[],
  phase: AgentPhaseName,
  detail: string
): Generator<AgentEvent> {
  updatePhase(phases, phase, "running", detail);
  yield { type: "phase-started", phase, detail };
}

function* phaseCompleted(
  phases: AgentPhase[],
  phase: AgentPhaseName,
  detail: string
): Generator<AgentEvent> {
  updatePhase(phases, phase, "complete", detail);
  yield { type: "phase-completed", phase, detail };
}

function updatePhase(
  phases: AgentPhase[],
  name: AgentPhaseName,
  status: AgentPhase["status"],
  detail: string
) {
  const phase = phases.find((item) => item.name === name);
  if (phase) {
    phase.status = status;
    phase.detail = detail;
  }
}
