import { describe, expect, it } from "vitest";
import { getSecuritySearchProvider, searchListedSecurities } from "./search";

describe("searchListedSecurities", () => {
  it("finds NVIDIA by ticker", () => {
    expect(searchListedSecurities("nvda")[0]).toMatchObject({
      name: "NVIDIA Corporation",
      ticker: "NVDA",
      exchange: "NASDAQ",
      country: "US",
      assetType: "Equity"
    });
  });

  it("finds Micron by company name", () => {
    expect(searchListedSecurities("micron")[0]?.ticker).toBe("MU");
  });

  it("returns no private-company match for OpenAI", () => {
    expect(searchListedSecurities("openai")).toEqual([]);
  });

  it("limits results to listed equities", () => {
    const results = searchListedSecurities("m");
    expect(results.length).toBeLessThanOrEqual(8);
    expect(results.every((item) => item.assetType === "Equity")).toBe(true);
  });
});

describe("getSecuritySearchProvider", () => {
  it("resolves a provider that searches the active source", async () => {
    const results = await getSecuritySearchProvider().search("nvda");
    expect(results[0]?.ticker).toBe("NVDA");
  });
});
