import { z } from "zod";

export const listedSecuritySchema = z.object({
  name: z.string().min(1),
  ticker: z.string().min(1),
  exchange: z.string().min(1),
  country: z.string().min(1),
  assetType: z.literal("Equity")
});

export const agentRequestSchema = z.object({
  security: listedSecuritySchema,
  question: z.string().min(8),
  timeHorizon: z.enum(["3M", "12M", "3Y"]),
  researchDepth: z.enum(["fast", "deep"]),
  evidencePreference: z.enum(["balanced", "financials", "earnings", "news"]),
  fallbackAllowed: z.boolean()
});

export const taskFrameOutputSchema = z.object({
  securityName: z.string().min(1),
  ticker: z.string().min(1),
  sectorFrame: z.string().min(1),
  rootQuestion: z.string().min(1),
  researchObjective: z.string().min(1),
  decisionCriteria: z.array(z.string().min(1)).min(1),
  evidenceCategories: z.array(z.string().min(1)).min(1),
  safetyNote: z.string().min(1)
});

export const hypothesisNodeDraftSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  claim: z.string().min(1),
  whyItMatters: z.string().min(1),
  weight: z.number().positive(),
  evidenceNeeded: z.array(z.string().min(1)).min(1),
  counterEvidenceNeeded: z.array(z.string().min(1)).min(1)
});

export const hypothesisOutputSchema = z.object({
  rootQuestion: z.string().min(1),
  nodes: z.array(hypothesisNodeDraftSchema).min(4).max(7)
});

export const evidencePlanOutputSchema = z.object({
  items: z.array(
    z.object({
      nodeId: z.string().min(1),
      researchQuestions: z.array(z.string().min(1)).min(1),
      preferredSourceTypes: z.array(
        z.enum(["filing", "earnings", "market-data", "news", "industry", "other"])
      ).min(1),
      sourceCandidates: z.array(z.string()),
      supportingSignals: z.array(z.string().min(1)).min(1),
      refutingSignals: z.array(z.string().min(1)).min(1)
    })
  ).min(1)
});

export const evidenceCardSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  sourceTitle: z.string().min(1),
  sourceType: z.enum(["filing", "earnings", "market-data", "news", "industry", "other"]),
  sourceDate: z.string().min(1),
  urlOrReference: z.string().min(1),
  provenanceStatus: z.enum(["verified", "model-reported", "unavailable"]),
  quotedSnippet: z.string().min(1),
  extractedFact: z.string().min(1),
  direction: z.enum(["supports", "refutes", "complicates"]),
  reasoningImpact: z.string().min(1)
});

export const evidenceResearchOutputSchema = z.object({
  evidenceCards: z.array(evidenceCardSchema).min(1)
});

export const synthesisOutputSchema = z.object({
  executiveSummary: z.string().min(1),
  finalStance: z.enum([
    "Supported",
    "Partially Supported",
    "Inconclusive",
    "Weakly Unsupported",
    "Not Supported"
  ]),
  confidence: z.enum(["High", "Medium-High", "Medium", "Low"]),
  keyDrivers: z.array(z.string().min(1)).min(1),
  biggestCounterargument: z.string().min(1),
  whatWouldChangeTheView: z.array(z.string().min(1)).min(1),
  humanReviewChecklist: z.array(z.string().min(1)).min(1),
  sections: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      body: z.string().min(1),
      linkedNodeIds: z.array(z.string().min(1)).min(1),
      linkedEvidenceIds: z.array(z.string().min(1))
    })
  ).min(1)
});

export type AgentRequestInput = z.infer<typeof agentRequestSchema>;
