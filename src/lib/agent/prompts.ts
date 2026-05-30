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

const taskFrameShape = `TaskFrameOutput fields:
{
  "securityName": string,
  "ticker": string,
  "sectorFrame": string,
  "rootQuestion": string,
  "researchObjective": string,
  "decisionCriteria": string[],
  "evidenceCategories": string[],
  "safetyNote": string
}`;

const hypothesisShape = `HypothesisOutput fields:
{
  "rootQuestion": string,
  "nodes": [
    {
      "id": string,
      "label": string,
      "claim": string,
      "whyItMatters": string,
      "weight": number,
      "evidenceNeeded": string[],
      "counterEvidenceNeeded": string[]
    }
  ]
}`;

const evidencePlanShape = `EvidencePlanOutput fields:
{
  "items": [
    {
      "nodeId": string,
      "researchQuestions": string[],
      "preferredSourceTypes": ("filing" | "earnings" | "market-data" | "news" | "industry" | "other")[],
      "sourceCandidates": string[],
      "supportingSignals": string[],
      "refutingSignals": string[]
    }
  ]
}`;

const evidenceResearchShape = `EvidenceResearchOutput fields:
{
  "evidenceCards": [
    {
      "id": string,
      "nodeId": string,
      "sourceTitle": string,
      "sourceType": "filing" | "earnings" | "market-data" | "news" | "industry" | "other",
      "sourceDate": string,
      "urlOrReference": string,
      "provenanceStatus": "verified" | "model-reported" | "unavailable",
      "quotedSnippet": string,
      "extractedFact": string,
      "direction": "supports" | "refutes" | "complicates",
      "reasoningImpact": string,
      "reliabilityScore": number | undefined,
      "relevanceScore": number | undefined,
      "freshnessScore": number | undefined
    }
  ]
}`;

const synthesisShape = `SynthesisOutput fields:
{
  "executiveSummary": string,
  "finalStance": "Supported" | "Partially Supported" | "Inconclusive" | "Weakly Unsupported" | "Not Supported",
  "confidence": "High" | "Medium-High" | "Medium" | "Low",
  "keyDrivers": string[],
  "biggestCounterargument": string,
  "whatWouldChangeTheView": string[],
  "humanReviewChecklist": string[],
  "sections": [
    {
      "id": string,
      "title": string,
      "body": string,
      "linkedNodeIds": string[],
      "linkedEvidenceIds": string[]
    }
  ]
}`;

export function buildTaskFramePrompt(request: AgentRequest): string {
  return [
    jsonOnly("TaskFrameOutput"),
    taskFrameShape,
    `Selected security: ${request.security.name} (${request.security.ticker}) on ${request.security.exchange}.`,
    `Country: ${request.security.country}. Asset type: ${request.security.assetType}.`,
    `Question: ${request.question}`,
    `Time horizon: ${request.timeHorizon}. Evidence preference: ${request.evidencePreference}.`,
    "Do not guess the ticker or company identity.",
    `Use selected security.name exactly: ${request.security.name}`,
    `Use selected security.ticker exactly: ${request.security.ticker}`
  ].join("\n");
}

export function buildHypothesisPrompt(
  frame: TaskFrameArtifact,
  request: AgentRequest
): string {
  const nodeTarget = request.researchDepth === "deep" ? "5 to 7" : "4";
  return [
    jsonOnly("HypothesisOutput"),
    hypothesisShape,
    `Task frame context: ${JSON.stringify(frame)}`,
    `Generate ${nodeTarget} hypothesis nodes.`,
    "Each node must include supporting evidence needs and counter-evidence needs."
  ].join("\n");
}

export function buildEvidencePlanPrompt(tree: HypothesisTreeArtifact): string {
  return [
    jsonOnly("EvidencePlanOutput"),
    evidencePlanShape,
    `Hypothesis tree context: ${JSON.stringify(tree)}`,
    "For each node, produce research questions and preferred source types."
  ].join("\n");
}

export function buildEvidenceResearchPrompt(plan: EvidencePlanArtifact): string {
  return [
    jsonOnly("EvidenceResearchOutput"),
    evidenceResearchShape,
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
    synthesisShape,
    `Task frame: ${JSON.stringify(input.frame)}`,
    `Hypothesis tree: ${JSON.stringify(input.tree)}`,
    `Evidence cards: ${JSON.stringify(input.evidence)}`,
    `Scored nodes: ${JSON.stringify(input.scored)}`,
    "Use research-assistance language. Do not give personalized investment advice."
  ].join("\n");
}
