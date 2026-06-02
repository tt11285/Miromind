import type {
  AgentEvidenceCard,
  MemoArtifact,
  MemoClaim,
  MemoClaimType,
  ScoredNode,
  ScoredNodesArtifact
} from "./types";

export function attachMemoClaims(
  memo: Omit<MemoArtifact, "claims"> | MemoArtifact,
  scoredNodes: ScoredNodesArtifact,
  evidence: AgentEvidenceCard[]
): MemoArtifact {
  return {
    ...memo,
    claims: createMemoClaims(memo, scoredNodes, evidence)
  };
}

export function createMemoClaims(
  memo: Omit<MemoArtifact, "claims"> | MemoArtifact,
  scoredNodes: ScoredNodesArtifact,
  evidence: AgentEvidenceCard[]
): MemoClaim[] {
  const claims: MemoClaim[] = [];
  const nodesById = new Map(scoredNodes.nodes.map((node) => [node.id, node]));

  claims.push(
    createClaim({
      claimType: "executive-summary",
      text: memo.executiveSummary,
      nodes: topNodes(scoredNodes.nodes),
      evidence,
      score: scoredNodes.finalScore,
      stance: scoredNodes.finalStance,
      confidence: scoredNodes.confidence
    })
  );

  memo.keyDrivers.forEach((driver, index) => {
    const nodes = bestNodesForText(driver, scoredNodes.nodes, "supportive");
    claims.push(
      createClaim({
        claimType: "driver",
        text: driver,
        nodes,
        evidence,
        index,
        evidenceMode: "supporting"
      })
    );
  });

  claims.push(
    createClaim({
      claimType: "counterargument",
      text: memo.biggestCounterargument,
      nodes: bestNodesForText(memo.biggestCounterargument, scoredNodes.nodes, "counter"),
      evidence,
      evidenceMode: "counter"
    })
  );

  memo.whatWouldChangeTheView.forEach((item, index) => {
    claims.push(
      createClaim({
        claimType: "view-change",
        text: item,
        nodes: bestNodesForText(item, scoredNodes.nodes, "counter"),
        evidence,
        index
      })
    );
  });

  memo.humanReviewChecklist.forEach((item, index) => {
    claims.push(
      createClaim({
        claimType: "human-review",
        text: item,
        nodes: topNodes(scoredNodes.nodes),
        evidence,
        index
      })
    );
  });

  memo.sections.forEach((section, index) => {
    const linkedNodes = section.linkedNodeIds
      .map((nodeId) => nodesById.get(nodeId))
      .filter((node): node is ScoredNode => Boolean(node));
    claims.push({
      id: uniqueClaimId("section", section.body, index),
      claimType: "section",
      text: section.body,
      linkedNodeIds: section.linkedNodeIds,
      linkedEvidenceIds: section.linkedEvidenceIds,
      stance: linkedNodes[0]?.stance,
      confidence: linkedNodes[0]?.confidence,
      score: linkedNodes[0]?.weightedScore
    });
  });

  return dedupeClaims(claims);
}

function createClaim(input: {
  claimType: MemoClaimType;
  text: string;
  nodes: ScoredNode[];
  evidence: AgentEvidenceCard[];
  index?: number;
  evidenceMode?: "supporting" | "counter" | "all";
  score?: number;
  stance?: MemoClaim["stance"];
  confidence?: MemoClaim["confidence"];
}): MemoClaim {
  const nodes = input.nodes.length > 0 ? input.nodes : [];
  const linkedNodeIds = nodes.map((node) => node.id);
  return {
    id: uniqueClaimId(input.claimType, input.text, input.index),
    claimType: input.claimType,
    text: input.text,
    linkedNodeIds,
    linkedEvidenceIds: evidenceIdsForNodes(nodes, input.evidence, input.evidenceMode ?? "all"),
    stance: input.stance ?? nodes[0]?.stance,
    confidence: input.confidence ?? nodes[0]?.confidence,
    score: input.score ?? nodes[0]?.weightedScore
  };
}

function bestNodesForText(
  text: string,
  nodes: ScoredNode[],
  fallback: "supportive" | "counter"
): ScoredNode[] {
  const normalized = normalize(text);
  const directMatches = nodes.filter((node) => {
    const label = normalize(node.label);
    const compactLabel = label.replace(/\s+/g, "");
    return normalized.includes(label) || normalized.replace(/\s+/g, "").includes(compactLabel);
  });
  if (directMatches.length > 0) {
    return directMatches.slice(0, 2);
  }

  const sorted = [...nodes].sort((left, right) =>
    fallback === "supportive"
      ? right.weightedScore - left.weightedScore
      : left.weightedScore - right.weightedScore
  );
  return sorted.slice(0, 1);
}

function topNodes(nodes: ScoredNode[]): ScoredNode[] {
  return [...nodes]
    .sort((left, right) => Math.abs(right.weightedScore) - Math.abs(left.weightedScore))
    .slice(0, 3);
}

function evidenceIdsForNodes(
  nodes: ScoredNode[],
  evidence: AgentEvidenceCard[],
  mode: "supporting" | "counter" | "all"
): string[] {
  const explicitIds = nodes.flatMap((node) => {
    if (mode === "supporting") {
      return node.supportingEvidenceIds;
    }
    if (mode === "counter") {
      return node.counterEvidenceIds;
    }
    return [...node.supportingEvidenceIds, ...node.counterEvidenceIds];
  });

  const fallbackIds = evidence
    .filter((card) => nodes.some((node) => node.id === card.nodeId))
    .filter((card) => {
      if (mode === "supporting") return card.direction === "supports";
      if (mode === "counter") return card.direction !== "supports";
      return true;
    })
    .map((card) => card.id);

  return [...new Set([...explicitIds, ...fallbackIds])];
}

function dedupeClaims(claims: MemoClaim[]): MemoClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.claimType}:${claim.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueClaimId(type: MemoClaimType, text: string, index = 0): string {
  return `claim-${type}-${index}-${slugify(text).slice(0, 48)}`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  return normalize(value).replace(/\s+/g, "-") || "memo-claim";
}
