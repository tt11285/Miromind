import { createFixtureArtifacts } from "@/data/fixtures";
import { scoreResearchArtifacts } from "@/lib/scoring";
import type { EvidenceCard, ResearchTask } from "@/lib/types";
import type {
  AgentEvidenceCard,
  AgentPhase,
  AgentRequest,
  AgentRun,
  EvidenceCardsArtifact,
  EvidenceSourceType,
  HypothesisTreeArtifact,
  MemoArtifact,
  ScoredNodesArtifact,
  TaskFrameArtifact
} from "./types";

const nvdaFixtureTask: ResearchTask = {
  companyId: "nvda",
  questionTemplateId: "valuation-growth",
  timeHorizon: "12M",
  evidencePreference: "balanced"
};

const completedFallbackPhases: AgentPhase["name"][] = [
  "Task Framing",
  "Hypothesis Generation",
  "Evidence Planning",
  "Evidence Research",
  "Evidence Scoring",
  "Reasoning Synthesis",
  "Memo Rendering"
];

export function isCuratedFallbackEligible(request: AgentRequest): boolean {
  const question = request.question.toLowerCase();

  return (
    request.security.ticker === "NVDA" &&
    request.security.name === "NVIDIA Corporation" &&
    request.timeHorizon === "12M" &&
    request.evidencePreference === "balanced" &&
    question.includes("valuation") &&
    question.includes("growth")
  );
}

export function createFallbackRun(runId: string, request: AgentRequest): AgentRun {
  if (!isCuratedFallbackEligible(request)) {
    throw new Error("No curated fallback exists for this selected security and question.");
  }

  const artifacts = createFixtureArtifacts(nvdaFixtureTask);
  const scored = scoreResearchArtifacts(artifacts.nodes, artifacts.evidence);
  const taskFrame: TaskFrameArtifact = {
    type: "task-frame",
    securityName: request.security.name,
    ticker: request.security.ticker,
    sectorFrame: "AI accelerators and data center platforms",
    rootQuestion: artifacts.rootQuestion,
    researchObjective:
      "Assess whether AI growth fundamentals support NVIDIA's valuation.",
    decisionCriteria: [
      "Revenue growth",
      "Margin durability",
      "Demand sustainability",
      "Valuation sensitivity"
    ],
    evidenceCategories: ["Earnings", "Market data", "Industry commentary"],
    safetyNote: "Research assistance only, not personalized investment advice."
  };
  const hypothesisTree: HypothesisTreeArtifact = {
    type: "hypothesis-tree",
    rootQuestion: artifacts.rootQuestion,
    nodes: artifacts.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      claim: node.claim,
      whyItMatters: node.reasoningNote,
      weight: node.weight,
      evidenceNeeded: ["Supporting public evidence tied to this hypothesis."],
      counterEvidenceNeeded: [node.whatWouldChange]
    }))
  };
  const evidenceCards = artifacts.evidence.map(toAgentEvidenceCard);
  const evidenceArtifact: EvidenceCardsArtifact = {
    type: "evidence-cards",
    evidenceCards
  };
  const scoredNodes: ScoredNodesArtifact = {
    type: "scored-nodes",
    nodes: scored.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      claim: node.claim,
      weight: node.weight,
      stance: node.stance,
      confidence: node.confidence,
      weightedScore: node.weightedScore,
      reasoningNote: node.reasoningNote,
      whatWouldChange: node.whatWouldChange,
      supportingEvidenceIds: node.supportingEvidence.map((card) => card.id),
      counterEvidenceIds: node.counterEvidence.map((card) => card.id)
    })),
    finalScore: scored.memo.finalScore,
    finalStance: scored.memo.finalStance,
    confidence: scored.memo.confidence
  };
  const memo: MemoArtifact = {
    type: "memo",
    ...scored.memo
  };

  return {
    runId,
    mode: "demo-fallback",
    request,
    phases: completedFallbackPhases.map((name) => ({
      name,
      status: "complete",
      detail: "Loaded curated fallback artifacts because live MiroMind was unavailable."
    })),
    artifacts: [taskFrame, hypothesisTree, evidenceArtifact, scoredNodes, memo],
    taskFrame,
    hypothesisTree,
    evidenceCards,
    scoredNodes,
    memo
  };
}

function toAgentEvidenceCard(card: EvidenceCard): AgentEvidenceCard {
  return {
    id: card.id,
    nodeId: card.claimNodeId,
    sourceTitle: card.sourceTitle,
    sourceType: toAgentSourceType(card.sourceType),
    sourceDate: card.sourceDate,
    urlOrReference: card.urlOrReference,
    provenanceStatus: "model-reported",
    quotedSnippet: card.quotedSnippet,
    extractedFact: card.extractedFact,
    direction: card.direction,
    reasoningImpact: card.reasoningImpact,
    reliabilityScore: card.reliabilityScore,
    relevanceScore: card.relevanceScore,
    freshnessScore: card.freshnessScore
  };
}

function toAgentSourceType(sourceType: EvidenceCard["sourceType"]): EvidenceSourceType {
  return sourceType === "earnings-call" ? "earnings" : sourceType;
}
