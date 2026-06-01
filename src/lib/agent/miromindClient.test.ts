import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { createMiroMindStageClient, parseAssistantJson } from "./miromindClient";
import { createTaskFrameOutputSchemaForSecurity } from "./schemas";
import {
  buildEvidenceResearchPrompt,
  buildEvidencePlanPrompt,
  buildTaskFramePrompt
} from "./prompts";

describe("parseAssistantJson", () => {
  it("parses fenced JSON", () => {
    expect(parseAssistantJson("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });
});

describe("createMiroMindStageClient", () => {
  const schema = z.object({ summary: z.string() });

  it("sends the expected chat completion request and returns parsed schema output", async () => {
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
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.miromind.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer key",
          "Content-Type": "application/json"
        }
      })
    );
    const request = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      model: "model",
      stream: false,
      messages: [{ role: "user", content: "prompt" }]
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
    const repairRequest = (fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1];
    const repairPrompt = JSON.parse(String(repairRequest?.body)).messages[0].content;
    expect(repairPrompt).toContain("Stage: Task Framing");
    expect(repairPrompt).toContain("Original prompt:\nprompt");
    expect(repairPrompt).toContain("Invalid response:\nnot-json");
    expect(repairPrompt).toContain("Failure detail:");
    expect(repairPrompt).toContain("valid JSON matching the Task Framing schema/contract");
  });

  it("reports request telemetry for primary and repair attempts", async () => {
    const metrics: Array<{
      kind: "miromind-request";
      stageName: string;
      attempt: "primary" | "repair";
      durationMs: number;
      status: "success" | "failed";
    }> = [];
    let now = 1000;
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
      fetchImpl,
      now: () => {
        now += 10;
        return now;
      },
      onMetric: (metric) => metrics.push(metric)
    });

    await expect(client.completeJson("Task Framing", "prompt", schema)).resolves.toEqual({
      summary: "fixed"
    });

    expect(metrics).toEqual([
      {
        kind: "miromind-request",
        stageName: "Task Framing",
        attempt: "primary",
        durationMs: 10,
        status: "success"
      },
      {
        kind: "miromind-request",
        stageName: "Task Framing",
        attempt: "repair",
        durationMs: 10,
        status: "success"
      }
    ]);
  });

  it("repairs schema-invalid JSON once", async () => {
    const strictSchema = z.object({ summary: z.string() }).strict();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "{\"summary\":\"done\",\"extra\":true}" } }] }))
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "{\"summary\":\"fixed\"}" } }] }))
      );
    const client = createMiroMindStageClient({
      apiKey: "key",
      model: "model",
      baseUrl: "https://api.miromind.ai/v1/",
      fetchImpl
    });

    await expect(client.completeJson("Task Framing", "prompt", strictSchema)).resolves.toEqual({
      summary: "fixed"
    });
    const repairRequest = (fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1];
    const repairPrompt = JSON.parse(String(repairRequest?.body)).messages[0].content;
    expect(repairPrompt).toContain("Invalid response:\n{\"summary\":\"done\",\"extra\":true}");
    expect(repairPrompt).toContain("Failure detail:");
    expect(repairPrompt).toMatch(/Unrecognized key|extra/);
  });

  it("repairs task framing output that mismatches the selected security", async () => {
    const security = {
      name: "NVIDIA Corporation",
      ticker: "NVDA",
      exchange: "NASDAQ",
      country: "US",
      assetType: "Equity" as const
    };
    const taskFrameSchema = createTaskFrameOutputSchemaForSecurity(security);
    const mismatchedTaskFrame = {
      securityName: "Tesla, Inc.",
      ticker: "TSLA",
      sectorFrame: "AI accelerators and data center platforms",
      rootQuestion: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
      researchObjective: "Assess whether AI-driven fundamentals support the current valuation.",
      decisionCriteria: ["Revenue durability"],
      evidenceCategories: ["Filings"],
      safetyNote: "Research assistance only, not investment advice."
    };
    const repairedTaskFrame = {
      ...mismatchedTaskFrame,
      securityName: "NVIDIA Corporation",
      ticker: "NVDA"
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(mismatchedTaskFrame) } }] })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(repairedTaskFrame) } }] })
        )
      );
    const client = createMiroMindStageClient({
      apiKey: "key",
      model: "model",
      baseUrl: "https://api.miromind.ai/v1",
      fetchImpl
    });

    await expect(
      client.completeJson("Task Framing", "prompt", taskFrameSchema)
    ).resolves.toEqual(repairedTaskFrame);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws a clear error for non-OK responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503 }));
    const client = createMiroMindStageClient({
      apiKey: "key",
      model: "model",
      baseUrl: "https://api.miromind.ai/v1",
      fetchImpl
    });

    await expect(client.completeJson("Task Framing", "prompt", schema)).rejects.toThrow(
      "MiroMind request failed with status 503: nope"
    );
  });

  it("throws a clear error when assistant content is missing", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: {} }] }))
    );
    const client = createMiroMindStageClient({
      apiKey: "key",
      model: "model",
      baseUrl: "https://api.miromind.ai/v1",
      fetchImpl
    });

    await expect(client.completeJson("Task Framing", "prompt", schema)).rejects.toThrow(
      "MiroMind response did not include assistant content."
    );
  });

  it("throws stage and original failure context when repair fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }))
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "{\"nope\":true}" } }] }))
      );
    const client = createMiroMindStageClient({
      apiKey: "key",
      model: "model",
      baseUrl: "https://api.miromind.ai/v1",
      fetchImpl
    });

    await expect(client.completeJson("Task Framing", "prompt", schema)).rejects.toThrow(
      /MiroMind Task Framing response repair failed[\s\S]*Original failure:/
    );
  });
});

describe("prompt contracts", () => {
  const request = {
    security: {
      name: "NVIDIA Corporation",
      ticker: "NVDA",
      exchange: "NASDAQ",
      country: "US",
      assetType: "Equity" as const
    },
    question: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
    timeHorizon: "12M" as const,
    researchDepth: "deep" as const,
    evidencePreference: "balanced" as const,
    fallbackAllowed: true
  };

  it("gives JSON-only guidance with explicit task-frame fields and selected-security preservation", () => {
    const prompt = buildTaskFramePrompt(request);

    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("Do not include markdown");
    expect(prompt).toContain('"securityName": string');
    expect(prompt).toContain('"ticker": string');
    expect(prompt).toContain("NVIDIA Corporation");
    expect(prompt).toContain("NVDA");
    expect(prompt).toContain("Do not guess the ticker or company identity");
    expect(prompt).toContain("security.name exactly: NVIDIA Corporation");
    expect(prompt).toContain("security.ticker exactly: NVDA");
  });

  it("uses JSON context for hypothesis nodes in the evidence plan prompt", () => {
    const prompt = buildEvidencePlanPrompt({
      type: "hypothesis-tree",
      rootQuestion: request.question,
      nodes: [
        {
          id: "demand",
          label: "Demand",
          claim: "AI demand remains durable.",
          whyItMatters: "Demand drives revenue.",
          weight: 0.4,
          evidenceNeeded: ["Cloud capex"],
          counterEvidenceNeeded: ["Order pull-forward"]
        }
      ]
    });

    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain('"items":');
    expect(prompt).toContain('"nodes":[');
    expect(prompt).toContain('"id":"demand"');
  });

  it("describes evidence scores as optional numbers omitted when unavailable", () => {
    const prompt = buildEvidenceResearchPrompt({
      type: "evidence-plan",
      items: [
        {
          nodeId: "demand",
          researchQuestions: ["What supports durable demand?"],
          preferredSourceTypes: ["earnings"],
          sourceCandidates: ["Company earnings call"],
          supportingSignals: ["Raised guidance"],
          refutingSignals: ["Order delays"]
        }
      ]
    });

    expect(prompt).toContain('"reliabilityScore": optional number');
    expect(prompt).toContain('"relevanceScore": optional number');
    expect(prompt).toContain('"freshnessScore": optional number');
    expect(prompt).toContain("Omit optional score fields when unavailable");
    expect(prompt).not.toContain("undefined");
  });
});
