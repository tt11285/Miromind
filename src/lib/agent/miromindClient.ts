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

function formatFailure(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
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
          const repairedContent = await requestContent(repairPrompt);
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
