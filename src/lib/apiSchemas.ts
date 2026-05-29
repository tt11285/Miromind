import { z } from "zod";
import type { ResearchTask } from "./types";

export const researchTaskSchema = z.object({
  companyId: z.enum(["nvda", "msft", "mu", "tsla"]),
  questionTemplateId: z.enum([
    "valuation-growth",
    "downside-risk",
    "bull-bear",
    "earnings-thesis"
  ]),
  timeHorizon: z.enum(["3M", "12M", "3Y"]),
  evidencePreference: z.enum(["balanced", "financials", "earnings", "news"]),
  useMiroMind: z.boolean().optional().default(false)
});

export type ResearchTaskRequest = z.infer<typeof researchTaskSchema>;

export function parseResearchTask(input: unknown): {
  task: ResearchTask;
  useMiroMind: boolean;
} {
  const result = researchTaskSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Invalid research task: ${result.error.message}`);
  }

  const { useMiroMind, ...task } = result.data;
  return { task, useMiroMind };
}
