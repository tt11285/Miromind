import type {
  AgentEvidenceCard,
  Confidence,
  EvidenceDirection,
  EvidenceProvenanceStatus,
  FinalStance,
  HypothesisTreeArtifact,
  NodeStance,
  ScoredNodesArtifact
} from "./types";

const directionScore: Record<EvidenceDirection, number> = {
  supports: 1,
  complicates: -0.25,
  refutes: -1
};

const provenanceScore: Record<EvidenceProvenanceStatus, number> = {
  verified: 1,
  "model-reported": 0.75,
  unavailable: 0.35
};

export function scoreAgentEvidence(
  tree: HypothesisTreeArtifact,
  evidence: AgentEvidenceCard[]
): ScoredNodesArtifact {
  const nodes = tree.nodes.map((node) => {
    const nodeEvidence = evidence.filter((card) => card.nodeId === node.id);
    const rawScore = nodeEvidence.reduce((sum, card) => {
      const reliability = card.reliabilityScore ?? provenanceScore[card.provenanceStatus];
      const relevance = card.relevanceScore ?? 0.8;
      const freshness = card.freshnessScore ?? 0.75;

      return (
        sum +
        directionScore[card.direction] * reliability * relevance * freshness
      );
    }, 0);
    const weightedScore = Number((rawScore * node.weight).toFixed(2));
    const supportingEvidenceIds = nodeEvidence
      .filter((card) => card.direction === "supports")
      .map((card) => card.id);
    const counterEvidenceIds = nodeEvidence
      .filter((card) => card.direction === "refutes" || card.direction === "complicates")
      .map((card) => card.id);

    return {
      id: node.id,
      label: node.label,
      claim: node.claim,
      weight: node.weight,
      stance: stanceForScore(weightedScore),
      confidence: confidenceForEvidence(nodeEvidence.length),
      weightedScore,
      reasoningNote: `Scored ${nodeEvidence.length} evidence cards for ${node.label}.`,
      whatWouldChange: node.counterEvidenceNeeded.join("; "),
      supportingEvidenceIds,
      counterEvidenceIds
    };
  });

  const finalScore = Number(
    nodes.reduce((sum, node) => sum + node.weightedScore, 0).toFixed(2)
  );

  return {
    type: "scored-nodes",
    nodes,
    finalScore,
    finalStance: finalStanceForScore(finalScore),
    confidence: confidenceForEvidence(evidence.length)
  };
}

function stanceForScore(score: number): NodeStance {
  if (score >= 0.5) return "supports";
  if (score > 0) return "weakly-supports";
  if (score === 0) return "mixed";
  if (score > -0.5) return "weakly-refutes";
  return "refutes";
}

function finalStanceForScore(score: number): FinalStance {
  if (score >= 1.2) return "Supported";
  if (score >= 0.25) return "Partially Supported";
  if (score > -0.25) return "Inconclusive";
  if (score > -1.2) return "Weakly Unsupported";
  return "Not Supported";
}

function confidenceForEvidence(count: number): Confidence {
  if (count >= 10) return "High";
  if (count >= 6) return "Medium-High";
  if (count >= 2) return "Medium";
  return "Low";
}
