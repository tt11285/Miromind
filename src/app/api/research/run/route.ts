import { createFallbackRun, isCuratedFallbackEligible } from "@/lib/agent/fallback";
import { createMiroMindStageClient } from "@/lib/agent/miromindClient";
import { runAgent } from "@/lib/agent/runAgent";
import { agentRequestSchema } from "@/lib/agent/schemas";
import type { AgentEvent, AgentRequest } from "@/lib/agent/types";

function encodeEvent(event: AgentEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function enqueueFallbackRun(
  controller: ReadableStreamDefaultController<Uint8Array>,
  runId: string,
  agentRequest: AgentRequest
) {
  const fallbackRun = createFallbackRun(runId, agentRequest);
  controller.enqueue(
    encodeEvent({ type: "run-started", runId, mode: "demo-fallback" })
  );
  for (const artifact of fallbackRun.artifacts) {
    controller.enqueue(encodeEvent({ type: "artifact", artifact }));
  }
  controller.enqueue(encodeEvent({ type: "run-completed", run: fallbackRun }));
}

export async function POST(request: Request): Promise<Response> {
  const parsed = agentRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const agentRequest = parsed.data as AgentRequest;
  const apiKey = process.env.MIROMIND_API_KEY;
  const model = process.env.MIROMIND_MODEL ?? "mirothinker-1-7-deepresearch";
  const baseUrl = process.env.MIROMIND_BASE_URL ?? "https://api.miromind.ai/v1";
  const requestTimeoutMs = Number(process.env.MIROMIND_REQUEST_TIMEOUT_MS ?? 30000);
  const runId = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!apiKey) {
          if (
            !agentRequest.fallbackAllowed ||
            !isCuratedFallbackEligible(agentRequest)
          ) {
            controller.enqueue(
              encodeEvent({
                type: "run-failed",
                error:
                  "A MiroMind API key is required for this non-curated research task.",
                fallbackAvailable: isCuratedFallbackEligible(agentRequest)
              })
            );
            controller.close();
            return;
          }

          enqueueFallbackRun(controller, runId, agentRequest);
          controller.close();
          return;
        }

        const stageClient = createMiroMindStageClient({
          apiKey,
          model,
          baseUrl,
          requestTimeoutMs,
          onMetric: (metric) => {
            controller.enqueue(encodeEvent({ type: "telemetry", metric }));
          }
        });
        for await (const event of runAgent(agentRequest, { stageClient, runId })) {
          controller.enqueue(encodeEvent(event));
        }
        controller.close();
      } catch (error) {
        if (agentRequest.fallbackAllowed && isCuratedFallbackEligible(agentRequest)) {
          enqueueFallbackRun(controller, runId, agentRequest);
          controller.close();
          return;
        }

        controller.enqueue(
          encodeEvent({
            type: "run-failed",
            error: error instanceof Error ? error.message : "Research run failed.",
            fallbackAvailable: isCuratedFallbackEligible(agentRequest)
          })
        );
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}
