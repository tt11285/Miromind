import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const originalKey = process.env.MIROMIND_API_KEY;
const originalModel = process.env.MIROMIND_MODEL;
const originalBaseUrl = process.env.MIROMIND_BASE_URL;
const originalTimeout = process.env.MIROMIND_REQUEST_TIMEOUT_MS;

afterEach(() => {
  restoreEnv("MIROMIND_API_KEY", originalKey);
  restoreEnv("MIROMIND_MODEL", originalModel);
  restoreEnv("MIROMIND_BASE_URL", originalBaseUrl);
  restoreEnv("MIROMIND_REQUEST_TIMEOUT_MS", originalTimeout);
});

const requestBody = {
  security: {
    name: "NVIDIA Corporation",
    ticker: "NVDA",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  question: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
  timeHorizon: "12M",
  researchDepth: "deep",
  evidencePreference: "balanced",
  fallbackAllowed: true
};

describe("POST /api/research/run", () => {
  it("rejects requests without selected security", async () => {
    const response = await POST(
      new Request("http://localhost/api/research/run", {
        method: "POST",
        body: JSON.stringify({ question: "Is valuation justified?" })
      })
    );

    expect(response.status).toBe(400);
  });

  it("streams fallback JSON lines when the live key is missing", async () => {
    delete process.env.MIROMIND_API_KEY;

    const response = await POST(
      new Request("http://localhost/api/research/run", {
        method: "POST",
        body: JSON.stringify(requestBody)
      })
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");
    expect(text).toContain('"type":"run-started"');
    expect(text).toContain('"type":"artifact"');
    expect(text).toContain('"mode":"demo-fallback"');
  });

  it("does not fabricate fallback for non-curated selected securities", async () => {
    delete process.env.MIROMIND_API_KEY;

    const response = await POST(
      new Request("http://localhost/api/research/run", {
        method: "POST",
        body: JSON.stringify({
          ...requestBody,
          security: {
            name: "Micron Technology, Inc.",
            ticker: "MU",
            exchange: "NASDAQ",
            country: "US",
            assetType: "Equity"
          },
          question: "Is Micron's valuation justified by HBM-driven AI demand?"
        })
      })
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('"type":"run-failed"');
    expect(text).toContain("MiroMind API key is required");
    expect(text).not.toContain('"type":"artifact"');
  });

  it("completes a live run with auditable fallback artifacts when live MiroMind fails", async () => {
    process.env.MIROMIND_API_KEY = "test-key";
    process.env.MIROMIND_BASE_URL = "http://127.0.0.1:9";
    process.env.MIROMIND_REQUEST_TIMEOUT_MS = "50";

    const response = await POST(
      new Request("http://localhost/api/research/run", {
        method: "POST",
        body: JSON.stringify(requestBody)
      })
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('"mode":"live-agent"');
    expect(text).toContain('"type":"artifact"');
    expect(text).toContain("completed with limited live evidence");
    expect(text).toContain('"provenanceStatus":"unavailable"');
    expect(text).toContain('"type":"run-completed"');
    expect(text).not.toContain('"type":"run-failed"');
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
