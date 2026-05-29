# ValuationLens Real Agent MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert ValuationLens from a fixture-backed research board into a MiroMind-first live financial research agent with listed-company selection, streaming reasoning stages, generated hypothesis trees, generated evidence cards, and traceable memos.

**Architecture:** The browser first resolves a listed public equity through a ticker/company search endpoint, then posts a structured selected-security research request. The server streams JSONL agent events from a MiroMind-backed multi-stage orchestrator, with curated fixtures used only as honestly labeled fallback. The UI parses the stream and progressively renders the run timeline, hypothesis tree, evidence cards, and memo.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zod, Vitest, Testing Library, server-side MiroMind OpenAI-compatible chat completions.

---

## File Structure

Create or modify these files:

- Create `src/lib/agent/types.ts`: canonical Real Agent request, event, artifact, security, phase, evidence, node, memo, and run types.
- Create `src/lib/agent/schemas.ts`: Zod schemas for incoming research requests and MiroMind structured outputs.
- Create `src/lib/agent/schemas.test.ts`: validation tests for selected-security requests and MiroMind outputs.
- Create `src/lib/securities/search.ts`: local listed-company matcher for NVIDIA, Microsoft, Micron, and Tesla.
- Create `src/lib/securities/search.test.ts`: ticker/name matching tests.
- Create `src/app/api/securities/search/route.ts`: search endpoint.
- Create `src/app/api/securities/search/route.test.ts`: endpoint tests.
- Create `src/app/api/research/status/route.ts`: live/fallback status endpoint that never leaks keys.
- Create `src/app/api/research/status/route.test.ts`: status endpoint tests.
- Create `src/lib/agent/prompts.ts`: prompt builders for task framing, hypothesis generation, evidence planning, evidence research, and synthesis.
- Create `src/lib/agent/miromindClient.ts`: JSON-only MiroMind client with one repair retry.
- Create `src/lib/agent/miromindClient.test.ts`: JSON parsing, repair, and error tests.
- Create `src/lib/agent/scoring.ts`: dynamic evidence/node scoring for generated evidence cards.
- Create `src/lib/agent/scoring.test.ts`: scoring tests.
- Create `src/lib/agent/fallback.ts`: curated fallback adapter for the NVIDIA primary demo task.
- Create `src/lib/agent/fallback.test.ts`: fallback eligibility and labeling tests.
- Create `src/lib/agent/runAgent.ts`: async generator orchestrating the live or fallback agent run.
- Create `src/lib/agent/runAgent.test.ts`: event ordering, live mocked MiroMind, missing-key fallback, and failure tests.
- Replace `src/app/api/research/run/route.ts`: streaming JSONL response.
- Replace `src/app/api/research/run/route.test.ts`: streaming route tests.
- Create `src/lib/agent/streamClient.ts`: client-side JSONL stream parser.
- Create `src/lib/agent/streamClient.test.ts`: chunked JSONL parsing tests.
- Create `src/components/AgentInputPanel.tsx`: searchable ticker picker and run controls.
- Create `src/components/AgentInputPanel.test.tsx`: selection, validation, and disabled-run tests.
- Create `src/components/AgentRunTimeline.tsx`: live phase list.
- Modify `src/components/HypothesisTree.tsx`: accept dynamic generated nodes.
- Modify `src/components/EvidencePanel.tsx`: accept dynamic generated evidence and provenance labels.
- Modify `src/components/InvestmentMemo.tsx`: accept dynamic memo sections and partial state.
- Create `src/components/LiveResearchWorkbench.tsx`: stream-owning workbench replacing `ResearchWorkbench`.
- Delete `src/components/ResearchWorkbench.tsx`: replaced by `LiveResearchWorkbench`.
- Delete `src/components/ResearchWorkbench.test.tsx`: replaced by live agent workbench tests.
- Modify `src/app/page.tsx`: render `LiveResearchWorkbench`.
- Modify `src/app/globals.css`: styles for ticker search, stream status, provenance chips, and error states.
- Modify `README.md`: `.env.local`, live agent mode, fallback mode, and NVIDIA primary demo.
- Modify `docs/demo-script.md`: live NVIDIA walkthrough and Micron secondary proof.

## Task 1: Define Agent Types And Schemas

**Files:**
- Create: `src/lib/agent/types.ts`
- Create: `src/lib/agent/schemas.ts`
- Create: `src/lib/agent/schemas.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `src/lib/agent/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  agentRequestSchema,
  evidenceResearchOutputSchema,
  hypothesisOutputSchema,
  taskFrameOutputSchema
} from "./schemas";

const nvdaSecurity = {
  name: "NVIDIA Corporation",
  ticker: "NVDA",
  exchange: "NASDAQ",
  country: "US",
  assetType: "Equity"
};

describe("agent schemas", () => {
  it("accepts a selected listed security request", () => {
    const parsed = agentRequestSchema.parse({
      security: nvdaSecurity,
      question: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
      timeHorizon: "12M",
      researchDepth: "deep",
      evidencePreference: "balanced",
      fallbackAllowed: true
    });

    expect(parsed.security.ticker).toBe("NVDA");
    expect(parsed.question).toContain("valuation");
  });

  it("rejects a raw company string request", () => {
    const result = agentRequestSchema.safeParse({
      company: "NVIDIA",
      question: "Is the valuation justified?",
      timeHorizon: "12M",
      researchDepth: "deep",
      evidencePreference: "balanced",
      fallbackAllowed: true
    });

    expect(result.success).toBe(false);
  });

  it("validates task framing output", () => {
    const parsed = taskFrameOutputSchema.parse({
      securityName: "NVIDIA Corporation",
      ticker: "NVDA",
      sectorFrame: "AI accelerators and data center platforms",
      rootQuestion: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
      researchObjective: "Assess whether AI-driven fundamentals support the current valuation.",
      decisionCriteria: ["Revenue durability", "Margin durability"],
      evidenceCategories: ["Filings", "Earnings calls", "Market data"],
      safetyNote: "Research assistance only, not investment advice."
    });

    expect(parsed.ticker).toBe("NVDA");
  });

  it("validates generated hypothesis nodes", () => {
    const node = {
      id: "demand-sustainability",
      label: "Demand Sustainability",
      claim: "AI demand can remain strong enough to support valuation assumptions.",
      whyItMatters: "Demand durability is central to forward revenue expectations.",
      weight: 0.24,
      evidenceNeeded: ["Cloud capex commentary"],
      counterEvidenceNeeded: ["Signs of order pull-forward"]
    };
    const parsed = hypothesisOutputSchema.parse({
      rootQuestion: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
      nodes: [
        node,
        { ...node, id: "margin-durability", label: "Margin Durability" },
        { ...node, id: "competitive-moat", label: "Competitive Moat" },
        { ...node, id: "valuation-sensitivity", label: "Valuation Sensitivity" }
      ]
    });

    expect(parsed.nodes[0].id).toBe("demand-sustainability");
  });

  it("requires evidence provenance status", () => {
    const parsed = evidenceResearchOutputSchema.parse({
      evidenceCards: [
        {
          id: "ev-demand-1",
          nodeId: "demand-sustainability",
          sourceTitle: "NVIDIA quarterly results",
          sourceType: "earnings",
          sourceDate: "2026-02-25",
          urlOrReference: "https://investor.nvidia.com/",
          provenanceStatus: "model-reported",
          quotedSnippet: "Data center demand remained strong.",
          extractedFact: "Management reported strong AI data center demand.",
          direction: "supports",
          reasoningImpact: "Supports the demand sustainability node."
        }
      ]
    });

    expect(parsed.evidenceCards[0].provenanceStatus).toBe("model-reported");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- src/lib/agent/schemas.test.ts
```

Expected: FAIL because `src/lib/agent/schemas.ts` does not exist.

- [ ] **Step 3: Implement agent types**

Create `src/lib/agent/types.ts`:

```ts
export type AssetType = "Equity";
export type TimeHorizon = "3M" | "12M" | "3Y";
export type ResearchDepth = "fast" | "deep";
export type EvidencePreference = "balanced" | "financials" | "earnings" | "news";
export type AgentMode = "live-agent" | "demo-fallback";
export type PhaseStatus = "queued" | "running" | "complete" | "failed";
export type EvidenceDirection = "supports" | "refutes" | "complicates";
export type EvidenceSourceType =
  | "filing"
  | "earnings"
  | "market-data"
  | "news"
  | "industry"
  | "other";
export type EvidenceProvenanceStatus = "verified" | "model-reported" | "unavailable";
export type NodeStance =
  | "supports"
  | "weakly-supports"
  | "mixed"
  | "weakly-refutes"
  | "refutes";
export type FinalStance =
  | "Supported"
  | "Partially Supported"
  | "Inconclusive"
  | "Weakly Unsupported"
  | "Not Supported";
export type Confidence = "High" | "Medium-High" | "Medium" | "Low";

export interface ListedSecurity {
  name: string;
  ticker: string;
  exchange: string;
  country: string;
  assetType: AssetType;
}

export interface AgentRequest {
  security: ListedSecurity;
  question: string;
  timeHorizon: TimeHorizon;
  researchDepth: ResearchDepth;
  evidencePreference: EvidencePreference;
  fallbackAllowed: boolean;
}

export type AgentPhaseName =
  | "Task Framing"
  | "Hypothesis Generation"
  | "Evidence Planning"
  | "Evidence Research"
  | "Evidence Scoring"
  | "Reasoning Synthesis"
  | "Memo Rendering";

export interface AgentPhase {
  name: AgentPhaseName;
  status: PhaseStatus;
  detail: string;
}

export interface TaskFrameArtifact {
  type: "task-frame";
  securityName: string;
  ticker: string;
  sectorFrame: string;
  rootQuestion: string;
  researchObjective: string;
  decisionCriteria: string[];
  evidenceCategories: string[];
  safetyNote: string;
}

export interface HypothesisNodeDraft {
  id: string;
  label: string;
  claim: string;
  whyItMatters: string;
  weight: number;
  evidenceNeeded: string[];
  counterEvidenceNeeded: string[];
}

export interface HypothesisTreeArtifact {
  type: "hypothesis-tree";
  rootQuestion: string;
  nodes: HypothesisNodeDraft[];
}

export interface EvidencePlanItem {
  nodeId: string;
  researchQuestions: string[];
  preferredSourceTypes: EvidenceSourceType[];
  sourceCandidates: string[];
  supportingSignals: string[];
  refutingSignals: string[];
}

export interface EvidencePlanArtifact {
  type: "evidence-plan";
  items: EvidencePlanItem[];
}

export interface AgentEvidenceCard {
  id: string;
  nodeId: string;
  sourceTitle: string;
  sourceType: EvidenceSourceType;
  sourceDate: string;
  urlOrReference: string;
  provenanceStatus: EvidenceProvenanceStatus;
  quotedSnippet: string;
  extractedFact: string;
  direction: EvidenceDirection;
  reasoningImpact: string;
  reliabilityScore?: number;
  relevanceScore?: number;
  freshnessScore?: number;
}

export interface EvidenceCardsArtifact {
  type: "evidence-cards";
  evidenceCards: AgentEvidenceCard[];
}

export interface ScoredNode {
  id: string;
  label: string;
  claim: string;
  weight: number;
  stance: NodeStance;
  confidence: Confidence;
  weightedScore: number;
  reasoningNote: string;
  whatWouldChange: string;
  supportingEvidenceIds: string[];
  counterEvidenceIds: string[];
}

export interface ScoredNodesArtifact {
  type: "scored-nodes";
  nodes: ScoredNode[];
  finalScore: number;
  finalStance: FinalStance;
  confidence: Confidence;
}

export interface MemoSectionArtifact {
  id: string;
  title: string;
  body: string;
  linkedNodeIds: string[];
  linkedEvidenceIds: string[];
}

export interface MemoArtifact {
  type: "memo";
  executiveSummary: string;
  finalStance: FinalStance;
  confidence: Confidence;
  finalScore: number;
  keyDrivers: string[];
  biggestCounterargument: string;
  whatWouldChangeTheView: string[];
  humanReviewChecklist: string[];
  sections: MemoSectionArtifact[];
}

export type AgentArtifact =
  | TaskFrameArtifact
  | HypothesisTreeArtifact
  | EvidencePlanArtifact
  | EvidenceCardsArtifact
  | ScoredNodesArtifact
  | MemoArtifact;

export interface AgentRun {
  runId: string;
  mode: AgentMode;
  request: AgentRequest;
  phases: AgentPhase[];
  artifacts: AgentArtifact[];
  taskFrame?: TaskFrameArtifact;
  hypothesisTree?: HypothesisTreeArtifact;
  evidencePlan?: EvidencePlanArtifact;
  evidenceCards?: AgentEvidenceCard[];
  scoredNodes?: ScoredNodesArtifact;
  memo?: MemoArtifact;
}

export type AgentEvent =
  | { type: "run-started"; runId: string; mode: AgentMode }
  | { type: "phase-started"; phase: AgentPhaseName; detail: string }
  | { type: "artifact"; artifact: AgentArtifact }
  | { type: "phase-completed"; phase: AgentPhaseName; detail: string }
  | { type: "phase-failed"; phase: AgentPhaseName; error: string }
  | { type: "run-completed"; run: AgentRun }
  | { type: "run-failed"; error: string; fallbackAvailable: boolean };
```

- [ ] **Step 4: Implement Zod schemas**

Create `src/lib/agent/schemas.ts`:

```ts
import { z } from "zod";

export const listedSecuritySchema = z.object({
  name: z.string().min(1),
  ticker: z.string().min(1),
  exchange: z.string().min(1),
  country: z.string().min(1),
  assetType: z.literal("Equity")
});

export const agentRequestSchema = z.object({
  security: listedSecuritySchema,
  question: z.string().min(8),
  timeHorizon: z.enum(["3M", "12M", "3Y"]),
  researchDepth: z.enum(["fast", "deep"]),
  evidencePreference: z.enum(["balanced", "financials", "earnings", "news"]),
  fallbackAllowed: z.boolean()
});

export const taskFrameOutputSchema = z.object({
  securityName: z.string().min(1),
  ticker: z.string().min(1),
  sectorFrame: z.string().min(1),
  rootQuestion: z.string().min(1),
  researchObjective: z.string().min(1),
  decisionCriteria: z.array(z.string().min(1)).min(1),
  evidenceCategories: z.array(z.string().min(1)).min(1),
  safetyNote: z.string().min(1)
});

export const hypothesisNodeDraftSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  claim: z.string().min(1),
  whyItMatters: z.string().min(1),
  weight: z.number().positive(),
  evidenceNeeded: z.array(z.string().min(1)).min(1),
  counterEvidenceNeeded: z.array(z.string().min(1)).min(1)
});

export const hypothesisOutputSchema = z.object({
  rootQuestion: z.string().min(1),
  nodes: z.array(hypothesisNodeDraftSchema).min(4).max(7)
});

export const evidencePlanOutputSchema = z.object({
  items: z.array(
    z.object({
      nodeId: z.string().min(1),
      researchQuestions: z.array(z.string().min(1)).min(1),
      preferredSourceTypes: z.array(
        z.enum(["filing", "earnings", "market-data", "news", "industry", "other"])
      ).min(1),
      sourceCandidates: z.array(z.string()),
      supportingSignals: z.array(z.string().min(1)).min(1),
      refutingSignals: z.array(z.string().min(1)).min(1)
    })
  ).min(1)
});

export const evidenceCardSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  sourceTitle: z.string().min(1),
  sourceType: z.enum(["filing", "earnings", "market-data", "news", "industry", "other"]),
  sourceDate: z.string().min(1),
  urlOrReference: z.string().min(1),
  provenanceStatus: z.enum(["verified", "model-reported", "unavailable"]),
  quotedSnippet: z.string().min(1),
  extractedFact: z.string().min(1),
  direction: z.enum(["supports", "refutes", "complicates"]),
  reasoningImpact: z.string().min(1)
});

export const evidenceResearchOutputSchema = z.object({
  evidenceCards: z.array(evidenceCardSchema).min(1)
});

export const synthesisOutputSchema = z.object({
  executiveSummary: z.string().min(1),
  finalStance: z.enum([
    "Supported",
    "Partially Supported",
    "Inconclusive",
    "Weakly Unsupported",
    "Not Supported"
  ]),
  confidence: z.enum(["High", "Medium-High", "Medium", "Low"]),
  keyDrivers: z.array(z.string().min(1)).min(1),
  biggestCounterargument: z.string().min(1),
  whatWouldChangeTheView: z.array(z.string().min(1)).min(1),
  humanReviewChecklist: z.array(z.string().min(1)).min(1),
  sections: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      body: z.string().min(1),
      linkedNodeIds: z.array(z.string().min(1)).min(1),
      linkedEvidenceIds: z.array(z.string().min(1))
    })
  ).min(1)
});

export type AgentRequestInput = z.infer<typeof agentRequestSchema>;
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
npm run test -- src/lib/agent/schemas.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/types.ts src/lib/agent/schemas.ts src/lib/agent/schemas.test.ts
git commit -m "feat: define real agent schemas"
```

## Task 2: Add Listed Company Search

**Files:**
- Create: `src/lib/securities/search.ts`
- Create: `src/lib/securities/search.test.ts`
- Create: `src/app/api/securities/search/route.ts`
- Create: `src/app/api/securities/search/route.test.ts`

- [ ] **Step 1: Write failing search tests**

Create `src/lib/securities/search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { searchListedSecurities } from "./search";

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
```

- [ ] **Step 2: Implement local matcher**

Create `src/lib/securities/search.ts`:

```ts
import type { ListedSecurity } from "@/lib/agent/types";

export const demoSecurities: ListedSecurity[] = [
  {
    name: "NVIDIA Corporation",
    ticker: "NVDA",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  {
    name: "Microsoft Corporation",
    ticker: "MSFT",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  {
    name: "Micron Technology, Inc.",
    ticker: "MU",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  {
    name: "Tesla, Inc.",
    ticker: "TSLA",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  }
];

export function searchListedSecurities(query: string): ListedSecurity[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return [];
  }

  return demoSecurities
    .filter((security) => {
      const name = security.name.toLowerCase();
      const ticker = security.ticker.toLowerCase();
      return ticker.startsWith(normalized) || name.includes(normalized);
    })
    .slice(0, 8);
}
```

- [ ] **Step 3: Run search tests**

Run:

```bash
npm run test -- src/lib/securities/search.test.ts
```

Expected: PASS.

- [ ] **Step 4: Write endpoint tests**

Create `src/app/api/securities/search/route.test.ts`:

```ts
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
```

- [ ] **Step 5: Implement endpoint**

Create `src/app/api/securities/search/route.ts`:

```ts
import { searchListedSecurities } from "@/lib/securities/search";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  return Response.json({ results: searchListedSecurities(query) });
}
```

- [ ] **Step 6: Run endpoint tests**

Run:

```bash
npm run test -- src/lib/securities/search.test.ts src/app/api/securities/search/route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/securities/search.ts src/lib/securities/search.test.ts src/app/api/securities/search/route.ts src/app/api/securities/search/route.test.ts
git commit -m "feat: add listed security search"
```

## Task 3: Add Live Status Endpoint

**Files:**
- Create: `src/app/api/research/status/route.ts`
- Create: `src/app/api/research/status/route.test.ts`

- [ ] **Step 1: Write failing status tests**

Create `src/app/api/research/status/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Implement status endpoint**

Create `src/app/api/research/status/route.ts`:

```ts
export async function GET(): Promise<Response> {
  return Response.json({
    liveAvailable: Boolean(process.env.MIROMIND_API_KEY),
    model: process.env.MIROMIND_MODEL ?? "gpt-oss-120b",
    fallbackAvailable: true
  });
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- src/app/api/research/status/route.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/research/status/route.ts src/app/api/research/status/route.test.ts
git commit -m "feat: expose research mode status"
```

## Task 4: Add MiroMind JSON Stage Client

**Files:**
- Create: `src/lib/agent/prompts.ts`
- Create: `src/lib/agent/miromindClient.ts`
- Create: `src/lib/agent/miromindClient.test.ts`

- [ ] **Step 1: Write failing client tests**

Create `src/lib/agent/miromindClient.test.ts`:

```ts
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { createMiroMindStageClient, parseAssistantJson } from "./miromindClient";

describe("parseAssistantJson", () => {
  it("parses fenced JSON", () => {
    expect(parseAssistantJson("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });
});

describe("createMiroMindStageClient", () => {
  const schema = z.object({ summary: z.string() });

  it("returns parsed schema output", async () => {
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
  });
});
```

- [ ] **Step 2: Implement prompt builders**

Create `src/lib/agent/prompts.ts`:

```ts
import type {
  AgentEvidenceCard,
  AgentRequest,
  EvidencePlanArtifact,
  HypothesisTreeArtifact,
  ScoredNodesArtifact,
  TaskFrameArtifact
} from "./types";

function jsonOnly(schemaName: string): string {
  return `Return JSON only. Do not include markdown. The JSON must match ${schemaName}.`;
}

export function buildTaskFramePrompt(request: AgentRequest): string {
  return [
    jsonOnly("TaskFrameOutput"),
    `Selected security: ${request.security.name} (${request.security.ticker}) on ${request.security.exchange}.`,
    `Country: ${request.security.country}. Asset type: ${request.security.assetType}.`,
    `Question: ${request.question}`,
    `Time horizon: ${request.timeHorizon}. Evidence preference: ${request.evidencePreference}.`,
    "Do not guess the company identity. Use the selected security exactly."
  ].join("\n");
}

export function buildHypothesisPrompt(frame: TaskFrameArtifact, request: AgentRequest): string {
  const nodeTarget = request.researchDepth === "deep" ? "5 to 7" : "4";
  return [
    jsonOnly("HypothesisOutput"),
    `Root question: ${frame.rootQuestion}`,
    `Generate ${nodeTarget} hypothesis nodes.`,
    "Each node must include supporting evidence needs and counter-evidence needs."
  ].join("\n");
}

export function buildEvidencePlanPrompt(tree: HypothesisTreeArtifact): string {
  return [
    jsonOnly("EvidencePlanOutput"),
    `Root question: ${tree.rootQuestion}`,
    `Nodes: ${tree.nodes.map((node) => `${node.id}: ${node.claim}`).join("; ")}`,
    "For each node, produce research questions and preferred source types."
  ].join("\n");
}

export function buildEvidenceResearchPrompt(plan: EvidencePlanArtifact): string {
  return [
    jsonOnly("EvidenceResearchOutput"),
    `Evidence plan: ${JSON.stringify(plan)}`,
    "Return evidence cards with provenanceStatus set to verified, model-reported, or unavailable.",
    "Do not invent a URL. If the source cannot be verified, use provenanceStatus unavailable or model-reported."
  ].join("\n");
}

export function buildSynthesisPrompt(input: {
  frame: TaskFrameArtifact;
  tree: HypothesisTreeArtifact;
  evidence: AgentEvidenceCard[];
  scored: ScoredNodesArtifact;
}): string {
  return [
    jsonOnly("SynthesisOutput"),
    `Task frame: ${JSON.stringify(input.frame)}`,
    `Hypothesis tree: ${JSON.stringify(input.tree)}`,
    `Evidence cards: ${JSON.stringify(input.evidence)}`,
    `Scored nodes: ${JSON.stringify(input.scored)}`,
    "Use research-assistance language. Do not give personalized investment advice."
  ].join("\n");
}
```

- [ ] **Step 3: Implement client**

Create `src/lib/agent/miromindClient.ts`:

```ts
import type { ZodSchema } from "zod";

type FetchImpl = typeof fetch;

interface CreateMiroMindStageClientOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetchImpl?: FetchImpl;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export function parseAssistantJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export function createMiroMindStageClient(options: CreateMiroMindStageClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;

  async function requestContent(prompt: string): Promise<string> {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        stream: false,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`MiroMind request failed with status ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("MiroMind response did not include assistant content.");
    }
    return content;
  }

  return {
    async completeJson<T>(stageName: string, prompt: string, schema: ZodSchema<T>): Promise<T> {
      const firstContent = await requestContent(prompt);
      try {
        return schema.parse(parseAssistantJson(firstContent));
      } catch {
        const repairPrompt = [
          "Repair the previous response so it is valid JSON only.",
          `Stage: ${stageName}`,
          "Do not add markdown.",
          "Original prompt:",
          prompt,
          "Invalid response:",
          firstContent
        ].join("\n");
        const repairedContent = await requestContent(repairPrompt);
        return schema.parse(parseAssistantJson(repairedContent));
      }
    }
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- src/lib/agent/miromindClient.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/prompts.ts src/lib/agent/miromindClient.ts src/lib/agent/miromindClient.test.ts
git commit -m "feat: add miromind stage client"
```

## Task 5: Score Generated Evidence

**Files:**
- Create: `src/lib/agent/scoring.ts`
- Create: `src/lib/agent/scoring.test.ts`

- [ ] **Step 1: Write failing scoring tests**

Create `src/lib/agent/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scoreAgentEvidence } from "./scoring";
import type { AgentEvidenceCard, HypothesisTreeArtifact } from "./types";

const tree: HypothesisTreeArtifact = {
  type: "hypothesis-tree",
  rootQuestion: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
  nodes: [
    {
      id: "demand",
      label: "Demand Sustainability",
      claim: "AI demand remains durable.",
      whyItMatters: "Demand drives revenue assumptions.",
      weight: 0.5,
      evidenceNeeded: ["AI demand"],
      counterEvidenceNeeded: ["Demand slowdown"]
    }
  ]
};

const evidence: AgentEvidenceCard[] = [
  {
    id: "ev-1",
    nodeId: "demand",
    sourceTitle: "NVIDIA results",
    sourceType: "earnings",
    sourceDate: "2026-02-25",
    urlOrReference: "https://investor.nvidia.com/",
    provenanceStatus: "model-reported",
    quotedSnippet: "Demand remained strong.",
    extractedFact: "AI demand remained strong.",
    direction: "supports",
    reasoningImpact: "Supports demand durability."
  },
  {
    id: "ev-2",
    nodeId: "demand",
    sourceTitle: "Customer concentration concern",
    sourceType: "news",
    sourceDate: "2026-01-10",
    urlOrReference: "Analyst commentary",
    provenanceStatus: "model-reported",
    quotedSnippet: "Large customers may pause orders.",
    extractedFact: "Order timing may become uneven.",
    direction: "refutes",
    reasoningImpact: "Complicates demand durability."
  }
];

describe("scoreAgentEvidence", () => {
  it("scores generated evidence and produces node conclusions", () => {
    const scored = scoreAgentEvidence(tree, evidence);

    expect(scored.type).toBe("scored-nodes");
    expect(scored.nodes[0].label).toBe("Demand Sustainability");
    expect(scored.nodes[0].supportingEvidenceIds).toEqual(["ev-1"]);
    expect(scored.nodes[0].counterEvidenceIds).toEqual(["ev-2"]);
    expect(scored.finalStance).toBeDefined();
  });
});
```

- [ ] **Step 2: Implement scoring**

Create `src/lib/agent/scoring.ts`:

```ts
import type {
  AgentEvidenceCard,
  Confidence,
  EvidenceDirection,
  EvidenceProvenanceStatus,
  FinalStance,
  HypothesisTreeArtifact,
  NodeStance,
  ScoredNodesArtifact
} from "./types";

const directionScore: Record<EvidenceDirection, number> = {
  supports: 1,
  complicates: -0.25,
  refutes: -1
};

const provenanceScore: Record<EvidenceProvenanceStatus, number> = {
  verified: 1,
  "model-reported": 0.75,
  unavailable: 0.35
};

export function scoreAgentEvidence(
  tree: HypothesisTreeArtifact,
  evidence: AgentEvidenceCard[]
): ScoredNodesArtifact {
  const nodes = tree.nodes.map((node) => {
    const nodeEvidence = evidence.filter((card) => card.nodeId === node.id);
    const rawScore = nodeEvidence.reduce((sum, card) => {
      const reliability = card.reliabilityScore ?? provenanceScore[card.provenanceStatus];
      const relevance = card.relevanceScore ?? 0.8;
      const freshness = card.freshnessScore ?? 0.75;
      return sum + directionScore[card.direction] * reliability * relevance * freshness;
    }, 0);
    const weightedScore = Number((rawScore * node.weight).toFixed(2));
    const supportingEvidenceIds = nodeEvidence
      .filter((card) => card.direction === "supports")
      .map((card) => card.id);
    const counterEvidenceIds = nodeEvidence
      .filter((card) => card.direction === "refutes" || card.direction === "complicates")
      .map((card) => card.id);

    return {
      id: node.id,
      label: node.label,
      claim: node.claim,
      weight: node.weight,
      stance: stanceForScore(weightedScore),
      confidence: confidenceForEvidence(nodeEvidence.length),
      weightedScore,
      reasoningNote: `Scored ${nodeEvidence.length} evidence cards for ${node.label}.`,
      whatWouldChange: node.counterEvidenceNeeded.join("; "),
      supportingEvidenceIds,
      counterEvidenceIds
    };
  });

  const finalScore = Number(nodes.reduce((sum, node) => sum + node.weightedScore, 0).toFixed(2));

  return {
    type: "scored-nodes",
    nodes,
    finalScore,
    finalStance: finalStanceForScore(finalScore),
    confidence: confidenceForEvidence(evidence.length)
  };
}

function stanceForScore(score: number): NodeStance {
  if (score >= 0.5) return "supports";
  if (score > 0) return "weakly-supports";
  if (score === 0) return "mixed";
  if (score > -0.5) return "weakly-refutes";
  return "refutes";
}

function finalStanceForScore(score: number): FinalStance {
  if (score >= 1.2) return "Supported";
  if (score >= 0.25) return "Partially Supported";
  if (score > -0.25) return "Inconclusive";
  if (score > -1.2) return "Weakly Unsupported";
  return "Not Supported";
}

function confidenceForEvidence(count: number): Confidence {
  if (count >= 10) return "High";
  if (count >= 6) return "Medium-High";
  if (count >= 2) return "Medium";
  return "Low";
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- src/lib/agent/scoring.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/scoring.ts src/lib/agent/scoring.test.ts
git commit -m "feat: score generated agent evidence"
```

## Task 6: Add Curated Fallback Adapter

**Files:**
- Create: `src/lib/agent/fallback.ts`
- Create: `src/lib/agent/fallback.test.ts`

- [ ] **Step 1: Write failing fallback tests**

Create `src/lib/agent/fallback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createFallbackRun, isCuratedFallbackEligible } from "./fallback";
import type { AgentRequest } from "./types";

const nvdaRequest: AgentRequest = {
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

describe("fallback", () => {
  it("allows curated NVIDIA fallback", () => {
    expect(isCuratedFallbackEligible(nvdaRequest)).toBe(true);
    const run = createFallbackRun("run-1", nvdaRequest);
    expect(run.mode).toBe("demo-fallback");
    expect(run.artifacts.map((artifact) => artifact.type)).toEqual([
      "task-frame",
      "hypothesis-tree",
      "evidence-cards",
      "scored-nodes",
      "memo"
    ]);
  });

  it("rejects non-curated fallback tasks", () => {
    const request = {
      ...nvdaRequest,
      security: { ...nvdaRequest.security, ticker: "PLTR", name: "Palantir Technologies Inc." }
    };

    expect(isCuratedFallbackEligible(request)).toBe(false);
    expect(() => createFallbackRun("run-1", request)).toThrow("No curated fallback");
  });
});
```

- [ ] **Step 2: Implement fallback adapter**

Create `src/lib/agent/fallback.ts`:

```ts
import { createFixtureArtifacts } from "@/data/fixtures";
import { scoreResearchArtifacts } from "@/lib/scoring";
import type { ResearchTask } from "@/lib/types";
import type {
  AgentEvidenceCard,
  AgentRequest,
  AgentRun,
  EvidenceCardsArtifact,
  HypothesisTreeArtifact,
  MemoArtifact,
  ScoredNodesArtifact,
  TaskFrameArtifact
} from "./types";

const nvdaFixtureTask: ResearchTask = {
  companyId: "nvda",
  questionTemplateId: "valuation-growth",
  timeHorizon: "12M",
  evidencePreference: "balanced"
};

export function isCuratedFallbackEligible(request: AgentRequest): boolean {
  const question = request.question.toLowerCase();
  return (
    request.security.ticker === "NVDA" &&
    request.timeHorizon === "12M" &&
    question.includes("valuation") &&
    question.includes("growth")
  );
}

export function createFallbackRun(runId: string, request: AgentRequest): AgentRun {
  if (!isCuratedFallbackEligible(request)) {
    throw new Error("No curated fallback exists for this selected security and question.");
  }

  const artifacts = createFixtureArtifacts(nvdaFixtureTask);
  const scored = scoreResearchArtifacts(artifacts.nodes, artifacts.evidence);
  const taskFrame: TaskFrameArtifact = {
    type: "task-frame",
    securityName: request.security.name,
    ticker: request.security.ticker,
    sectorFrame: "AI accelerators and data center platforms",
    rootQuestion: artifacts.rootQuestion,
    researchObjective: "Assess whether AI growth fundamentals support NVIDIA's valuation.",
    decisionCriteria: ["Revenue growth", "Margin durability", "Demand sustainability", "Valuation sensitivity"],
    evidenceCategories: ["Earnings", "Market data", "Industry commentary"],
    safetyNote: "Research assistance only, not personalized investment advice."
  };
  const hypothesisTree: HypothesisTreeArtifact = {
    type: "hypothesis-tree",
    rootQuestion: artifacts.rootQuestion,
    nodes: artifacts.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      claim: node.claim,
      whyItMatters: node.reasoningNote,
      weight: node.weight,
      evidenceNeeded: ["Supporting public evidence tied to this hypothesis."],
      counterEvidenceNeeded: [node.whatWouldChange]
    }))
  };
  const evidenceCards: AgentEvidenceCard[] = artifacts.evidence.map((card) => ({
    id: card.id,
    nodeId: card.claimNodeId,
    sourceTitle: card.sourceTitle,
    sourceType: card.sourceType === "earnings-call" ? "earnings" : card.sourceType,
    sourceDate: card.sourceDate,
    urlOrReference: card.urlOrReference,
    provenanceStatus: "model-reported",
    quotedSnippet: card.quotedSnippet,
    extractedFact: card.extractedFact,
    direction: card.direction,
    reasoningImpact: card.reasoningImpact,
    reliabilityScore: card.reliabilityScore,
    relevanceScore: card.relevanceScore,
    freshnessScore: card.freshnessScore
  }));
  const evidenceArtifact: EvidenceCardsArtifact = {
    type: "evidence-cards",
    evidenceCards
  };
  const scoredNodes: ScoredNodesArtifact = {
    type: "scored-nodes",
    nodes: scored.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      claim: node.claim,
      weight: node.weight,
      stance: node.stance,
      confidence: node.confidence,
      weightedScore: node.weightedScore,
      reasoningNote: node.reasoningNote,
      whatWouldChange: node.whatWouldChange,
      supportingEvidenceIds: node.supportingEvidence.map((card) => card.id),
      counterEvidenceIds: node.counterEvidence.map((card) => card.id)
    })),
    finalScore: scored.memo.finalScore,
    finalStance: scored.memo.finalStance,
    confidence: scored.memo.confidence
  };
  const memo: MemoArtifact = {
    type: "memo",
    ...scored.memo
  };

  return {
    runId,
    mode: "demo-fallback",
    request,
    phases: [
      "Task Framing",
      "Hypothesis Generation",
      "Evidence Planning",
      "Evidence Research",
      "Evidence Scoring",
      "Reasoning Synthesis",
      "Memo Rendering"
    ].map((name) => ({
      name: name as AgentRun["phases"][number]["name"],
      status: "complete",
      detail: "Loaded curated fallback artifacts because live MiroMind was unavailable."
    })),
    artifacts: [taskFrame, hypothesisTree, evidenceArtifact, scoredNodes, memo],
    taskFrame,
    hypothesisTree,
    evidenceCards,
    scoredNodes,
    memo
  };
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- src/lib/agent/fallback.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/fallback.ts src/lib/agent/fallback.test.ts
git commit -m "feat: add honest curated fallback"
```

## Task 7: Orchestrate Streaming Agent Runs

**Files:**
- Create: `src/lib/agent/runAgent.ts`
- Create: `src/lib/agent/runAgent.test.ts`

- [ ] **Step 1: Write failing orchestration tests**

Create `src/lib/agent/runAgent.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { runAgent } from "./runAgent";
import type { AgentRequest } from "./types";

const request: AgentRequest = {
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

describe("runAgent", () => {
  it("streams live events in order", async () => {
    const stageClient = {
      completeJson: vi
        .fn()
        .mockResolvedValueOnce({
          securityName: "NVIDIA Corporation",
          ticker: "NVDA",
          sectorFrame: "AI accelerators",
          rootQuestion: request.question,
          researchObjective: "Assess valuation support.",
          decisionCriteria: ["Revenue durability"],
          evidenceCategories: ["Earnings"],
          safetyNote: "Research assistance only."
        })
        .mockResolvedValueOnce({
          rootQuestion: request.question,
          nodes: [
            {
              id: "demand",
              label: "Demand Sustainability",
              claim: "AI demand remains durable.",
              whyItMatters: "Demand supports valuation.",
              weight: 1,
              evidenceNeeded: ["Demand evidence"],
              counterEvidenceNeeded: ["Slowdown evidence"]
            },
            {
              id: "margin",
              label: "Margin Durability",
              claim: "Margins remain resilient.",
              whyItMatters: "Margins support earnings.",
              weight: 1,
              evidenceNeeded: ["Margin evidence"],
              counterEvidenceNeeded: ["Margin pressure"]
            },
            {
              id: "moat",
              label: "Competitive Moat",
              claim: "Moat remains strong.",
              whyItMatters: "Moat supports growth quality.",
              weight: 1,
              evidenceNeeded: ["Moat evidence"],
              counterEvidenceNeeded: ["Competition"]
            },
            {
              id: "valuation",
              label: "Valuation Sensitivity",
              claim: "Valuation is sensitive to assumptions.",
              whyItMatters: "Sensitivity defines risk.",
              weight: 1,
              evidenceNeeded: ["Valuation evidence"],
              counterEvidenceNeeded: ["Multiple compression"]
            }
          ]
        })
        .mockResolvedValueOnce({
          items: [
            {
              nodeId: "demand",
              researchQuestions: ["Is AI demand durable?"],
              preferredSourceTypes: ["earnings"],
              sourceCandidates: ["NVIDIA earnings"],
              supportingSignals: ["Strong demand"],
              refutingSignals: ["Order slowdown"]
            }
          ]
        })
        .mockResolvedValueOnce({
          evidenceCards: [
            {
              id: "ev-1",
              nodeId: "demand",
              sourceTitle: "NVIDIA earnings",
              sourceType: "earnings",
              sourceDate: "2026-02-25",
              urlOrReference: "https://investor.nvidia.com/",
              provenanceStatus: "model-reported",
              quotedSnippet: "Demand strong.",
              extractedFact: "AI demand remains strong.",
              direction: "supports",
              reasoningImpact: "Supports demand."
            }
          ]
        })
        .mockResolvedValueOnce({
          executiveSummary: "The thesis is partially supported.",
          finalStance: "Partially Supported",
          confidence: "Medium",
          keyDrivers: ["Demand"],
          biggestCounterargument: "Valuation sensitivity.",
          whatWouldChangeTheView: ["Demand slowdown"],
          humanReviewChecklist: ["Verify filings"],
          sections: [
            {
              id: "demand",
              title: "Demand Sustainability",
              body: "Demand supports the thesis.",
              linkedNodeIds: ["demand"],
              linkedEvidenceIds: ["ev-1"]
            }
          ]
        })
    };

    const events = [];
    for await (const event of runAgent(request, { stageClient, runId: "run-live" })) {
      events.push(event);
    }

    expect(events[0]).toEqual({ type: "run-started", runId: "run-live", mode: "live-agent" });
    expect(events.some((event) => event.type === "artifact")).toBe(true);
    expect(events.at(-1)?.type).toBe("run-completed");
  });
});
```

- [ ] **Step 2: Implement orchestration**

Create `src/lib/agent/runAgent.ts`:

```ts
import {
  evidencePlanOutputSchema,
  evidenceResearchOutputSchema,
  hypothesisOutputSchema,
  synthesisOutputSchema,
  taskFrameOutputSchema
} from "./schemas";
import { scoreAgentEvidence } from "./scoring";
import {
  buildEvidencePlanPrompt,
  buildEvidenceResearchPrompt,
  buildHypothesisPrompt,
  buildSynthesisPrompt,
  buildTaskFramePrompt
} from "./prompts";
import type {
  AgentEvent,
  AgentRequest,
  AgentRun,
  EvidenceCardsArtifact,
  EvidencePlanArtifact,
  HypothesisTreeArtifact,
  MemoArtifact,
  TaskFrameArtifact
} from "./types";

interface StageClient {
  completeJson<T>(stageName: string, prompt: string, schema: { parse(value: unknown): T }): Promise<T>;
}

interface RunAgentOptions {
  stageClient: StageClient;
  runId: string;
}

export async function* runAgent(
  request: AgentRequest,
  options: RunAgentOptions
): AsyncGenerator<AgentEvent> {
  const artifacts = [];

  yield { type: "run-started", runId: options.runId, mode: "live-agent" };

  yield { type: "phase-started", phase: "Task Framing", detail: "Framing the selected security and research question." };
  const taskFrame = {
    type: "task-frame",
    ...(await options.stageClient.completeJson(
      "Task Framing",
      buildTaskFramePrompt(request),
      taskFrameOutputSchema
    ))
  } as TaskFrameArtifact;
  artifacts.push(taskFrame);
  yield { type: "artifact", artifact: taskFrame };
  yield { type: "phase-completed", phase: "Task Framing", detail: "Research task framed." };

  yield { type: "phase-started", phase: "Hypothesis Generation", detail: "Generating a hypothesis tree." };
  const hypothesisTree = {
    type: "hypothesis-tree",
    ...(await options.stageClient.completeJson(
      "Hypothesis Generation",
      buildHypothesisPrompt(taskFrame, request),
      hypothesisOutputSchema
    ))
  } as HypothesisTreeArtifact;
  artifacts.push(hypothesisTree);
  yield { type: "artifact", artifact: hypothesisTree };
  yield { type: "phase-completed", phase: "Hypothesis Generation", detail: "Hypothesis tree generated." };

  yield { type: "phase-started", phase: "Evidence Planning", detail: "Planning evidence collection." };
  const evidencePlan = {
    type: "evidence-plan",
    ...(await options.stageClient.completeJson(
      "Evidence Planning",
      buildEvidencePlanPrompt(hypothesisTree),
      evidencePlanOutputSchema
    ))
  } as EvidencePlanArtifact;
  artifacts.push(evidencePlan);
  yield { type: "artifact", artifact: evidencePlan };
  yield { type: "phase-completed", phase: "Evidence Planning", detail: "Evidence plan generated." };

  yield { type: "phase-started", phase: "Evidence Research", detail: "Researching supporting and counter evidence." };
  const evidenceArtifact = {
    type: "evidence-cards",
    ...(await options.stageClient.completeJson(
      "Evidence Research",
      buildEvidenceResearchPrompt(evidencePlan),
      evidenceResearchOutputSchema
    ))
  } as EvidenceCardsArtifact;
  artifacts.push(evidenceArtifact);
  yield { type: "artifact", artifact: evidenceArtifact };
  yield { type: "phase-completed", phase: "Evidence Research", detail: "Evidence cards generated." };

  yield { type: "phase-started", phase: "Evidence Scoring", detail: "Scoring evidence and node conclusions." };
  const scoredNodes = scoreAgentEvidence(hypothesisTree, evidenceArtifact.evidenceCards);
  artifacts.push(scoredNodes);
  yield { type: "artifact", artifact: scoredNodes };
  yield { type: "phase-completed", phase: "Evidence Scoring", detail: "Evidence scored." };

  yield { type: "phase-started", phase: "Reasoning Synthesis", detail: "Synthesizing the investment memo." };
  const synthesis = await options.stageClient.completeJson(
    "Reasoning Synthesis",
    buildSynthesisPrompt({
      frame: taskFrame,
      tree: hypothesisTree,
      evidence: evidenceArtifact.evidenceCards,
      scored: scoredNodes
    }),
    synthesisOutputSchema
  );
  const memo = {
    type: "memo",
    finalScore: scoredNodes.finalScore,
    ...synthesis
  } as MemoArtifact;
  artifacts.push(memo);
  yield { type: "artifact", artifact: memo };
  yield { type: "phase-completed", phase: "Reasoning Synthesis", detail: "Memo synthesized." };

  yield { type: "phase-started", phase: "Memo Rendering", detail: "Rendering the final memo." };
  yield { type: "phase-completed", phase: "Memo Rendering", detail: "Final memo ready." };

  const run: AgentRun = {
    runId: options.runId,
    mode: "live-agent",
    request,
    phases: [],
    artifacts,
    taskFrame,
    hypothesisTree,
    evidencePlan,
    evidenceCards: evidenceArtifact.evidenceCards,
    scoredNodes,
    memo
  };
  yield { type: "run-completed", run };
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- src/lib/agent/runAgent.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/runAgent.ts src/lib/agent/runAgent.test.ts
git commit -m "feat: orchestrate live agent runs"
```

## Task 8: Stream Research Run API

**Files:**
- Replace: `src/app/api/research/run/route.ts`
- Replace: `src/app/api/research/run/route.test.ts`

- [ ] **Step 1: Write route tests**

Replace `src/app/api/research/run/route.test.ts` with:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const originalKey = process.env.MIROMIND_API_KEY;

afterEach(() => {
  process.env.MIROMIND_API_KEY = originalKey;
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
});
```

- [ ] **Step 2: Implement streaming route**

Replace `src/app/api/research/run/route.ts` with:

```ts
import { createFallbackRun, isCuratedFallbackEligible } from "@/lib/agent/fallback";
import { createMiroMindStageClient } from "@/lib/agent/miromindClient";
import { runAgent } from "@/lib/agent/runAgent";
import { agentRequestSchema } from "@/lib/agent/schemas";
import type { AgentEvent, AgentRequest } from "@/lib/agent/types";

function encodeEvent(event: AgentEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request): Promise<Response> {
  const parsed = agentRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const agentRequest = parsed.data as AgentRequest;
  const apiKey = process.env.MIROMIND_API_KEY;
  const model = process.env.MIROMIND_MODEL ?? "gpt-oss-120b";
  const baseUrl = process.env.MIROMIND_BASE_URL ?? "https://api.miromind.ai/v1";
  const runId = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!apiKey) {
          if (!agentRequest.fallbackAllowed || !isCuratedFallbackEligible(agentRequest)) {
            controller.enqueue(
              encodeEvent({
                type: "run-failed",
                error: "A MiroMind API key is required for this non-curated research task.",
                fallbackAvailable: isCuratedFallbackEligible(agentRequest)
              })
            );
            controller.close();
            return;
          }

          const fallbackRun = createFallbackRun(runId, agentRequest);
          controller.enqueue(encodeEvent({ type: "run-started", runId, mode: "demo-fallback" }));
          for (const artifact of fallbackRun.artifacts) {
            controller.enqueue(encodeEvent({ type: "artifact", artifact }));
          }
          controller.enqueue(encodeEvent({ type: "run-completed", run: fallbackRun }));
          controller.close();
          return;
        }

        const stageClient = createMiroMindStageClient({ apiKey, model, baseUrl });
        for await (const event of runAgent(agentRequest, { stageClient, runId })) {
          controller.enqueue(encodeEvent(event));
        }
        controller.close();
      } catch (error) {
        controller.enqueue(
          encodeEvent({
            type: "run-failed",
            error: error instanceof Error ? error.message : "Research run failed.",
            fallbackAvailable: isCuratedFallbackEligible(agentRequest)
          })
        );
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}
```

- [ ] **Step 3: Run route tests**

Run:

```bash
npm run test -- src/app/api/research/run/route.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/research/run/route.ts src/app/api/research/run/route.test.ts
git commit -m "feat: stream research run events"
```

## Task 9: Add Client Stream Parser

**Files:**
- Create: `src/lib/agent/streamClient.ts`
- Create: `src/lib/agent/streamClient.test.ts`

- [ ] **Step 1: Write failing stream parser tests**

Create `src/lib/agent/streamClient.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseJsonLines } from "./streamClient";

describe("parseJsonLines", () => {
  it("parses chunked newline-delimited JSON", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("{\"type\":\"run-started\"}\n{\"type\":"));
        controller.enqueue(encoder.encode("\"run-completed\"}\n"));
        controller.close();
      }
    });

    const events = [];
    for await (const event of parseJsonLines(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "run-started" }, { type: "run-completed" }]);
  });
});
```

- [ ] **Step 2: Implement parser**

Create `src/lib/agent/streamClient.ts`:

```ts
export async function* parseJsonLines<T = unknown>(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim()) {
        yield JSON.parse(line) as T;
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    yield JSON.parse(buffer) as T;
  }
}
```

- [ ] **Step 3: Run parser tests**

Run:

```bash
npm run test -- src/lib/agent/streamClient.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/streamClient.ts src/lib/agent/streamClient.test.ts
git commit -m "feat: parse agent event streams"
```

## Task 10: Build Agent Input Panel

**Files:**
- Create: `src/components/AgentInputPanel.tsx`
- Create: `src/components/AgentInputPanel.test.tsx`

- [ ] **Step 1: Write component tests**

Create `src/components/AgentInputPanel.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentInputPanel } from "./AgentInputPanel";

describe("AgentInputPanel", () => {
  it("requires listed security selection and question before run", async () => {
    const onRun = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [
            {
              name: "NVIDIA Corporation",
              ticker: "NVDA",
              exchange: "NASDAQ",
              country: "US",
              assetType: "Equity"
            }
          ]
        })
      )
    );

    render(<AgentInputPanel isRunning={false} modeLabel="Live Agent" onRun={onRun} />);

    expect(screen.getByRole("button", { name: "Run Deep Research" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Company or ticker"), {
      target: { value: "nvda" }
    });
    await waitFor(() => expect(screen.getByText("NVIDIA Corporation")).toBeInTheDocument());
    fireEvent.click(screen.getByText("NVIDIA Corporation"));

    fireEvent.change(screen.getByLabelText("Research question"), {
      target: { value: "Is NVIDIA's current valuation justified by AI growth fundamentals?" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({
        security: expect.objectContaining({ ticker: "NVDA" }),
        researchDepth: "deep"
      })
    );
  });
});
```

- [ ] **Step 2: Implement component**

Create `src/components/AgentInputPanel.tsx`:

```tsx
"use client";

import type { AgentRequest, EvidencePreference, ListedSecurity, ResearchDepth, TimeHorizon } from "@/lib/agent/types";
import { useState } from "react";

interface AgentInputPanelProps {
  isRunning: boolean;
  modeLabel: "Live Agent" | "Demo Fallback" | "Error";
  onRun: (request: AgentRequest) => void;
}

const defaultQuestion = "Is NVIDIA's current valuation justified by AI growth fundamentals?";

export function AgentInputPanel({ isRunning, modeLabel, onRun }: AgentInputPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListedSecurity[]>([]);
  const [security, setSecurity] = useState<ListedSecurity | null>(null);
  const [question, setQuestion] = useState(defaultQuestion);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("12M");
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>("deep");
  const [evidencePreference, setEvidencePreference] = useState<EvidencePreference>("balanced");

  async function handleQuery(value: string) {
    setQuery(value);
    setSecurity(null);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const response = await fetch(`/api/securities/search?q=${encodeURIComponent(value)}`);
    const payload = (await response.json()) as { results: ListedSecurity[] };
    setResults(payload.results);
  }

  const canRun = Boolean(security) && question.trim().length > 0 && !isRunning;

  return (
    <section className="setup-panel" aria-label="Agent input">
      <div>
        <p className="eyebrow">Real Agent</p>
        <h1>ValuationLens</h1>
        <p className="lede">Ask a listed-company research question and watch the reasoning chain.</p>
        <span className="mode-pill">{modeLabel}</span>
      </div>

      <label>
        Company or ticker
        <input
          value={security ? `${security.name} (${security.ticker})` : query}
          onChange={(event) => handleQuery(event.target.value)}
          placeholder="Search NVIDIA or NVDA"
        />
      </label>

      {results.length > 0 ? (
        <div className="search-results" role="listbox">
          {results.map((item) => (
            <button
              key={item.ticker}
              type="button"
              onClick={() => {
                setSecurity(item);
                setResults([]);
              }}
            >
              <strong>{item.name}</strong>
              <span>{item.ticker} | {item.exchange} | {item.country} | {item.assetType}</span>
            </button>
          ))}
        </div>
      ) : null}

      <label>
        Research question
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
      </label>

      <label>
        Time horizon
        <select value={timeHorizon} onChange={(event) => setTimeHorizon(event.target.value as TimeHorizon)}>
          <option value="3M">3M</option>
          <option value="12M">12M</option>
          <option value="3Y">3Y</option>
        </select>
      </label>

      <label>
        Research depth
        <select value={researchDepth} onChange={(event) => setResearchDepth(event.target.value as ResearchDepth)}>
          <option value="deep">Deep Agent</option>
          <option value="fast">Fast Agent</option>
        </select>
      </label>

      <label>
        Evidence preference
        <select
          value={evidencePreference}
          onChange={(event) => setEvidencePreference(event.target.value as EvidencePreference)}
        >
          <option value="balanced">Balanced</option>
          <option value="financials">Financial statements first</option>
          <option value="earnings">Earnings calls first</option>
          <option value="news">News and events first</option>
        </select>
      </label>

      <button
        className="primary-action"
        disabled={!canRun}
        onClick={() =>
          security &&
          onRun({
            security,
            question: question.trim(),
            timeHorizon,
            researchDepth,
            evidencePreference,
            fallbackAllowed: true
          })
        }
        type="button"
      >
        {isRunning ? "Running Research" : "Run Deep Research"}
      </button>
    </section>
  );
}
```

- [ ] **Step 3: Run component tests**

Run:

```bash
npm run test -- src/components/AgentInputPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/AgentInputPanel.tsx src/components/AgentInputPanel.test.tsx
git commit -m "feat: add listed security input panel"
```

## Task 11: Build Live Research Workbench UI

**Files:**
- Create: `src/components/AgentRunTimeline.tsx`
- Create: `src/components/LiveResearchWorkbench.tsx`
- Create: `src/components/LiveResearchWorkbench.test.tsx`
- Delete: `src/components/ResearchWorkbench.tsx`
- Delete: `src/components/ResearchWorkbench.test.tsx`
- Modify: `src/components/HypothesisTree.tsx`
- Modify: `src/components/EvidencePanel.tsx`
- Modify: `src/components/InvestmentMemo.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write integration component test**

Create `src/components/LiveResearchWorkbench.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveResearchWorkbench } from "./LiveResearchWorkbench";

function streamFromLines(lines: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      }
      controller.close();
    }
  });
}

describe("LiveResearchWorkbench", () => {
  it("runs a streamed agent workflow and links memo trace to evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/research/status")) {
          return Response.json({ liveAvailable: true, model: "gpt-oss-120b", fallbackAvailable: true });
        }
        if (url.includes("/api/securities/search")) {
          return Response.json({
            results: [
              {
                name: "NVIDIA Corporation",
                ticker: "NVDA",
                exchange: "NASDAQ",
                country: "US",
                assetType: "Equity"
              }
            ]
          });
        }
        return new Response(
          streamFromLines([
            { type: "run-started", runId: "run-1", mode: "live-agent" },
            { type: "phase-started", phase: "Task Framing", detail: "Framing" },
            {
              type: "artifact",
              artifact: {
                type: "hypothesis-tree",
                rootQuestion: "Question",
                nodes: [
                  {
                    id: "demand",
                    label: "Demand Sustainability",
                    claim: "Demand remains strong.",
                    whyItMatters: "Demand matters.",
                    weight: 1,
                    evidenceNeeded: ["Demand"],
                    counterEvidenceNeeded: ["Slowdown"]
                  }
                ]
              }
            },
            {
              type: "artifact",
              artifact: {
                type: "evidence-cards",
                evidenceCards: [
                  {
                    id: "ev-1",
                    nodeId: "demand",
                    sourceTitle: "NVIDIA earnings",
                    sourceType: "earnings",
                    sourceDate: "2026-02-25",
                    urlOrReference: "https://investor.nvidia.com/",
                    provenanceStatus: "model-reported",
                    quotedSnippet: "Demand strong.",
                    extractedFact: "AI demand remains strong.",
                    direction: "supports",
                    reasoningImpact: "Supports demand."
                  }
                ]
              }
            },
            {
              type: "artifact",
              artifact: {
                type: "memo",
                executiveSummary: "Partially supported.",
                finalStance: "Partially Supported",
                confidence: "Medium",
                finalScore: 0.5,
                keyDrivers: ["Demand"],
                biggestCounterargument: "Valuation sensitivity.",
                whatWouldChangeTheView: ["Demand slowdown"],
                humanReviewChecklist: ["Verify sources"],
                sections: [
                  {
                    id: "demand",
                    title: "Demand Sustainability",
                    body: "Demand supports the thesis.",
                    linkedNodeIds: ["demand"],
                    linkedEvidenceIds: ["ev-1"]
                  }
                ]
              }
            },
            { type: "run-completed", run: { runId: "run-1", mode: "live-agent", phases: [], artifacts: [] } }
          ]),
          { headers: { "Content-Type": "application/x-ndjson" } }
        );
      })
    );

    render(<LiveResearchWorkbench />);

    fireEvent.change(await screen.findByLabelText("Company or ticker"), {
      target: { value: "nvda" }
    });
    await waitFor(() => expect(screen.getByText("NVIDIA Corporation")).toBeInTheDocument());
    fireEvent.click(screen.getByText("NVIDIA Corporation"));
    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));

    expect(await screen.findByText("Partially Supported")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Demand Sustainability/ }));

    const evidencePanel = screen.getByRole("region", { name: "Evidence cards" });
    expect(within(evidencePanel).getByText("NVIDIA earnings")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement live timeline**

Create `src/components/AgentRunTimeline.tsx`:

```tsx
import type { AgentPhase } from "@/lib/agent/types";

interface AgentRunTimelineProps {
  phases: AgentPhase[];
}

export function AgentRunTimeline({ phases }: AgentRunTimelineProps) {
  return (
    <section className="timeline" aria-label="Agent run timeline">
      {phases.map((phase, index) => (
        <article className={`timeline-step ${phase.status}`} key={`${phase.name}-${index}`}>
          <span className="step-index">{index + 1}</span>
          <div>
            <h3>{phase.name}</h3>
            <p>{phase.detail}</p>
            <small>{phase.status}</small>
          </div>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Implement LiveResearchWorkbench**

Create `src/components/LiveResearchWorkbench.tsx`:

```tsx
"use client";

import { parseJsonLines } from "@/lib/agent/streamClient";
import type {
  AgentEvent,
  AgentPhase,
  AgentRequest,
  EvidenceCardsArtifact,
  HypothesisTreeArtifact,
  MemoArtifact
} from "@/lib/agent/types";
import { useEffect, useState } from "react";
import { AgentInputPanel } from "./AgentInputPanel";
import { AgentRunTimeline } from "./AgentRunTimeline";
import { EvidencePanel } from "./EvidencePanel";
import { HypothesisTree } from "./HypothesisTree";
import { InvestmentMemo } from "./InvestmentMemo";

const phaseNames: AgentPhase["name"][] = [
  "Task Framing",
  "Hypothesis Generation",
  "Evidence Planning",
  "Evidence Research",
  "Evidence Scoring",
  "Reasoning Synthesis",
  "Memo Rendering"
];

function initialPhases(): AgentPhase[] {
  return phaseNames.map((name) => ({ name, status: "queued", detail: "Waiting to run." }));
}

export function LiveResearchWorkbench() {
  const [modeLabel, setModeLabel] = useState<"Live Agent" | "Demo Fallback" | "Error">("Demo Fallback");
  const [isRunning, setIsRunning] = useState(false);
  const [phases, setPhases] = useState<AgentPhase[]>(initialPhases);
  const [tree, setTree] = useState<HypothesisTreeArtifact | null>(null);
  const [evidence, setEvidence] = useState<EvidenceCardsArtifact | null>(null);
  const [memo, setMemo] = useState<MemoArtifact | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/research/status")
      .then((response) => response.json())
      .then((status: { liveAvailable: boolean }) => {
        setModeLabel(status.liveAvailable ? "Live Agent" : "Demo Fallback");
      })
      .catch(() => setModeLabel("Error"));
  }, []);

  function updatePhase(name: AgentPhase["name"], status: AgentPhase["status"], detail: string) {
    setPhases((current) =>
      current.map((phase) => (phase.name === name ? { ...phase, status, detail } : phase))
    );
  }

  async function handleRun(request: AgentRequest) {
    setIsRunning(true);
    setError(null);
    setTree(null);
    setEvidence(null);
    setMemo(null);
    setSelectedNodeId(null);
    setHighlightedNodeIds([]);
    setPhases(initialPhases());

    const response = await fetch("/api/research/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });

    if (!response.body) {
      setError("Research run did not return a stream.");
      setIsRunning(false);
      return;
    }

    for await (const event of parseJsonLines<AgentEvent>(response.body)) {
      if (event.type === "run-started") {
        setModeLabel(event.mode === "live-agent" ? "Live Agent" : "Demo Fallback");
      }
      if (event.type === "phase-started") {
        updatePhase(event.phase, "running", event.detail);
      }
      if (event.type === "phase-completed") {
        updatePhase(event.phase, "complete", event.detail);
      }
      if (event.type === "phase-failed") {
        updatePhase(event.phase, "failed", event.error);
      }
      if (event.type === "artifact") {
        if (event.artifact.type === "hypothesis-tree") {
          setTree(event.artifact);
          setSelectedNodeId(event.artifact.nodes[0]?.id ?? null);
        }
        if (event.artifact.type === "evidence-cards") {
          setEvidence(event.artifact);
        }
        if (event.artifact.type === "memo") {
          setMemo(event.artifact);
        }
      }
      if (event.type === "run-failed") {
        setError(event.error);
      }
    }

    setIsRunning(false);
  }

  const visibleEvidence = evidence?.evidenceCards ?? [];

  return (
    <main className="app-shell">
      <AgentInputPanel isRunning={isRunning} modeLabel={modeLabel} onRun={handleRun} />
      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">MiroMind Deep Research</p>
            <h2>{tree?.rootQuestion ?? "Run a listed-company research question"}</h2>
          </div>
          <span className="mode-pill">{modeLabel}</span>
        </div>
        {error ? <div className="error-panel">{error}</div> : null}
        <AgentRunTimeline phases={phases} />
        {memo ? (
          <InvestmentMemo
            memo={memo}
            onSectionSelect={(nodeIds) => {
              setHighlightedNodeIds(nodeIds);
              setSelectedNodeId(nodeIds[0] ?? null);
            }}
          />
        ) : null}
      </section>
      <aside className="trace-column">
        <HypothesisTree
          nodes={tree?.nodes ?? []}
          selectedNodeId={selectedNodeId}
          highlightedNodeIds={highlightedNodeIds}
          onSelectNode={setSelectedNodeId}
        />
        <EvidencePanel
          selectedNodeId={selectedNodeId}
          nodes={tree?.nodes ?? []}
          evidence={visibleEvidence}
        />
      </aside>
    </main>
  );
}
```

- [ ] **Step 4: Adapt dependent components**

Modify `src/components/HypothesisTree.tsx`, `src/components/EvidencePanel.tsx`, and `src/components/InvestmentMemo.tsx` to use the agent types from `src/lib/agent/types.ts`. Preserve their existing CSS class names: `.tree-node`, `.evidence-panel`, `.evidence-card`, `.memo-panel`, and `.trace-button`.

Use these prop contracts:

```ts
// HypothesisTree.tsx
interface HypothesisTreeProps {
  nodes: HypothesisNodeDraft[];
  selectedNodeId: string | null;
  highlightedNodeIds: string[];
  onSelectNode: (nodeId: string) => void;
}

// EvidencePanel.tsx
interface EvidencePanelProps {
  selectedNodeId: string | null;
  nodes: HypothesisNodeDraft[];
  evidence: AgentEvidenceCard[];
}

// InvestmentMemo.tsx
interface InvestmentMemoProps {
  memo: MemoArtifact;
  onSectionSelect: (nodeIds: string[]) => void;
}
```

- [ ] **Step 5: Render live workbench**

Modify `src/app/page.tsx`:

```tsx
import { LiveResearchWorkbench } from "@/components/LiveResearchWorkbench";

export default function Home() {
  return <LiveResearchWorkbench />;
}
```

- [ ] **Step 6: Add CSS for new controls**

Modify `src/app/globals.css` by adding:

```css
input,
textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--ink);
  font: inherit;
  padding: 10px 12px;
}

textarea {
  min-height: 96px;
  resize: vertical;
}

.search-results {
  border: 1px solid var(--line);
  border-radius: 8px;
  display: grid;
  gap: 4px;
  padding: 6px;
}

.search-results button {
  background: #fff;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  display: grid;
  gap: 4px;
  padding: 10px;
  text-align: left;
}

.search-results span,
.timeline-step small {
  color: var(--muted);
  font-size: 12px;
}

.timeline-step.running .step-index {
  background: #eef5ff;
  color: var(--blue);
}

.timeline-step.failed .step-index,
.error-panel {
  background: #fff2f0;
  color: var(--red);
}

.error-panel {
  border: 1px solid #fecdca;
  border-radius: 8px;
  margin: 12px 0;
  padding: 12px;
}
```

- [ ] **Step 7: Run UI tests**

Run:

```bash
npm run test -- src/components/AgentInputPanel.test.tsx src/components/LiveResearchWorkbench.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A src/components/AgentRunTimeline.tsx src/components/LiveResearchWorkbench.tsx src/components/LiveResearchWorkbench.test.tsx src/components/ResearchWorkbench.tsx src/components/ResearchWorkbench.test.tsx src/components/AgentInputPanel.tsx src/components/AgentInputPanel.test.tsx src/components/HypothesisTree.tsx src/components/EvidencePanel.tsx src/components/InvestmentMemo.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: build live agent workbench"
```

## Task 12: Update Documentation And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/demo-script.md`

- [ ] **Step 1: Update README**

Modify `README.md` to include:

````md
## Live Agent Setup

Create `.env.local`:

```bash
MIROMIND_API_KEY=your_key_here
MIROMIND_MODEL=gpt-oss-120b
MIROMIND_BASE_URL=https://api.miromind.ai/v1
```

When `MIROMIND_API_KEY` is present, ValuationLens runs in Live Agent mode and streams MiroMind-backed research stages. Without the key, the app only uses clearly labeled Demo Fallback mode for curated demo tasks.

## Primary Demo

Use NVIDIA Corporation (NVDA, NASDAQ) with:

> Is NVIDIA's current valuation justified by AI growth fundamentals?

Use Micron Technology (MU, NASDAQ) as a secondary demo to show that the agent flow is not hard-coded to NVIDIA.
````

- [ ] **Step 2: Update demo script**

Modify `docs/demo-script.md` so the first 45 seconds show:

```md
Search for `NVIDIA` or `NVDA`, select `NVIDIA Corporation | NVDA | NASDAQ | US | Equity`, then run the question:

> Is NVIDIA's current valuation justified by AI growth fundamentals?

Point out that the company is selected from a listed-security dropdown, so the agent does not guess the ticker.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run test
npm run check
npm run build
```

Expected:

- `npm run test`: PASS.
- `npm run check`: PASS.
- `npm run build`: PASS.

- [ ] **Step 4: Browser verification**

Start the app:

```bash
npm run dev
```

Verify in Browser:

- Search `NVDA`.
- Dropdown shows `NVIDIA Corporation | NVDA | NASDAQ | US | Equity`.
- `Run Deep Research` is disabled before selecting a security or entering a question.
- Selecting NVIDIA and running the question starts a stream.
- The UI shows at least four phase transitions before completion.
- `Live Agent` appears when `MIROMIND_API_KEY` is configured.
- Missing-key mode shows `Demo Fallback`.
- Clicking a memo trace selects the related node and evidence card.
- Mobile viewport stacks without horizontal overflow.

- [ ] **Step 5: Stop dev server and inspect git status**

Run:

```bash
git status --short
```

Expected: clean after final commit.

- [ ] **Step 6: Commit docs**

```bash
git add README.md docs/demo-script.md
git commit -m "docs: document real agent workflow"
```
