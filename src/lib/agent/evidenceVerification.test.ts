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
    quotedSnippet: "Data center demand remained strong this quarter.",
    extractedFact: "AI data center demand remained strong.",
    direction: "supports",
    reasoningImpact: "Supports demand durability.",
    ...overrides
  };
}

function htmlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

describe("verifyEvidenceCards", () => {
  it("verifies a source when the quoted snippet is found on the page", async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse(
        "<html><body><p>Management said data center demand remained strong this quarter.</p></body></html>"
      )
    );
    const [result] = await verifyEvidenceCards([card()], { fetchImpl });

    expect(result.provenanceStatus).toBe("verified");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("verifies via key-term overlap when the quote is lightly reworded", async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse("<p>The company reported that data center demand stayed strong.</p>")
    );
    const [result] = await verifyEvidenceCards([card()], { fetchImpl });

    expect(result.provenanceStatus).toBe("verified");
  });

  it("downgrades to model-reported when the snippet is not on the page", async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse("<p>Unrelated content about the weather forecast.</p>")
    );
    const [result] = await verifyEvidenceCards([card({ provenanceStatus: "verified" })], {
      fetchImpl
    });

    expect(result.provenanceStatus).toBe("model-reported");
  });

  it("extracts a url even when surrounded by descriptive text", async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse("data center demand remained strong this quarter")
    );
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

  it("does not verify non-text (binary) responses", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("%PDF-1.7 ...", {
        status: 200,
        headers: { "content-type": "application/pdf" }
      })
    );
    const [result] = await verifyEvidenceCards([card({ provenanceStatus: "verified" })], {
      fetchImpl
    });

    expect(result.provenanceStatus).toBe("model-reported");
  });

  it("marks non-url references as model-reported without fetching", async () => {
    const fetchImpl = vi.fn(async () => htmlResponse("anything"));
    const [result] = await verifyEvidenceCards(
      [card({ urlOrReference: "Analyst commentary, no public link" })],
      { fetchImpl }
    );

    expect(result.provenanceStatus).toBe("model-reported");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("leaves unavailable cards unchanged and does not fetch them", async () => {
    const fetchImpl = vi.fn(async () => htmlResponse("anything"));
    const [result] = await verifyEvidenceCards(
      [card({ provenanceStatus: "unavailable", urlOrReference: "No verified source returned." })],
      { fetchImpl }
    );

    expect(result.provenanceStatus).toBe("unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
