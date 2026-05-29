import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/research/run", () => {
  it("returns a research run for a valid task", async () => {
    const response = await POST(
      new Request("http://localhost/api/research/run", {
        method: "POST",
        body: JSON.stringify({
          companyId: "nvda",
          questionTemplateId: "valuation-growth",
          timeHorizon: "12M",
          evidencePreference: "balanced"
        })
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.run.memo.finalStance).toBe("Partially Supported");
    expect(payload.run.phases).toHaveLength(6);
  });

  it("rejects unsupported request values", async () => {
    const response = await POST(
      new Request("http://localhost/api/research/run", {
        method: "POST",
        body: JSON.stringify({
          companyId: "goog",
          questionTemplateId: "valuation-growth",
          timeHorizon: "12M",
          evidencePreference: "balanced"
        })
      })
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toContain("Invalid research task");
  });
});
