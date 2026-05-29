import type { ResearchReasoner } from "./orchestrator";

const MIROMIND_CHAT_COMPLETIONS_URL =
  "https://api.miromind.ai/v1/chat/completions";

type FetchImpl = typeof fetch;

interface CreateMiroMindReasonerOptions {
  apiKey: string;
  model: string;
  fetchImpl?: FetchImpl;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export function parseJsonFromAssistantText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fencedMatch ? fencedMatch[1] : trimmed);
}

export function createMiroMindReasoner(
  options: CreateMiroMindReasonerOptions
): ResearchReasoner {
  return async ({ task, rootQuestion, nodeLabels }) => {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(MIROMIND_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        stream: false,
        messages: [
          {
            role: "user",
            content: buildPrompt({ task, rootQuestion, nodeLabels })
          }
        ]
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `MiroMind request failed with status ${response.status}: ${responseText}`
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("MiroMind response did not include assistant content.");
    }

    const parsed = parseJsonFromAssistantText(content);
    if (!isSummaryResponse(parsed)) {
      throw new Error("MiroMind response JSON must include a string summary.");
    }

    return parsed;
  };
}

function buildPrompt(input: Parameters<ResearchReasoner>[0]): string {
  return [
    "Return JSON only in the shape {\"summary\":\"...\"}.",
    `Root question: ${input.rootQuestion}`,
    `Company id: ${input.task.companyId}`,
    `Question template id: ${input.task.questionTemplateId}`,
    `Node labels: ${input.nodeLabels.join(", ")}`
  ].join("\n");
}

function isSummaryResponse(value: unknown): value is { summary: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "summary" in value &&
    typeof value.summary === "string"
  );
}
