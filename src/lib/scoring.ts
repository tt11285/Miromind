import type {
  Confidence,
  EvidenceCard,
  EvidenceDirection,
  FinalStance,
  HypothesisNode,
  InvestmentMemo,
  NodeConclusion,
  NodeStance
} from "./types";

const directionScores: Record<EvidenceDirection, number> = {
  supports: 1,
  refutes: -1,
  complicates: -0.2
};

export function scoreToFinalStance(score: number): FinalStance {
  if (score >= 1.2) return "Supported";
  if (score >= 0.3) return "Partially Supported";
  if (score <= -1.2) return "Not Supported";
  if (score <= -0.3) return "Weakly Unsupported";
  return "Inconclusive";
}

export function scoreResearchArtifacts(
  nodes: HypothesisNode[],
  evidence: EvidenceCard[]
): { nodes: NodeConclusion[]; memo: InvestmentMemo } {
  const scoredNodes = nodes.map((node) => scoreNode(node, evidence));
  const finalScore = roundScore(
    scoredNodes.reduce((total, node) => total + node.weight * node.weightedScore, 0)
  );
  const memo = createInvestmentMemo(scoredNodes, evidence, finalScore);

  return { nodes: scoredNodes, memo };
}

function scoreNode(node: HypothesisNode, evidence: EvidenceCard[]): NodeConclusion {
  const nodeEvidence = evidence.filter((card) => card.claimNodeId === node.id);
  const evidenceScore = clampScore(
    nodeEvidence.reduce(
      (total, card) => total + directionScores[card.direction] * evidenceWeight(card),
      0
    )
  );
  const stance = scoreToNodeStance(evidenceScore);
  const weightedScore = roundScore(evidenceScore);

  return {
    ...node,
    stance,
    confidence: scoreToNodeConfidence(nodeEvidence, evidenceScore),
    weightedScore,
    reasoningNote: createNodeReasoningNote(node, nodeEvidence, evidenceScore),
    supportingEvidence: nodeEvidence.filter((card) => card.direction === "supports"),
    counterEvidence: nodeEvidence.filter((card) => card.direction !== "supports")
  };
}

function evidenceWeight(card: EvidenceCard): number {
  return card.reliabilityScore * 0.4 + card.relevanceScore * 0.4 + card.freshnessScore * 0.2;
}

function scoreToNodeStance(score: number): NodeStance {
  if (score >= 1.1) return "supports";
  if (score >= 0.3) return "weakly-supports";
  if (score <= -1.1) return "refutes";
  if (score <= -0.3) return "weakly-refutes";
  return "mixed";
}

function scoreToNodeConfidence(cards: EvidenceCard[], score: number): Confidence {
  if (cards.length === 0) return "Low";

  const averageReliability =
    cards.reduce((total, card) => total + card.reliabilityScore, 0) / cards.length;
  const hasConflict =
    cards.some((card) => card.direction === "supports") &&
    cards.some((card) => card.direction === "refutes");

  if (averageReliability > 0.82 && Math.abs(score) > 0.6 && !hasConflict) return "High";
  if (averageReliability > 0.76 && Math.abs(score) > 0.25) return "Medium-High";
  if (averageReliability > 0.65) return "Medium";
  return "Low";
}

function finalConfidence(nodes: NodeConclusion[], finalScore: number): Confidence {
  const lowConfidenceCount = nodes.filter((node) => node.confidence === "Low").length;
  const mixedCount = nodes.filter((node) => node.stance === "mixed").length;

  if (lowConfidenceCount > 1) return "Medium";
  if (mixedCount > 1 || Math.abs(finalScore) < 0.5) return "Medium";
  return "Medium-High";
}

function createInvestmentMemo(
  nodes: NodeConclusion[],
  evidence: EvidenceCard[],
  finalScore: number
): InvestmentMemo {
  const topDrivers = nodes
    .filter((node) => node.weightedScore > 0)
    .sort(
      (left, right) =>
        right.weight * right.weightedScore - left.weight * left.weightedScore
    )
    .slice(0, 3);
  const counterNodes = nodes
    .filter((node) => node.weightedScore < 0 || node.counterEvidence.length > 0)
    .sort((left, right) => left.weightedScore - right.weightedScore);
  const biggestCounterargument = counterNodes[0];
  const confidence = finalConfidence(nodes, finalScore);

  return {
    executiveSummary: createExecutiveSummary(finalScore, topDrivers, biggestCounterargument),
    finalStance: scoreToFinalStance(finalScore),
    confidence,
    finalScore,
    keyDrivers: topDrivers.map((node) => node.label),
    biggestCounterargument:
      biggestCounterargument?.reasoningNote ??
      "No material counterargument was identified in the available evidence.",
    whatWouldChangeTheView: nodes.map((node) => node.whatWouldChange),
    humanReviewChecklist: [
      "Confirm the highest-impact source dates and figures before publication.",
      "Review whether any missing evidence would materially change the final stance.",
      "Validate that counterevidence has been represented fairly."
    ],
    sections: nodes.map((node) => ({
      id: `${node.id}-section`,
      title: node.label,
      body: node.reasoningNote,
      linkedNodeIds: [node.id],
      linkedEvidenceIds: [
        ...node.supportingEvidence.map((card) => card.id),
        ...node.counterEvidence.map((card) => card.id)
      ]
    }))
  };
}

function createExecutiveSummary(
  finalScore: number,
  topDrivers: NodeConclusion[],
  biggestCounterargument?: NodeConclusion
): string {
  const driverText =
    topDrivers.length > 0
      ? topDrivers.map((node) => node.label).join(", ")
      : "the available evidence";
  const counterText = biggestCounterargument
    ? ` The main counterweight is ${biggestCounterargument.label}.`
    : "";

  return `The weighted evidence score is ${finalScore}, led by ${driverText}.${counterText}`;
}

function createNodeReasoningNote(
  node: HypothesisNode,
  evidence: EvidenceCard[],
  score: number
): string {
  if (evidence.length === 0) {
    return `${node.label} has no directly linked evidence yet.`;
  }

  const supportCount = evidence.filter((card) => card.direction === "supports").length;
  const counterCount = evidence.length - supportCount;

  return `${node.label} scores ${roundScore(score)} from ${supportCount} supporting and ${counterCount} countervailing evidence cards.`;
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

function clampScore(score: number): number {
  return Math.max(-2, Math.min(2, score));
}
