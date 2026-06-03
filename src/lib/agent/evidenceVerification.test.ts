import { describe, expect, it, vi } from "vitest";
import { verifyEvidenceCards } from "./evidenceVerification";
import type { AgentEvidenceCard } from "./types";

function card(overrides: Partial<AgentEvidenceCard> = {}): AgentEvidenceCard {
  return {
    id: "ev-1",
    nodeId: "demand",
    sourceTitle: "NVIDIA earnings",
    sourceType: "earnings",
    sourceDate: "2026-02-25",
    urlOrReference: "https://investor.nvidia.com/",
    provenanceStatus: "model-reported",
    quotedSnippet: "Demand remained strong.",
    extractedFact: "AI demand remained strong.",
    direction: "supports",
    reasoningImpact: "Supports demand durability.",
    ...overrides
  };
}

function okFetch() {
  return vi.fn(async () => new Response(null, { status: 200 }));
}

describe("verifyEvidenceCards", () => {
  it("marks reachable http sources as verified", async () => {
    const fetchImpl = okFetch();
    const [result] = await verifyEvidenceCards([card()], { fetchImpl });

    expect(result.provenanceStatus).toBe("verified");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("extracts a url even when surrounded by descriptive text", async () => {
    const fetchImpl = okFetch();
    const [result] = await verifyEvidenceCards(
      [card({ urlOrReference: "NVIDIA 10-K (https://investor.nvidia.com/sec) filing" })],
      { fetchImpl }
    );

    expect(result.provenanceStatus).toBe("verified");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://investor.nvidia.com/sec",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("downgrades unreachable urls to model-reported", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));
    const [result] = await verifyEvidenceCards([card({ provenanceStatus: "verified" })], {
      fetchImpl
    });

    expect(result.provenanceStatus).toBe("model-reported");
  });

  it("downgrades urls that throw or time out to model-reported", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network failure");
    });
    const [result] = await verifyEvidenceCards([card({ provenanceStatus: "verified" })], {
      fetchImpl
    });

    expect(result.provenanceStatus).toBe("model-reported");
  });

  it("marks non-url references as model-reported without fetching", async () => {
    const fetchImpl = okFetch();
    const [result] = await verifyEvidenceCards(
      [card({ urlOrReference: "Analyst commentary, no public link" })],
      { fetchImpl }
    );

    expect(result.provenanceStatus).toBe("model-reported");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("leaves unavailable cards unchanged and does not fetch them", async () => {
    const fetchImpl = okFetch();
    const [result] = await verifyEvidenceCards(
      [card({ provenanceStatus: "unavailable", urlOrReference: "No verified source returned." })],
      { fetchImpl }
    );

    expect(result.provenanceStatus).toBe("unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
