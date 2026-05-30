import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const originalEnv = {
  apiKey: process.env.MIROMIND_API_KEY,
  model: process.env.MIROMIND_MODEL
};

afterEach(() => {
  restoreEnvValue("MIROMIND_API_KEY", originalEnv.apiKey);
  restoreEnvValue("MIROMIND_MODEL", originalEnv.model);
});

describe("GET /api/research/status", () => {
  it("reports live unavailable without leaking a key", async () => {
    delete process.env.MIROMIND_API_KEY;
    delete process.env.MIROMIND_MODEL;

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({
      liveAvailable: false,
      model: "gpt-oss-120b",
      fallbackAvailable: true
    });
  });

  it("reports live available without returning the key", async () => {
    process.env.MIROMIND_API_KEY = "secret-test-key";
    delete process.env.MIROMIND_MODEL;

    const response = await GET();
    const bodyText = await response.text();
    const body = JSON.parse(bodyText);

    expect(body).toEqual({
      liveAvailable: true,
      model: "gpt-oss-120b",
      fallbackAvailable: true
    });
    expect(bodyText).not.toContain("secret-test-key");
  });

  it("reports a configured MiroMind model", async () => {
    process.env.MIROMIND_API_KEY = "secret-test-key";
    process.env.MIROMIND_MODEL = "custom-test-model";

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({
      liveAvailable: true,
      model: "custom-test-model",
      fallbackAvailable: true
    });
  });
});

function restoreEnvValue(
  name: "MIROMIND_API_KEY" | "MIROMIND_MODEL",
  value: string | undefined
): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
