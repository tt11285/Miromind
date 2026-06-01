import { synthesizeMemoWithFallback } from "@/lib/agent/localResearch";
import { createMiroMindStageClient } from "@/lib/agent/miromindClient";
import {
  agentRequestSchema,
  evidenceCardSchema,
  hypothesisTreeArtifactSchema,
  taskFrameArtifactSchema
} from "@/lib/agent/schemas";
import { scoreAgentEvidence } from "@/lib/agent/scoring";
import { getMiroMindServerConfig } from "@/lib/agent/serverConfig";
import type { AgentRequest, AgentTelemetryMetric } from "@/lib/agent/types";
import { z } from "zod";

const synthesisRequestSchema = z.object({
  request: agentRequestSchema,
  taskFrame: taskFrameArtifactSchema,
  hypothesisTree: hypothesisTreeArtifactSchema,
  evidenceCards: z.array(evidenceCardSchema).min(1)
}).strict();

export async function POST(request: Request): Promise<Response> {
  const parsed = synthesisRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const config = getMiroMindServerConfig();
  if (!config.apiKey) {
    return Response.json(
      { error: "A MiroMind API key is required for Reasoning Synthesis." },
      { status: 500 }
    );
  }

  const metrics: AgentTelemetryMetric[] = [];
  const stageClient = createMiroMindStageClient({
    ...config,
    apiKey: config.apiKey,
    onMetric: (metric) => metrics.push(metric)
  });
  const scoredNodes = scoreAgentEvidence(
    parsed.data.hypothesisTree,
    parsed.data.evidenceCards
  );
  const memo = await synthesizeMemoWithFallback({
    stageClient,
    taskFrame: parsed.data.taskFrame,
    hypothesisTree: parsed.data.hypothesisTree,
    evidence: parsed.data.evidenceCards,
    scoredNodes
  });

  return Response.json({
    request: parsed.data.request as AgentRequest,
    scoredNodes,
    memo,
    telemetry: metrics
  });
}
