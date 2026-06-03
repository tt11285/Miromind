import {
  createLocalEvidencePlan,
  frameTaskWithFallback,
  generateHypothesisTreeWithFallback,
  type StageClient
} from "@/lib/agent/localResearch";
import { createMiroMindStageClient } from "@/lib/agent/miromindClient";
import { agentRequestSchema } from "@/lib/agent/schemas";
import { getMiroMindServerConfig } from "@/lib/agent/serverConfig";
import type { AgentRequest, AgentTelemetryMetric } from "@/lib/agent/types";

export async function POST(request: Request): Promise<Response> {
  const parsed = agentRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const agentRequest = parsed.data as AgentRequest;
  const config = getMiroMindServerConfig();
  const metrics: AgentTelemetryMetric[] = [];
  const stageClient: StageClient | null = config.apiKey
    ? createMiroMindStageClient({
        ...config,
        apiKey: config.apiKey,
        onMetric: (metric) => metrics.push(metric)
      })
    : null;

  const taskFrame = await frameTaskWithFallback({ stageClient, request: agentRequest });
  const hypothesisTree = await generateHypothesisTreeWithFallback({
    stageClient,
    frame: taskFrame,
    request: agentRequest
  });
  const evidencePlan = createLocalEvidencePlan(hypothesisTree, agentRequest);

  return Response.json({
    taskFrame,
    hypothesisTree,
    evidencePlan,
    telemetry: metrics
  });
}
