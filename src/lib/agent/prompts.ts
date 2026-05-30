import type {
  AgentEvidenceCard,
  AgentRequest,
  EvidencePlanArtifact,
  HypothesisTreeArtifact,
  ScoredNodesArtifact,
  TaskFrameArtifact
} from "./types";

function jsonOnly(schemaName: string): string {
  return `Return JSON only. Do not include markdown. The JSON must match ${schemaName}.`;
}

export function buildTaskFramePrompt(request: AgentRequest): string {
  return [
    jsonOnly("TaskFrameOutput"),
    `Selected security: ${request.security.name} (${request.security.ticker}) on ${request.security.exchange}.`,
    `Country: ${request.security.country}. Asset type: ${request.security.assetType}.`,
    `Question: ${request.question}`,
    `Time horizon: ${request.timeHorizon}. Evidence preference: ${request.evidencePreference}.`,
    "Do not guess the company identity. Use the selected security exactly."
  ].join("\n");
}

export function buildHypothesisPrompt(
  frame: TaskFrameArtifact,
  request: AgentRequest
): string {
  const nodeTarget = request.researchDepth === "deep" ? "5 to 7" : "4";
  return [
    jsonOnly("HypothesisOutput"),
    `Root question: ${frame.rootQuestion}`,
    `Generate ${nodeTarget} hypothesis nodes.`,
    "Each node must include supporting evidence needs and counter-evidence needs."
  ].join("\n");
}

export function buildEvidencePlanPrompt(tree: HypothesisTreeArtifact): string {
  return [
    jsonOnly("EvidencePlanOutput"),
    `Root question: ${tree.rootQuestion}`,
    `Nodes: ${tree.nodes.map((node) => `${node.id}: ${node.claim}`).join("; ")}`,
    "For each node, produce research questions and preferred source types."
  ].join("\n");
}

export function buildEvidenceResearchPrompt(plan: EvidencePlanArtifact): string {
  return [
    jsonOnly("EvidenceResearchOutput"),
    `Evidence plan: ${JSON.stringify(plan)}`,
    "Return evidence cards with provenanceStatus set to verified, model-reported, or unavailable.",
    "Do not invent a URL. If the source cannot be verified, use provenanceStatus unavailable or model-reported."
  ].join("\n");
}

export function buildSynthesisPrompt(input: {
  frame: TaskFrameArtifact;
  tree: HypothesisTreeArtifact;
  evidence: AgentEvidenceCard[];
  scored: ScoredNodesArtifact;
}): string {
  return [
    jsonOnly("SynthesisOutput"),
    `Task frame: ${JSON.stringify(input.frame)}`,
    `Hypothesis tree: ${JSON.stringify(input.tree)}`,
    `Evidence cards: ${JSON.stringify(input.evidence)}`,
    `Scored nodes: ${JSON.stringify(input.scored)}`,
    "Use research-assistance language. Do not give personalized investment advice."
  ].join("\n");
}
