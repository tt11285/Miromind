import type { ZodSchema } from "zod";
import type { MiroMindRequestMetric } from "./types";

type FetchImpl = typeof fetch;

interface CreateMiroMindStageClientOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetchImpl?: FetchImpl;
  now?: () => number;
  onMetric?: (metric: MiroMindRequestMetric) => void;
  requestTimeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

function formatFailure(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Returns the first balanced {...} or [...] block starting at or after `from`,
 * correctly skipping braces/brackets that appear inside JSON string literals.
 */
function balancedJsonSlice(text: string): string | null {
  for (let i = 0; i < text.length; i += 1) {
    const open = text[i];
    if (open !== "{" && open !== "[") {
      continue;
    }
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < text.length; j += 1) {
      const ch = text[j];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === open) {
        depth += 1;
      } else if (ch === close) {
        depth -= 1;
        if (depth === 0) {
          return text.slice(i, j + 1);
        }
      }
    }
  }
  return null;
}

/**
 * Parses the assistant's JSON, tolerating the ways models wrap it:
 * a ```json fence, or prose around it (e.g. `The final answer: { ... }`).
 */
export function parseAssistantJson(text: string): unknown {
  const trimmed = text.trim();
  const candidates: string[] = [];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    candidates.push(fenced[1].trim());
  }
  candidates.push(trimmed);

  const sliced = balancedJsonSlice(fenced ? fenced[1] : trimmed);
  if (sliced) {
    candidates.push(sliced);
  }

  let lastError: unknown = new Error("Assistant response did not contain valid JSON.");
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function createMiroMindStageClient(
  options: CreateMiroMindStageClientOptions
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const requestTimeoutMs = options.requestTimeoutMs;
  const url = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;

  async function requestContent(
    stageName: string,
    attempt: MiroMindRequestMetric["attempt"],
    prompt: string
  ): Promise<string> {
    const startedAt = now();
    const controller =
      typeof requestTimeoutMs === "number" && requestTimeoutMs > 0
        ? new AbortController()
        : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), requestTimeoutMs)
      : null;
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        ...(controller ? { signal: controller.signal } : {}),
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: options.model,
          stream: false,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(
          `MiroMind request failed with status ${response.status}: ${await response.text()}`
        );
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("MiroMind response did not include assistant content.");
      }
      options.onMetric?.({
        kind: "miromind-request",
        stageName,
        attempt,
        durationMs: Math.max(0, now() - startedAt),
        status: "success"
      });
      return content;
    } catch (error) {
      const formattedError = controller?.signal.aborted
        ? `MiroMind ${stageName} ${attempt} request timed out after ${requestTimeoutMs}ms.`
        : formatFailure(error);
      options.onMetric?.({
        kind: "miromind-request",
        stageName,
        attempt,
        durationMs: Math.max(0, now() - startedAt),
        status: "failed",
        error: formattedError
      });
      throw new Error(formattedError);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  return {
    async completeJson<T>(
      stageName: string,
      prompt: string,
      schema: ZodSchema<T>
    ): Promise<T> {
      const firstContent = await requestContent(stageName, "primary", prompt);
      let firstFailure = "";
      try {
        return schema.parse(parseAssistantJson(firstContent));
      } catch (error) {
        firstFailure = formatFailure(error);
        const repairPrompt = [
          `Repair the previous response so it is valid JSON matching the ${stageName} schema/contract.`,
          `Stage: ${stageName}`,
          "Do not add markdown.",
          "Original prompt:",
          prompt,
          "Invalid response:",
          firstContent,
          "Failure detail:",
          firstFailure
        ].join("\n");
        try {
          const repairedContent = await requestContent(stageName, "repair", repairPrompt);
          return schema.parse(parseAssistantJson(repairedContent));
        } catch (repairError) {
          throw new Error(
            [
              `MiroMind ${stageName} response repair failed.`,
              `Original failure: ${firstFailure}`,
              `Repair failure: ${formatFailure(repairError)}`
            ].join("\n")
          );
        }
      }
    }
  };
}
