import { getCompany, getQuestionTemplate } from "@/lib/researchConfig";
import type {
  EvidenceCard,
  HypothesisNode,
  NodeStance,
  ResearchTask
} from "@/lib/types";

interface FixtureArtifacts {
  rootQuestion: string;
  nodes: HypothesisNode[];
  evidence: EvidenceCard[];
}

const nodeDefaults: Array<{
  stance: NodeStance;
  confidence: HypothesisNode["confidence"];
  weight: number;
  weightedScore: number;
}> = [
  { stance: "supports", confidence: "High", weight: 0.25, weightedScore: 0.22 },
  { stance: "supports", confidence: "Medium-High", weight: 0.2, weightedScore: 0.16 },
  { stance: "mixed", confidence: "Medium", weight: 0.2, weightedScore: 0.08 },
  { stance: "supports", confidence: "Medium-High", weight: 0.2, weightedScore: 0.15 },
  { stance: "weakly-refutes", confidence: "Medium", weight: 0.15, weightedScore: -0.04 }
];

const valuationNodeClaims = [
  "Revenue growth remains strong enough to support a premium valuation.",
  "Gross margin and operating leverage can remain durable through the AI accelerator cycle.",
  "End-market demand has enough breadth and visibility to sustain growth.",
  "Platform breadth, software lock-in, and ecosystem scale reinforce competitive position.",
  "The valuation is sensitive to growth deceleration, margin normalization, and capex cycles."
];

const genericNodeClaims = [
  "The most important growth input can be evaluated from recent operating momentum.",
  "Profitability and cash generation shape how durable the thesis is.",
  "Demand signals determine whether the thesis has near-term support.",
  "Competitive position affects how much of the opportunity can be captured.",
  "Valuation or risk sensitivity determines how much evidence is already priced in."
];

function createNodes(task: ResearchTask): HypothesisNode[] {
  const template = getQuestionTemplate(task.questionTemplateId);
  const isValuationGrowth = task.questionTemplateId === "valuation-growth";

  return template.nodeLabels.map((label, index) => {
    const defaults = nodeDefaults[index];
    return {
      id: `node-${index + 1}`,
      label,
      claim: isValuationGrowth ? valuationNodeClaims[index] : genericNodeClaims[index],
      weight: defaults.weight,
      stance: defaults.stance,
      confidence: defaults.confidence,
      weightedScore: defaults.weightedScore,
      reasoningNote: `${label} is a core driver for the ${template.title.toLowerCase()} question.`,
      whatWouldChange:
        "A sustained reversal in reported fundamentals or credible management guidance would change this node."
    };
  });
}

const nvidiaValuationEvidence: EvidenceCard[] = [
  {
    id: "nvda-val-001",
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId: "node-1",
    sourceTitle: "NVIDIA FY2025 Form 10-K",
    sourceType: "filing",
    sourceDate: "2025-02-26",
    quotedSnippet: "Data Center revenue increased sharply as demand for accelerated computing expanded.",
    extractedFact: "Data Center growth was the primary contributor to NVIDIA's full-year revenue expansion.",
    direction: "supports",
    reliabilityScore: 0.96,
    relevanceScore: 0.95,
    freshnessScore: 0.86,
    reasoningImpact: "Confirms that the largest segment is still compounding at a pace relevant to valuation support.",
    urlOrReference: "NVIDIA FY2025 Form 10-K"
  },
  {
    id: "nvda-val-002",
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId: "node-1",
    sourceTitle: "NVIDIA Q4 FY2025 Earnings Release",
    sourceType: "earnings-call",
    sourceDate: "2025-02-26",
    quotedSnippet: "Quarterly revenue reached a record level, led by data center demand.",
    extractedFact: "Recent quarterly revenue remained at record levels rather than showing abrupt demand exhaustion.",
    direction: "supports",
    reliabilityScore: 0.93,
    relevanceScore: 0.91,
    freshnessScore: 0.88,
    reasoningImpact: "Adds near-term confirmation that annual growth was not only a backward-looking artifact.",
    urlOrReference: "NVIDIA Q4 FY2025 earnings materials"
  },
  {
    id: "nvda-val-003",
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId: "node-2",
    sourceTitle: "NVIDIA FY2025 Form 10-K",
    sourceType: "filing",
    sourceDate: "2025-02-26",
    quotedSnippet: "Gross margin expanded as higher-value data center products became a larger mix of revenue.",
    extractedFact: "Product mix helped margins expand during the AI accelerator ramp.",
    direction: "supports",
    reliabilityScore: 0.96,
    relevanceScore: 0.9,
    freshnessScore: 0.86,
    reasoningImpact: "Supports the view that growth has translated into profitability, not just volume.",
    urlOrReference: "NVIDIA FY2025 Form 10-K"
  },
  {
    id: "nvda-val-004",
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId: "node-2",
    sourceTitle: "NVIDIA Q4 FY2025 Earnings Call",
    sourceType: "earnings-call",
    sourceDate: "2025-02-26",
    quotedSnippet: "Management described Blackwell demand as strong while noting transition costs.",
    extractedFact: "The product transition can temporarily pressure margins even when demand is robust.",
    direction: "complicates",
    reliabilityScore: 0.9,
    relevanceScore: 0.86,
    freshnessScore: 0.88,
    reasoningImpact: "Keeps margin durability positive but flags execution and mix risk during the platform transition.",
    urlOrReference: "NVIDIA Q4 FY2025 earnings call transcript"
  },
  {
    id: "nvda-val-005",
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId: "node-3",
    sourceTitle: "Hyperscaler Capital Expenditure Commentary",
    sourceType: "industry",
    sourceDate: "2025-04-30",
    quotedSnippet: "Major cloud providers continued to prioritize AI infrastructure investment.",
    extractedFact: "Large cloud customers signaled ongoing AI infrastructure spending plans.",
    direction: "supports",
    reliabilityScore: 0.82,
    relevanceScore: 0.88,
    freshnessScore: 0.93,
    reasoningImpact: "Links NVIDIA demand to customer capex budgets rather than isolated backlog commentary.",
    urlOrReference: "Public cloud provider earnings commentary"
  },
  {
    id: "nvda-val-006",
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId: "node-3",
    sourceTitle: "AI Accelerator Supply Chain Checks",
    sourceType: "industry",
    sourceDate: "2025-03-15",
    quotedSnippet: "Lead times and advanced packaging capacity remained important constraints.",
    extractedFact: "Supply chain constraints can shape revenue timing even when demand is strong.",
    direction: "complicates",
    reliabilityScore: 0.76,
    relevanceScore: 0.8,
    freshnessScore: 0.89,
    reasoningImpact: "Highlights that demand sustainability must be separated from near-term shipment timing.",
    urlOrReference: "Industry supply chain commentary"
  },
  {
    id: "nvda-val-007",
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId: "node-4",
    sourceTitle: "NVIDIA Developer Ecosystem Update",
    sourceType: "industry",
    sourceDate: "2025-03-18",
    quotedSnippet: "CUDA, networking, systems, and software broaden the platform beyond standalone chips.",
    extractedFact: "NVIDIA's moat includes software and systems integration in addition to GPU silicon.",
    direction: "supports",
    reliabilityScore: 0.84,
    relevanceScore: 0.9,
    freshnessScore: 0.88,
    reasoningImpact: "Supports a premium multiple by framing NVIDIA as a platform provider.",
    urlOrReference: "NVIDIA GTC platform materials"
  },
  {
    id: "nvda-val-008",
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId: "node-4",
    sourceTitle: "Custom Silicon Competition Update",
    sourceType: "news",
    sourceDate: "2025-04-20",
    quotedSnippet: "Cloud customers continued investing in internal AI chips for selected workloads.",
    extractedFact: "Hyperscaler custom silicon remains a credible long-term substitution risk.",
    direction: "refutes",
    reliabilityScore: 0.78,
    relevanceScore: 0.84,
    freshnessScore: 0.92,
    reasoningImpact: "Introduces a real counterweight to the moat thesis and prevents one-sided scoring.",
    urlOrReference: "Public reporting on hyperscaler custom AI silicon"
  },
  {
    id: "nvda-val-009",
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId: "node-5",
    sourceTitle: "NVDA Market Multiple Snapshot",
    sourceType: "market-data",
    sourceDate: "2025-05-01",
    quotedSnippet: "Forward valuation remained well above the broader semiconductor peer group.",
    extractedFact: "The stock already discounts sustained above-peer growth and margin performance.",
    direction: "refutes",
    reliabilityScore: 0.82,
    relevanceScore: 0.93,
    freshnessScore: 0.94,
    reasoningImpact: "Shows that strong fundamentals may still be insufficient if expectations are too high.",
    urlOrReference: "Market data composite"
  },
  {
    id: "nvda-val-010",
    companyId: "nvda",
    questionTemplateId: "valuation-growth",
    claimNodeId: "node-5",
    sourceTitle: "Semiconductor Cycle Risk Review",
    sourceType: "industry",
    sourceDate: "2025-04-10",
    quotedSnippet: "AI infrastructure demand can be cyclical if customer digestion periods emerge.",
    extractedFact: "A digestion phase after rapid infrastructure buildout would create multiple compression risk.",
    direction: "complicates",
    reliabilityScore: 0.74,
    relevanceScore: 0.87,
    freshnessScore: 0.91,
    reasoningImpact: "Frames valuation risk as path-dependent on customer deployment and utilization.",
    urlOrReference: "Semiconductor industry cycle commentary"
  }
];

function createGenericEvidence(task: ResearchTask): EvidenceCard[] {
  const company = getCompany(task.companyId);
  const template = getQuestionTemplate(task.questionTemplateId);
  const idPrefix = `${task.companyId}-${task.questionTemplateId}`;

  return [
    {
      id: `${idPrefix}-001`,
      companyId: task.companyId,
      questionTemplateId: task.questionTemplateId,
      claimNodeId: "node-1",
      sourceTitle: `${company.name} Recent Operating Update`,
      sourceType: "filing",
      sourceDate: "2025-03-31",
      quotedSnippet: `${company.name} reported operating trends relevant to ${company.sectorFrame}.`,
      extractedFact: `${company.name} has recent company-reported data that can anchor the ${template.title.toLowerCase()} analysis.`,
      direction: "supports",
      reliabilityScore: 0.88,
      relevanceScore: 0.82,
      freshnessScore: 0.86,
      reasoningImpact: "Provides a baseline company-reported fact pattern for the fixture run.",
      urlOrReference: `${company.ticker} company filing fixture`
    },
    {
      id: `${idPrefix}-002`,
      companyId: task.companyId,
      questionTemplateId: task.questionTemplateId,
      claimNodeId: "node-3",
      sourceTitle: `${company.name} Sector Demand Check`,
      sourceType: "industry",
      sourceDate: "2025-04-15",
      quotedSnippet: `Industry commentary highlighted demand variables across ${company.researchLens}.`,
      extractedFact: `The demand picture for ${company.name} depends on the key lens: ${company.researchLens}.`,
      direction: "complicates",
      reliabilityScore: 0.76,
      relevanceScore: 0.78,
      freshnessScore: 0.9,
      reasoningImpact: "Adds uncertainty so later reasoning can distinguish evidence quality from direction.",
      urlOrReference: `${company.ticker} industry fixture`
    },
    {
      id: `${idPrefix}-003`,
      companyId: task.companyId,
      questionTemplateId: task.questionTemplateId,
      claimNodeId: "node-5",
      sourceTitle: `${company.name} Valuation and Risk Snapshot`,
      sourceType: "market-data",
      sourceDate: "2025-05-01",
      quotedSnippet: `Market pricing reflected both upside optionality and execution risk for ${company.ticker}.`,
      extractedFact: `${company.ticker} valuation sensitivity remains tied to execution against investor expectations.`,
      direction: "refutes",
      reliabilityScore: 0.8,
      relevanceScore: 0.8,
      freshnessScore: 0.93,
      reasoningImpact: "Ensures every generic fixture includes a counterpoint for synthesis and scoring.",
      urlOrReference: `${company.ticker} market data fixture`
    }
  ];
}

export function createFixtureArtifacts(task: ResearchTask): FixtureArtifacts {
  const template = getQuestionTemplate(task.questionTemplateId);
  const isNvidiaGoldenPath =
    task.companyId === "nvda" && task.questionTemplateId === "valuation-growth";

  return {
    rootQuestion: template.rootQuestion,
    nodes: createNodes(task),
    evidence: isNvidiaGoldenPath ? nvidiaValuationEvidence : createGenericEvidence(task)
  };
}
