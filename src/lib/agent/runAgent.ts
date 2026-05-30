import {
  createTaskFrameOutputSchemaForSecurity,
  evidencePlanOutputSchema,
  evidenceResearchOutputSchema,
  hypothesisOutputSchema,
  synthesisOutputSchema
} from "./schemas";
import { scoreAgentEvidence } from "./scoring";
import {
  buildEvidencePlanPrompt,
  buildEvidenceResearchPrompt,
  buildHypothesisPrompt,
  buildSynthesisPrompt,
  buildTaskFramePrompt
} from "./prompts";
import type {
  AgentArtifact,
  AgentEvent,
  AgentPhase,
  AgentPhaseName,
  AgentRequest,
  AgentRun,
  EvidenceCardsArtifact,
  EvidencePlanArtifact,
  HypothesisTreeArtifact,
  MemoArtifact,
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

export async function* runAgent(
  request: AgentRequest,
  options: RunAgentOptions
): AsyncGenerator<AgentEvent> {
  const phases = phaseNames.map<AgentPhase>((name) => ({
    name,
    status: "queued",
    detail: "Waiting to run."
  }));
  const artifacts: AgentArtifact[] = [];

  yield { type: "run-started", runId: options.runId, mode: "live-agent" };

  yield* phaseStarted(phases, "Task Framing", "Framing the selected security and research question.");
  const taskFrame: TaskFrameArtifact = {
    type: "task-frame",
    ...(await options.stageClient.completeJson(
      "Task Framing",
      buildTaskFramePrompt(request),
      createTaskFrameOutputSchemaForSecurity(request.security)
    ))
  };
  artifacts.push(taskFrame);
  yield { type: "artifact", artifact: taskFrame };
  yield* phaseCompleted(phases, "Task Framing", "Research task framed.");

  yield* phaseStarted(phases, "Hypothesis Generation", "Generating a hypothesis tree.");
  const hypothesisTree: HypothesisTreeArtifact = {
    type: "hypothesis-tree",
    ...(await options.stageClient.completeJson(
      "Hypothesis Generation",
      buildHypothesisPrompt(taskFrame, request),
      hypothesisOutputSchema
    ))
  };
  artifacts.push(hypothesisTree);
  yield { type: "artifact", artifact: hypothesisTree };
  yield* phaseCompleted(phases, "Hypothesis Generation", "Hypothesis tree generated.");

  yield* phaseStarted(phases, "Evidence Planning", "Planning evidence collection.");
  const evidencePlan: EvidencePlanArtifact = {
    type: "evidence-plan",
    ...(await options.stageClient.completeJson(
      "Evidence Planning",
      buildEvidencePlanPrompt(hypothesisTree),
      evidencePlanOutputSchema
    ))
  };
  artifacts.push(evidencePlan);
  yield { type: "artifact", artifact: evidencePlan };
  yield* phaseCompleted(phases, "Evidence Planning", "Evidence plan generated.");

  yield* phaseStarted(phases, "Evidence Research", "Researching supporting and counter evidence.");
  const evidenceArtifact: EvidenceCardsArtifact = {
    type: "evidence-cards",
    ...(await options.stageClient.completeJson(
      "Evidence Research",
      buildEvidenceResearchPrompt(evidencePlan),
      evidenceResearchOutputSchema
    ))
  };
  artifacts.push(evidenceArtifact);
  yield { type: "artifact", artifact: evidenceArtifact };
  yield* phaseCompleted(phases, "Evidence Research", "Evidence cards generated.");

  yield* phaseStarted(phases, "Evidence Scoring", "Scoring evidence and node conclusions.");
  const scoredNodes = scoreAgentEvidence(hypothesisTree, evidenceArtifact.evidenceCards);
  artifacts.push(scoredNodes);
  yield { type: "artifact", artifact: scoredNodes };
  yield* phaseCompleted(phases, "Evidence Scoring", "Evidence scored.");

  yield* phaseStarted(phases, "Reasoning Synthesis", "Synthesizing the investment memo.");
  const synthesis = await options.stageClient.completeJson(
    "Reasoning Synthesis",
    buildSynthesisPrompt({
      frame: taskFrame,
      tree: hypothesisTree,
      evidence: evidenceArtifact.evidenceCards,
      scored: scoredNodes
    }),
    synthesisOutputSchema
  );
  const memo: MemoArtifact = {
    type: "memo",
    finalScore: scoredNodes.finalScore,
    ...synthesis
  };
  artifacts.push(memo);
  yield { type: "artifact", artifact: memo };
  yield* phaseCompleted(phases, "Reasoning Synthesis", "Memo synthesized.");

  yield* phaseStarted(phases, "Memo Rendering", "Rendering the final memo.");
  yield* phaseCompleted(phases, "Memo Rendering", "Final memo ready.");

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
