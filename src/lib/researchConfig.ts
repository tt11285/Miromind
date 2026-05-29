import type {
  Company,
  CompanyId,
  QuestionTemplate,
  QuestionTemplateId,
  ResearchTask
} from "./types";

export const companies: Company[] = [
  {
    id: "nvda",
    name: "NVIDIA",
    ticker: "NVDA",
    sectorFrame: "AI accelerators and data center platforms",
    researchLens: "AI data center demand, Blackwell ramp, CUDA moat, hyperscaler capex"
  },
  {
    id: "msft",
    name: "Microsoft",
    ticker: "MSFT",
    sectorFrame: "enterprise software and cloud AI infrastructure",
    researchLens: "Azure AI growth, Copilot monetization, OpenAI dependency, enterprise adoption"
  },
  {
    id: "mu",
    name: "Micron",
    ticker: "MU",
    sectorFrame: "memory semiconductors and AI infrastructure supply chain",
    researchLens: "HBM demand, DRAM/NAND pricing cycle, AI memory attach rate, supply discipline"
  },
  {
    id: "tsla",
    name: "Tesla",
    ticker: "TSLA",
    sectorFrame: "electric vehicles, autonomy, and energy systems",
    researchLens: "EV demand, gross margin, China competition, FSD and robotaxi optionality"
  }
];

export const questionTemplates: QuestionTemplate[] = [
  {
    id: "valuation-growth",
    title: "Is the current valuation justified by growth fundamentals?",
    rootQuestion: "Is the current valuation justified by growth fundamentals?",
    nodeLabels: [
      "Revenue Growth",
      "Margin Durability",
      "Demand Sustainability",
      "Competitive Moat",
      "Valuation Sensitivity"
    ]
  },
  {
    id: "downside-risk",
    title: "What is the most material downside risk over the next 12 months?",
    rootQuestion: "What is the most material downside risk over the next 12 months?",
    nodeLabels: [
      "Demand Risk",
      "Margin Risk",
      "Execution Risk",
      "Competitive Risk",
      "Macro or Regulatory Risk"
    ]
  },
  {
    id: "bull-bear",
    title: "Where do bull and bear theses diverge most?",
    rootQuestion: "Where do bull and bear theses diverge most?",
    nodeLabels: [
      "Growth Assumption Gap",
      "Margin Assumption Gap",
      "Market Size Gap",
      "Competition Gap",
      "Valuation Gap"
    ]
  },
  {
    id: "earnings-thesis",
    title: "Did the latest earnings change the investment thesis?",
    rootQuestion: "Did the latest earnings change the investment thesis?",
    nodeLabels: [
      "Revenue Surprise",
      "Guidance Change",
      "Margin Trend",
      "Segment Momentum",
      "Management Tone"
    ]
  }
];

export const defaultResearchTask: ResearchTask = {
  companyId: "nvda",
  questionTemplateId: "valuation-growth",
  timeHorizon: "12M",
  evidencePreference: "balanced"
};

export function getCompany(companyId: CompanyId): Company {
  const company = companies.find((item) => item.id === companyId);
  if (!company) {
    throw new Error(`Unsupported company id: ${companyId}`);
  }
  return company;
}

export function getQuestionTemplate(templateId: QuestionTemplateId): QuestionTemplate {
  const template = questionTemplates.find((item) => item.id === templateId);
  if (!template) {
    throw new Error(`Unsupported question template id: ${templateId}`);
  }
  return template;
}
