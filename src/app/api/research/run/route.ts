import { verifyEvidenceCards } from "@/lib/agent/evidenceVerification";
import { createFallbackRun, isCuratedFallbackEligible } from "@/lib/agent/fallback";
import { createMiroMindStageClient } from "@/lib/agent/miromindClient";
import { runAgent } from "@/lib/agent/runAgent";
import { agentRequestSchema } from "@/lib/agent/schemas";
import type { AgentEvent, AgentRequest } from "@/lib/agent/types";

// Stream per request; never statically optimize or buffer this route.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

// Default per-call timeout so a stuck MiroMind request can never hang the whole
// run forever (which manifested as an 11-minute "network error" on Railway).
// The deepresearch model is slow (~60s for hypothesis generation), so this must
// be generous enough not to kill legitimately slow-but-working calls.
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
// Emit a no-op newline this often so edge proxies don't drop an "idle" stream
// during long (~60s) model stages. parseJsonLines ignores blank lines.
const HEARTBEAT_MS = 10_000;

function encodeEvent(event: AgentEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
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
  const requestTimeoutMs = process.env.MIROMIND_REQUEST_TIMEOUT_MS
    ? Number(process.env.MIROMIND_REQUEST_TIMEOUT_MS)
    : DEFAULT_REQUEST_TIMEOUT_MS;
  const runId = crypto.randomUUID();
  const log = (message: string) => console.log(`[run ${runId}] ${message}`);

  log(
    `start ticker=${agentRequest.security.ticker} live=${Boolean(apiKey)} ` +
      `model=${model} baseUrl=${baseUrl} timeout=${requestTimeoutMs}ms`
  );

  let clientGone = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const stopHeartbeat = () => {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = undefined;
        }
      };

      try {
        if (!apiKey) {
          if (
            !agentRequest.fallbackAllowed ||
            !isCuratedFallbackEligible(agentRequest)
          ) {
            log("no MiroMind key and task is not curated -> run-failed");
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

          log("no MiroMind key -> curated demo fallback");
          enqueueFallbackRun(controller, runId, agentRequest);
          controller.close();
          return;
        }

        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode("\n"));
          } catch {
            stopHeartbeat();
          }
        }, HEARTBEAT_MS);

        const stageClient = createMiroMindStageClient({
          apiKey,
          model,
          baseUrl,
          requestTimeoutMs,
          onMetric: (metric) => {
            if (metric.kind === "miromind-request") {
              const line =
                `miromind ${metric.stageName} ${metric.attempt} ` +
                `${metric.status} ${metric.durationMs}ms`;
              if (metric.status === "failed") {
                console.error(`[run ${runId}] ${line} :: ${metric.error ?? ""}`);
              } else {
                log(line);
              }
            }
            try {
              controller.enqueue(encodeEvent({ type: "telemetry", metric }));
            } catch {
              // controller already closed/cancelled
            }
          }
        });
        const verifyTimeoutMs = process.env.SOURCE_VERIFY_TIMEOUT_MS
          ? Number(process.env.SOURCE_VERIFY_TIMEOUT_MS)
          : 5000;
        for await (const event of runAgent(agentRequest, {
          stageClient,
          runId,
          verifyEvidence: (cards) =>
            verifyEvidenceCards(cards, { timeoutMs: verifyTimeoutMs })
        })) {
          if (clientGone) {
            return;
          }
          controller.enqueue(encodeEvent(event));
          if (event.type === "run-completed") {
            log("run completed");
          }
        }
        controller.close();
      } catch (error) {
        if (clientGone) {
          return;
        }
        console.error(`[run ${runId}] FAILED:`, error);
        if (agentRequest.fallbackAllowed && isCuratedFallbackEligible(agentRequest)) {
          log("error during live run -> curated demo fallback");
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
      } finally {
        stopHeartbeat();
      }
    },
    cancel() {
      clientGone = true;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
}
