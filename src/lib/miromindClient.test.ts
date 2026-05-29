import { describe, expect, it, vi } from "vitest";
import { createMiroMindReasoner, parseJsonFromAssistantText } from "./miromindClient";
import { defaultResearchTask } from "./researchConfig";

describe("MiroMind client", () => {
  it("parses plain JSON and fenced JSON", () => {
    expect(parseJsonFromAssistantText('{"summary":"ok"}')).toEqual({ summary: "ok" });
    expect(parseJsonFromAssistantText('```json\n{"summary":"ok"}\n```')).toEqual({
      summary: "ok"
    });
  });

  it("calls the OpenAI-compatible chat completions endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"summary":"MiroMind reasoning note"}'
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const reasoner = createMiroMindReasoner({
      apiKey: "test-key",
      model: "gpt-oss-120b",
      fetchImpl: fetchMock
    });

    const result = await reasoner({
      task: defaultResearchTask,
      rootQuestion: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
      nodeLabels: ["Revenue Growth"]
    });

    expect(result.summary).toBe("MiroMind reasoning note");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.miromind.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key"
        })
      })
    );
  });
});
