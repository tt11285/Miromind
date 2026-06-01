import { createMiroMindStageClient } from "@/lib/agent/miromindClient";
import { buildEvidenceResearchItemPrompt } from "@/lib/agent/prompts";
import {
  agentRequestSchema,
  evidencePlanItemSchema,
  evidenceResearchOutputSchema
} from "@/lib/agent/schemas";
import { getMiroMindServerConfig } from "@/lib/agent/serverConfig";
import type { AgentTelemetryMetric } from "@/lib/agent/types";
import { z } from "zod";

const evidenceRequestSchema = z.object({
  request: agentRequestSchema,
  item: evidencePlanItemSchema
}).strict();

export async function POST(request: Request): Promise<Response> {
  const parsed = evidenceRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const config = getMiroMindServerConfig();
  if (!config.apiKey) {
    return Response.json(
      { error: "A MiroMind API key is required for Evidence Research." },
      { status: 500 }
    );
  }

  const metrics: AgentTelemetryMetric[] = [];
  const stageClient = createMiroMindStageClient({
    ...config,
    apiKey: config.apiKey,
    onMetric: (metric) => metrics.push(metric)
  });

  try {
    const artifact = await stageClient.completeJson(
      "Evidence Research",
      buildEvidenceResearchItemPrompt(parsed.data.item),
      evidenceResearchOutputSchema
    );

    return Response.json({
      evidenceCards: artifact.evidenceCards,
      telemetry: metrics
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Evidence research failed.",
        telemetry: metrics
      },
      { status: 502 }
    );
  }
}
