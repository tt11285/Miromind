import {
  createLocalEvidencePlan,
  createLocalHypothesisTree,
  createLocalTaskFrame
} from "@/lib/agent/localResearch";
import { agentRequestSchema } from "@/lib/agent/schemas";
import type { AgentRequest } from "@/lib/agent/types";

export async function POST(request: Request): Promise<Response> {
  const parsed = agentRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const agentRequest = parsed.data as AgentRequest;
  const taskFrame = createLocalTaskFrame(agentRequest);
  const hypothesisTree = createLocalHypothesisTree(taskFrame, agentRequest);
  const evidencePlan = createLocalEvidencePlan(hypothesisTree, agentRequest);

  return Response.json({
    taskFrame,
    hypothesisTree,
    evidencePlan
  });
}
