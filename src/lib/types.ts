export type CompanyId = "nvda" | "msft" | "mu" | "tsla";

export type QuestionTemplateId =
  | "valuation-growth"
  | "downside-risk"
  | "bull-bear"
  | "earnings-thesis";

export type TimeHorizon = "3M" | "12M" | "3Y";
export type EvidencePreference =
  | "balanced"
  | "financials"
  | "earnings"
  | "news";

export type EvidenceDirection = "supports" | "refutes" | "complicates";

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

export interface Company {
  id: CompanyId;
  name: string;
  ticker: string;
  sectorFrame: string;
  researchLens: string;
}

export interface QuestionTemplate {
  id: QuestionTemplateId;
  title: string;
  rootQuestion: string;
  nodeLabels: string[];
}

export interface ResearchTask {
  companyId: CompanyId;
  questionTemplateId: QuestionTemplateId;
  timeHorizon: TimeHorizon;
  evidencePreference: EvidencePreference;
}

export interface EvidenceCard {
  id: string;
  companyId: CompanyId;
  questionTemplateId: QuestionTemplateId;
  claimNodeId: string;
  sourceTitle: string;
  sourceType: "filing" | "earnings-call" | "market-data" | "news" | "industry";
  sourceDate: string;
  quotedSnippet: string;
  extractedFact: string;
  direction: EvidenceDirection;
  reliabilityScore: number;
  relevanceScore: number;
  freshnessScore: number;
  reasoningImpact: string;
  urlOrReference: string;
}

export interface HypothesisNode {
  id: string;
  label: string;
  claim: string;
  weight: number;
  stance: NodeStance;
  confidence: Confidence;
  weightedScore: number;
  reasoningNote: string;
  whatWouldChange: string;
}

export interface NodeConclusion extends HypothesisNode {
  supportingEvidence: EvidenceCard[];
  counterEvidence: EvidenceCard[];
}

export interface MemoSection {
  id: string;
  title: string;
  body: string;
  linkedNodeIds: string[];
  linkedEvidenceIds: string[];
}

export interface InvestmentMemo {
  executiveSummary: string;
  finalStance: FinalStance;
  confidence: Confidence;
  finalScore: number;
  keyDrivers: string[];
  biggestCounterargument: string;
  whatWouldChangeTheView: string[];
  humanReviewChecklist: string[];
  sections: MemoSection[];
}

export type RunPhaseName =
  | "Task Framing"
  | "Hypothesis Generation"
  | "Evidence Collection"
  | "Evidence Scoring"
  | "Reasoning Synthesis"
  | "Memo Rendering";

export interface RunPhase {
  name: RunPhaseName;
  status: "complete" | "running" | "queued" | "failed";
  detail: string;
}

export interface ResearchRun {
  task: ResearchTask;
  rootQuestion: string;
  phases: RunPhase[];
  nodes: NodeConclusion[];
  evidence: EvidenceCard[];
  memo: InvestmentMemo;
  mode: "fixture" | "miromind-augmented";
}
