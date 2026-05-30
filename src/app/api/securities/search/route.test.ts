import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/securities/search", () => {
  it("returns matching listed securities", async () => {
    const response = await GET(new Request("http://localhost/api/securities/search?q=nvda"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results[0]).toMatchObject({
      name: "NVIDIA Corporation",
      ticker: "NVDA"
    });
  });

  it("returns empty results for empty query", async () => {
    const response = await GET(new Request("http://localhost/api/securities/search?q="));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toEqual([]);
  });
});
