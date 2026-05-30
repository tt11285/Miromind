import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { createMiroMindStageClient, parseAssistantJson } from "./miromindClient";

describe("parseAssistantJson", () => {
  it("parses fenced JSON", () => {
    expect(parseAssistantJson("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });
});

describe("createMiroMindStageClient", () => {
  const schema = z.object({ summary: z.string() });

  it("returns parsed schema output", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"summary\":\"done\"}" } }] }))
    );
    const client = createMiroMindStageClient({
      apiKey: "key",
      model: "model",
      baseUrl: "https://api.miromind.ai/v1",
      fetchImpl
    });

    await expect(client.completeJson("Task Framing", "prompt", schema)).resolves.toEqual({
      summary: "done"
    });
  });

  it("repairs invalid JSON once", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }))
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "{\"summary\":\"fixed\"}" } }] }))
      );
    const client = createMiroMindStageClient({
      apiKey: "key",
      model: "model",
      baseUrl: "https://api.miromind.ai/v1",
      fetchImpl
    });

    await expect(client.completeJson("Task Framing", "prompt", schema)).resolves.toEqual({
      summary: "fixed"
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
