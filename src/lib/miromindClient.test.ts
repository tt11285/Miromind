import { describe, expect, it, vi } from "vitest";
import { createMiroMindReasoner, parseJsonFromAssistantText } from "./miromindClient";
import { defaultResearchTask } from "./researchConfig";

describe("MiroMind client", () => {
  const rootQuestion =
    "Is NVIDIA's current valuation justified by AI growth fundamentals?";

  it("parses plain JSON and fenced JSON", () => {
    expect(parseJsonFromAssistantText('{"summary":"ok"}')).toEqual({ summary: "ok" });
    expect(parseJsonFromAssistantText('```json\n{"summary":"ok"}\n```')).toEqual({
      summary: "ok"
    });
  });

  it("calls the OpenAI-compatible chat completions endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
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
      rootQuestion,
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

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.model).toBe("gpt-oss-120b");
    expect(body.stream).toBe(false);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toContain(rootQuestion);
    expect(body.messages[0].content).toContain(defaultResearchTask.companyId);
    expect(body.messages[0].content).toContain(defaultResearchTask.questionTemplateId);
    expect(body.messages[0].content).toContain("Revenue Growth");
  });

  it("throws a clear error for non-OK responses", async () => {
    const reasoner = createMiroMindReasoner({
      apiKey: "test-key",
      model: "gpt-oss-120b",
      fetchImpl: vi.fn(async () => new Response("bad gateway", { status: 502 }))
    });

    await expect(
      reasoner({
        task: defaultResearchTask,
        rootQuestion,
        nodeLabels: ["Revenue Growth"]
      })
    ).rejects.toThrow("MiroMind request failed with status 502: bad gateway");
  });

  it("throws a clear error when assistant content is missing", async () => {
    const reasoner = createMiroMindReasoner({
      apiKey: "test-key",
      model: "gpt-oss-120b",
      fetchImpl: vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 })
      )
    });

    await expect(
      reasoner({
        task: defaultResearchTask,
        rootQuestion,
        nodeLabels: ["Revenue Growth"]
      })
    ).rejects.toThrow("MiroMind response did not include assistant content.");
  });

  it("throws a clear error when assistant content is invalid JSON", async () => {
    const reasoner = createMiroMindReasoner({
      apiKey: "test-key",
      model: "gpt-oss-120b",
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{not json" } }]
          }),
          { status: 200 }
        )
      )
    });

    await expect(
      reasoner({
        task: defaultResearchTask,
        rootQuestion,
        nodeLabels: ["Revenue Growth"]
      })
    ).rejects.toThrow("MiroMind response content was not valid JSON.");
  });

  it("throws a clear error when summary is missing or not a string", async () => {
    for (const content of ["{}", '{"summary":42}']) {
      const reasoner = createMiroMindReasoner({
        apiKey: "test-key",
        model: "gpt-oss-120b",
        fetchImpl: vi.fn(async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content } }]
            }),
            { status: 200 }
          )
        )
      });

      await expect(
        reasoner({
          task: defaultResearchTask,
          rootQuestion,
          nodeLabels: ["Revenue Growth"]
        })
      ).rejects.toThrow("MiroMind response JSON must include a string summary.");
    }
  });
});
