export type AssetType = "Equity";
export type TimeHorizon = "3M" | "12M" | "3Y";
export type ResearchDepth = "fast" | "deep";
export type EvidencePreference = "balanced" | "financials" | "earnings" | "news";
export type AgentMode = "live-agent" | "demo-fallback";
export type PhaseStatus = "queued" | "running" | "complete" | "failed";
export type EvidenceDirection = "supports" | "refutes" | "complicates";
export type EvidenceSourceType =
  | "filing"
  | "earnings"
  | "market-data"
  | "news"
  | "industry"
  | "other";
export type EvidenceProvenanceStatus = "verified" | "model-reported" | "unavailable";
export type NodeStance =
  | "supports"
  | "weakly-supports"
  | "mixed"
  | "weakly-refutes"
  | "refutes";
export type FinalStance =
  | "Supported"
  | "Partially Supported"
  | "Inconclusive"
  | "Weakly Unsupported"
  | "Not Supported";
export type Confidence = "High" | "Medium-High" | "Medium" | "Low";

export interface ListedSecurity {
  name: string;
  ticker: string;
  exchange: string;
  country: string;
  assetType: AssetType;
}

export interface AgentRequest {
  security: ListedSecurity;
  question: string;
  timeHorizon: TimeHorizon;
  researchDepth: ResearchDepth;
  evidencePreference: EvidencePreference;
  fallbackAllowed: boolean;
}

export type AgentPhaseName =
  | "Task Framing"
  | "Hypothesis Generation"
  | "Evidence Planning"
  | "Evidence Research"
  | "Evidence Scoring"
  | "Reasoning Synthesis"
  | "Memo Rendering";

export interface AgentPhase {
  name: AgentPhaseName;
  status: PhaseStatus;
  detail: string;
}

export interface AgentPhaseMetric {
  kind: "phase";
  phase: AgentPhaseName;
  durationMs: number;
  status: "complete" | "failed";
}

export interface MiroMindRequestMetric {
  kind: "miromind-request";
  stageName: string;
  attempt: "primary" | "repair";
  durationMs: number;
  status: "success" | "failed";
  error?: string;
}

export type AgentTelemetryMetric = AgentPhaseMetric | MiroMindRequestMetric;

export interface TaskFrameArtifact {
  type: "task-frame";
  securityName: string;
  ticker: string;
  sectorFrame: string;
  rootQuestion: string;
  researchObjective: string;
  decisionCriteria: string[];
  evidenceCategories: string[];
  safetyNote: string;
}

export interface HypothesisNodeDraft {
  id: string;
  label: string;
  claim: string;
  whyItMatters: string;
  weight: number;
  evidenceNeeded: string[];
  counterEvidenceNeeded: string[];
}

export interface HypothesisTreeArtifact {
  type: "hypothesis-tree";
  rootQuestion: string;
  nodes: HypothesisNodeDraft[];
}

export interface EvidencePlanItem {
  nodeId: string;
  researchQuestions: string[];
  preferredSourceTypes: EvidenceSourceType[];
  sourceCandidates: string[];
  supportingSignals: string[];
  refutingSignals: string[];
}

export interface EvidencePlanArtifact {
  type: "evidence-plan";
  items: EvidencePlanItem[];
}

export interface AgentEvidenceCard {
  id: string;
  nodeId: string;
  sourceTitle: string;
  sourceType: EvidenceSourceType;
  sourceDate: string;
  urlOrReference: string;
  provenanceStatus: EvidenceProvenanceStatus;
  quotedSnippet: string;
  extractedFact: string;
  direction: EvidenceDirection;
  reasoningImpact: string;
  reliabilityScore?: number;
  relevanceScore?: number;
  freshnessScore?: number;
}

export interface EvidenceCardsArtifact {
  type: "evidence-cards";
  evidenceCards: AgentEvidenceCard[];
}

export interface ScoredNode {
  id: string;
  label: string;
  claim: string;
  weight: number;
  stance: NodeStance;
  confidence: Confidence;
  weightedScore: number;
  reasoningNote: string;
  whatWouldChange: string;
  supportingEvidenceIds: string[];
  counterEvidenceIds: string[];
}

export interface ScoredNodesArtifact {
  type: "scored-nodes";
  nodes: ScoredNode[];
  finalScore: number;
  finalStance: FinalStance;
  confidence: Confidence;
}

export interface MemoSectionArtifact {
  id: string;
  title: string;
  body: string;
  linkedNodeIds: string[];
  linkedEvidenceIds: string[];
}

export interface MemoArtifact {
  type: "memo";
  executiveSummary: string;
  finalStance: FinalStance;
  confidence: Confidence;
  finalScore: number;
  keyDrivers: string[];
  biggestCounterargument: string;
  whatWouldChangeTheView: string[];
  humanReviewChecklist: string[];
  sections: MemoSectionArtifact[];
}

export type AgentArtifact =
  | TaskFrameArtifact
  | HypothesisTreeArtifact
  | EvidencePlanArtifact
  | EvidenceCardsArtifact
  | ScoredNodesArtifact
  | MemoArtifact;

export interface AgentRun {
  runId: string;
  mode: AgentMode;
  request: AgentRequest;
  phases: AgentPhase[];
  artifacts: AgentArtifact[];
  taskFrame?: TaskFrameArtifact;
  hypothesisTree?: HypothesisTreeArtifact;
  evidencePlan?: EvidencePlanArtifact;
  evidenceCards?: AgentEvidenceCard[];
  scoredNodes?: ScoredNodesArtifact;
  memo?: MemoArtifact;
}

export type AgentEvent =
  | { type: "run-started"; runId: string; mode: AgentMode }
  | { type: "phase-started"; phase: AgentPhaseName; detail: string }
  | { type: "artifact"; artifact: AgentArtifact }
  | { type: "phase-completed"; phase: AgentPhaseName; detail: string }
  | { type: "phase-failed"; phase: AgentPhaseName; error: string }
  | { type: "telemetry"; metric: AgentTelemetryMetric }
  | { type: "run-completed"; run: AgentRun }
  | { type: "run-failed"; error: string; fallbackAvailable: boolean };
