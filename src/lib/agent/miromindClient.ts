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

type MessageLike = { content?: unknown; agent_summary?: unknown };
type ChunkPayload = {
  choices?: Array<{ delta?: MessageLike; message?: MessageLike }>;
};

function nodeText(node: MessageLike | undefined): { content: string; summary: string } {
  return {
    content: typeof node?.content === "string" ? node.content : "",
    summary: typeof node?.agent_summary === "string" ? node.agent_summary : ""
  };
}

/**
 * Pulls the assistant's text out of a MiroMind response, which (depending on the
 * model and prompt) arrives in three different shapes:
 *  - a single JSON chat-completion object,
 *  - an SSE stream of `data: {...}` chunks (returned for reasoning prompts even
 *    when stream:false is requested), or
 *  - content tucked into `agent_summary` instead of `content`.
 * The returned string is then mined for JSON by parseAssistantJson.
 */
export function extractAssistantContent(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }

  if (/^data:/m.test(trimmed)) {
    let content = "";
    let summary = "";
    for (const rawLine of trimmed.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) {
        continue;
      }
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        continue;
      }
      let chunk: ChunkPayload;
      try {
        chunk = JSON.parse(payload) as ChunkPayload;
      } catch {
        continue;
      }
      const choice = chunk.choices?.[0];
      const picked = nodeText(choice?.delta ?? choice?.message);
      content += picked.content;
      summary += picked.summary;
    }
    return content || summary;
  }

  try {
    const obj = JSON.parse(trimmed) as ChunkPayload;
    // A chat-completion envelope: return its content (or "" when truly empty,
    // so the caller can report a missing-content error).
    if (Array.isArray(obj.choices)) {
      const picked = nodeText(obj.choices[0]?.message);
      return picked.content || picked.summary;
    }
  } catch {
    // Not a single JSON object — fall through to the raw text below.
  }

  return trimmed;
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

      const content = extractAssistantContent(await response.text());
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
