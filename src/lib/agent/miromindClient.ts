import type { ZodSchema } from "zod";

type FetchImpl = typeof fetch;

interface CreateMiroMindStageClientOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetchImpl?: FetchImpl;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export function parseAssistantJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export function createMiroMindStageClient(
  options: CreateMiroMindStageClientOptions
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;

  async function requestContent(prompt: string): Promise<string> {
    const response = await fetchImpl(url, {
      method: "POST",
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
    return content;
  }

  return {
    async completeJson<T>(
      stageName: string,
      prompt: string,
      schema: ZodSchema<T>
    ): Promise<T> {
      const firstContent = await requestContent(prompt);
      try {
        return schema.parse(parseAssistantJson(firstContent));
      } catch {
        const repairPrompt = [
          "Repair the previous response so it is valid JSON only.",
          `Stage: ${stageName}`,
          "Do not add markdown.",
          "Original prompt:",
          prompt,
          "Invalid response:",
          firstContent
        ].join("\n");
        const repairedContent = await requestContent(repairPrompt);
        return schema.parse(parseAssistantJson(repairedContent));
      }
    }
  };
}
