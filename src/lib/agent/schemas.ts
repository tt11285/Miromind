import { z } from "zod";
import type { ListedSecurity } from "./types";

export const agentModeSchema = z.enum(["live-agent", "demo-fallback"]);
export const phaseStatusSchema = z.enum(["queued", "running", "complete", "failed"]);
export const evidenceSourceTypeSchema = z.enum([
  "filing",
  "earnings",
  "market-data",
  "news",
  "industry",
  "other"
]);
export const evidenceProvenanceStatusSchema = z.enum([
  "verified",
  "model-reported",
  "unavailable"
]);
export const evidenceDirectionSchema = z.enum(["supports", "refutes", "complicates"]);
export const nodeStanceSchema = z.enum([
  "supports",
  "weakly-supports",
  "mixed",
  "weakly-refutes",
  "refutes"
]);
export const finalStanceSchema = z.enum([
  "Supported",
  "Partially Supported",
  "Inconclusive",
  "Weakly Unsupported",
  "Not Supported"
]);
export const confidenceSchema = z.enum(["High", "Medium-High", "Medium", "Low"]);
export const agentPhaseNameSchema = z.enum([
  "Task Framing",
  "Hypothesis Generation",
  "Evidence Planning",
  "Evidence Research",
  "Evidence Scoring",
  "Reasoning Synthesis",
  "Memo Rendering"
]);

export const listedSecuritySchema = z.object({
  name: z.string().min(1),
  ticker: z.string().min(1),
  exchange: z.string().min(1),
  country: z.string().min(1),
  assetType: z.literal("Equity")
}).strict();

export const agentRequestSchema = z.object({
  security: listedSecuritySchema,
  question: z.string().min(8),
  timeHorizon: z.enum(["3M", "12M", "3Y"]),
  researchDepth: z.enum(["fast", "deep"]),
  evidencePreference: z.enum(["balanced", "financials", "earnings", "news"]),
  fallbackAllowed: z.boolean()
}).strict();

export const agentPhaseSchema = z.object({
  name: agentPhaseNameSchema,
  status: phaseStatusSchema,
  detail: z.string()
}).strict();

export const taskFrameOutputSchema = z.object({
  securityName: z.string().min(1),
  ticker: z.string().min(1),
  sectorFrame: z.string().min(1),
  rootQuestion: z.string().min(1),
  researchObjective: z.string().min(1),
  decisionCriteria: z.array(z.string().min(1)).min(1),
  evidenceCategories: z.array(z.string().min(1)).min(1),
  safetyNote: z.string().min(1)
}).strict();

export function createTaskFrameOutputSchemaForSecurity(security: ListedSecurity) {
  return taskFrameOutputSchema.superRefine((value, context) => {
    if (value.securityName !== security.name) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["securityName"],
        message: `securityName must exactly match selected security.name: ${security.name}`
      });
    }

    if (value.ticker !== security.ticker) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ticker"],
        message: `ticker must exactly match selected security.ticker: ${security.ticker}`
      });
    }
  });
}

export const taskFrameArtifactSchema = taskFrameOutputSchema.extend({
  type: z.literal("task-frame")
}).strict();

export const hypothesisNodeDraftSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  claim: z.string().min(1),
  whyItMatters: z.string().min(1),
  weight: z.number().positive(),
  evidenceNeeded: z.array(z.string().min(1)).min(1),
  counterEvidenceNeeded: z.array(z.string().min(1)).min(1)
}).strict();

export const hypothesisOutputSchema = z.object({
  rootQuestion: z.string().min(1),
  nodes: z.array(hypothesisNodeDraftSchema).min(4).max(7)
}).strict();

export const hypothesisTreeArtifactSchema = hypothesisOutputSchema.extend({
  type: z.literal("hypothesis-tree")
}).strict();

export const evidencePlanOutputSchema = z.object({
  items: z.array(
    z.object({
      nodeId: z.string().min(1),
      researchQuestions: z.array(z.string().min(1)).min(1),
      preferredSourceTypes: z.array(evidenceSourceTypeSchema).min(1),
      sourceCandidates: z.array(z.string()),
      supportingSignals: z.array(z.string().min(1)).min(1),
      refutingSignals: z.array(z.string().min(1)).min(1)
    }).strict()
  ).min(1)
}).strict();

export const evidencePlanArtifactSchema = evidencePlanOutputSchema.extend({
  type: z.literal("evidence-plan")
}).strict();

export const evidenceCardSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  sourceTitle: z.string().min(1),
  sourceType: evidenceSourceTypeSchema,
  sourceDate: z.string().min(1),
  urlOrReference: z.string().min(1),
  provenanceStatus: evidenceProvenanceStatusSchema,
  quotedSnippet: z.string().min(1),
  extractedFact: z.string().min(1),
  direction: evidenceDirectionSchema,
  reasoningImpact: z.string().min(1),
  reliabilityScore: z.number().optional(),
  relevanceScore: z.number().optional(),
  freshnessScore: z.number().optional()
}).strict();

export const evidenceResearchOutputSchema = z.object({
  evidenceCards: z.array(evidenceCardSchema).min(1)
}).strict();

export const evidenceCardsArtifactSchema = evidenceResearchOutputSchema.extend({
  type: z.literal("evidence-cards")
}).strict();

export const scoredNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  claim: z.string().min(1),
  weight: z.number(),
  stance: nodeStanceSchema,
  confidence: confidenceSchema,
  weightedScore: z.number(),
  reasoningNote: z.string().min(1),
  whatWouldChange: z.string().min(1),
  supportingEvidenceIds: z.array(z.string().min(1)),
  counterEvidenceIds: z.array(z.string().min(1))
}).strict();

export const scoredNodesArtifactSchema = z.object({
  type: z.literal("scored-nodes"),
  nodes: z.array(scoredNodeSchema).min(1),
  finalScore: z.number(),
  finalStance: finalStanceSchema,
  confidence: confidenceSchema
}).strict();

export const memoSectionArtifactSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  linkedNodeIds: z.array(z.string().min(1)),
  linkedEvidenceIds: z.array(z.string().min(1))
}).strict();

export const memoArtifactSchema = z.object({
  type: z.literal("memo"),
  executiveSummary: z.string().min(1),
  finalStance: finalStanceSchema,
  confidence: confidenceSchema,
  finalScore: z.number(),
  keyDrivers: z.array(z.string().min(1)).min(1),
  biggestCounterargument: z.string().min(1),
  whatWouldChangeTheView: z.array(z.string().min(1)).min(1),
  humanReviewChecklist: z.array(z.string().min(1)).min(1),
  sections: z.array(memoSectionArtifactSchema).min(1)
}).strict();

export const synthesisOutputSchema = z.object({
  executiveSummary: z.string().min(1),
  finalStance: finalStanceSchema,
  confidence: confidenceSchema,
  keyDrivers: z.array(z.string().min(1)).min(1),
  biggestCounterargument: z.string().min(1),
  whatWouldChangeTheView: z.array(z.string().min(1)).min(1),
  humanReviewChecklist: z.array(z.string().min(1)).min(1),
  sections: z.array(
    memoSectionArtifactSchema.extend({
      linkedNodeIds: z.array(z.string().min(1)).min(1)
    }).strict()
  ).min(1)
}).strict();

export const agentArtifactSchema = z.discriminatedUnion("type", [
  taskFrameArtifactSchema,
  hypothesisTreeArtifactSchema,
  evidencePlanArtifactSchema,
  evidenceCardsArtifactSchema,
  scoredNodesArtifactSchema,
  memoArtifactSchema
]);

function addTaskFrameSecurityIssues(
  context: z.RefinementCtx,
  path: (string | number)[],
  taskFrame: z.infer<typeof taskFrameArtifactSchema>,
  security: ListedSecurity
) {
  if (taskFrame.securityName !== security.name) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, "securityName"],
      message: `task frame securityName must exactly match request.security.name: ${security.name}`
    });
  }

  if (taskFrame.ticker !== security.ticker) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, "ticker"],
      message: `task frame ticker must exactly match request.security.ticker: ${security.ticker}`
    });
  }
}

export const agentRunSchema = z.object({
  runId: z.string().min(1),
  mode: agentModeSchema,
  request: agentRequestSchema,
  phases: z.array(agentPhaseSchema),
  artifacts: z.array(agentArtifactSchema),
  taskFrame: taskFrameArtifactSchema.optional(),
  hypothesisTree: hypothesisTreeArtifactSchema.optional(),
  evidencePlan: evidencePlanArtifactSchema.optional(),
  evidenceCards: z.array(evidenceCardSchema).optional(),
  scoredNodes: scoredNodesArtifactSchema.optional(),
  memo: memoArtifactSchema.optional()
}).strict().superRefine((run, context) => {
  if (run.taskFrame) {
    addTaskFrameSecurityIssues(
      context,
      ["taskFrame"],
      run.taskFrame,
      run.request.security
    );
  }

  run.artifacts.forEach((artifact, index) => {
    if (artifact.type === "task-frame") {
      addTaskFrameSecurityIssues(
        context,
        ["artifacts", index],
        artifact,
        run.request.security
      );
    }
  });
});

export const agentEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run-started"),
    runId: z.string().min(1),
    mode: agentModeSchema
  }).strict(),
  z.object({
    type: z.literal("phase-started"),
    phase: agentPhaseNameSchema,
    detail: z.string()
  }).strict(),
  z.object({
    type: z.literal("artifact"),
    artifact: agentArtifactSchema
  }).strict(),
  z.object({
    type: z.literal("phase-completed"),
    phase: agentPhaseNameSchema,
    detail: z.string()
  }).strict(),
  z.object({
    type: z.literal("phase-failed"),
    phase: agentPhaseNameSchema,
    error: z.string().min(1)
  }).strict(),
  z.object({
    type: z.literal("run-completed"),
    run: agentRunSchema
  }).strict(),
  z.object({
    type: z.literal("run-failed"),
    error: z.string().min(1),
    fallbackAvailable: z.boolean()
  }).strict()
]);

export type AgentRequestInput = z.infer<typeof agentRequestSchema>;
