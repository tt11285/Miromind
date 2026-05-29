import { describe, expect, it } from "vitest";
import {
  companies,
  defaultResearchTask,
  getCompany,
  getQuestionTemplate,
  questionTemplates
} from "./researchConfig";

describe("research configuration", () => {
  it("supports the four approved companies", () => {
    expect(companies.map((company) => company.id)).toEqual([
      "nvda",
      "msft",
      "mu",
      "tsla"
    ]);
  });

  it("supports the four approved research templates", () => {
    expect(questionTemplates.map((template) => template.id)).toEqual([
      "valuation-growth",
      "downside-risk",
      "bull-bear",
      "earnings-thesis"
    ]);
  });

  it("uses NVIDIA valuation as the golden path default", () => {
    expect(defaultResearchTask).toMatchObject({
      companyId: "nvda",
      questionTemplateId: "valuation-growth",
      timeHorizon: "12M",
      evidencePreference: "balanced"
    });
  });

  it("retrieves company and template metadata by id", () => {
    expect(getCompany("mu").ticker).toBe("MU");
    expect(getQuestionTemplate("valuation-growth").title).toContain("valuation");
  });
});
