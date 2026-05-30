import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const originalKey = process.env.MIROMIND_API_KEY;

afterEach(() => {
  process.env.MIROMIND_API_KEY = originalKey;
});

describe("GET /api/research/status", () => {
  it("reports live unavailable without leaking a key", async () => {
    delete process.env.MIROMIND_API_KEY;

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

    const response = await GET();
    const bodyText = await response.text();

    expect(bodyText).toContain('"liveAvailable":true');
    expect(bodyText).not.toContain("secret-test-key");
  });
});
