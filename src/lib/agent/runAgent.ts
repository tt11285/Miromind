import { evidenceResearchOutputSchema } from "./schemas";
import { scoreAgentEvidence } from "./scoring";
import {
  createLocalEvidencePlan,
  frameTaskWithFallback,
  generateHypothesisTreeWithFallback,
  synthesizeMemoWithFallback,
  type StageClient
} from "./localResearch";
import {
  buildEvidenceResearchItemPrompt,
  buildEvidenceResearchPrompt
} from "./prompts";
import type {
  AgentArtifact,
  AgentEvent,
  AgentEvidenceCard,
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

interface RunAgentOptions {
  stageClient: StageClient;
  runId: string;
  now?: () => number;
  /**
   * Optional source-link verification applied to gathered evidence before
   * scoring. Injected by the route so unit tests stay network-free.
   */
  verifyEvidence?: (cards: AgentEvidenceCard[]) => Promise<AgentEvidenceCard[]>;
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
  const taskFrame = await frameTaskWithFallback({
    stageClient: options.stageClient,
    request
  });
  artifacts.push(taskFrame);
  yield { type: "artifact", artifact: taskFrame };
  yield* phaseCompleted(phases, "Task Framing", "Research task framed.");
  yield phaseMetric("Task Framing", phaseStartedAt, now, "complete");

  phaseStartedAt = now();
  yield* phaseStarted(phases, "Hypothesis Generation", "Generating a hypothesis tree.");
  const hypothesisTree = await generateHypothesisTreeWithFallback({
    stageClient: options.stageClient,
    frame: taskFrame,
    request
  });
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
  if (options.verifyEvidence) {
    const verifiedCards = await options.verifyEvidence(evidenceArtifact.evidenceCards);
    evidenceArtifact = { type: "evidence-cards", evidenceCards: verifiedCards };
    yield { type: "artifact", artifact: evidenceArtifact };
  }
  artifacts.push(evidenceArtifact);
  const verifiedCount = evidenceArtifact.evidenceCards.filter(
    (card) => card.provenanceStatus === "verified"
  ).length;
  yield* phaseCompleted(
    phases,
    "Evidence Research",
    `Evidence cards generated from ${evidencePlan.items.length} research tasks; ${verifiedCount} with verified source links.`
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
