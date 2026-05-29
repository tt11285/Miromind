# ValuationLens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ValuationLens, a transparent financial research demo that turns stock research questions into auditable hypothesis trees, evidence cards, and investment memos.

**Architecture:** Use a Next.js TypeScript app with a server API route for MiroMind calls, a pure TypeScript research pipeline for deterministic demo behavior, and focused React components for the three-column workbench. The NVIDIA golden path runs from curated evidence so the demo is stable; the MiroMind adapter can augment reasoning when credentials are present.

**Tech Stack:** Next.js, React, TypeScript, Vitest, React Testing Library, zod, lucide-react, native fetch against the MiroMind OpenAI-compatible chat completions endpoint.

---

## Scope Check

The approved spec is one integrated MVP: research setup, evidence model, scoring pipeline, MiroMind adapter, API route, and UI. These pieces should be built as one vertical slice because the demo value comes from the end-to-end trace from user task to final memo.

## File Structure

Create this structure under `/Users/tang/Documents/Miromind`:

- `package.json`: npm scripts and dependencies.
- `tsconfig.json`: strict TypeScript configuration with `@/*` path alias.
- `next.config.mjs`: minimal Next.js config.
- `vitest.config.ts`: Vitest and React test configuration.
- `src/test/setup.ts`: Testing Library setup.
- `src/lib/types.ts`: shared domain types.
- `src/lib/researchConfig.ts`: supported companies and question templates.
- `src/data/fixtures.ts`: curated nodes and evidence for all supported companies, with the full NVIDIA golden path.
- `src/lib/scoring.ts`: node score aggregation and final stance mapping.
- `src/lib/orchestrator.ts`: six-stage research workflow and audit trail creation.
- `src/lib/miromindClient.ts`: MiroMind API client and JSON response parser.
- `src/lib/apiSchemas.ts`: request validation and task normalization.
- `src/app/api/research/run/route.ts`: server route for running research.
- `src/app/layout.tsx`: app shell.
- `src/app/page.tsx`: workbench page.
- `src/app/globals.css`: complete visual styling.
- `src/components/ResearchWorkbench.tsx`: stateful page controller.
- `src/components/ResearchSetup.tsx`: company and question controls.
- `src/components/RunTimeline.tsx`: six-stage status display.
- `src/components/InvestmentMemo.tsx`: final memo display.
- `src/components/HypothesisTree.tsx`: expandable hypothesis nodes.
- `src/components/EvidencePanel.tsx`: selected evidence details.
- `README.md`: product, setup, architecture, and limits.
- `docs/demo-script.md`: three-minute recording script.
- `src/lib/*.test.ts`, `src/app/api/research/run/route.test.ts`, `src/components/ResearchWorkbench.test.tsx`: focused tests.

## Task 1: Scaffold Project, Types, And Supported Research Config

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/lib/types.ts`
- Create: `src/lib/researchConfig.ts`
- Test: `src/lib/researchConfig.test.ts`

- [ ] **Step 1: Create package and test configuration**

Write `package.json`:

```json
{
  "name": "valuationlens",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "tsc --noEmit && vitest run"
  },
  "dependencies": {
    "lucide-react": "^0.468.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Write `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

Write `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

Write `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `node_modules` and `package-lock.json` are created.

- [ ] **Step 3: Write the failing config test**

Write `src/lib/researchConfig.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the config test and verify it fails**

Run:

```bash
npm run test -- src/lib/researchConfig.test.ts
```

Expected: FAIL because `src/lib/researchConfig.ts` does not exist.

- [ ] **Step 5: Create shared types and research config**

Write `src/lib/types.ts`:

```ts
export type CompanyId = "nvda" | "msft" | "mu" | "tsla";

export type QuestionTemplateId =
  | "valuation-growth"
  | "downside-risk"
  | "bull-bear"
  | "earnings-thesis";

export type TimeHorizon = "3M" | "12M" | "3Y";
export type EvidencePreference =
  | "balanced"
  | "financials"
  | "earnings"
  | "news";

export type EvidenceDirection = "supports" | "refutes" | "complicates";

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

export interface Company {
  id: CompanyId;
  name: string;
  ticker: string;
  sectorFrame: string;
  researchLens: string;
}

export interface QuestionTemplate {
  id: QuestionTemplateId;
  title: string;
  rootQuestion: string;
  nodeLabels: string[];
}

export interface ResearchTask {
  companyId: CompanyId;
  questionTemplateId: QuestionTemplateId;
  timeHorizon: TimeHorizon;
  evidencePreference: EvidencePreference;
}

export interface EvidenceCard {
  id: string;
  companyId: CompanyId;
  questionTemplateId: QuestionTemplateId;
  claimNodeId: string;
  sourceTitle: string;
  sourceType: "filing" | "earnings-call" | "market-data" | "news" | "industry";
  sourceDate: string;
  quotedSnippet: string;
  extractedFact: string;
  direction: EvidenceDirection;
  reliabilityScore: number;
  relevanceScore: number;
  freshnessScore: number;
  reasoningImpact: string;
  urlOrReference: string;
}

export interface HypothesisNode {
  id: string;
  label: string;
  claim: string;
  weight: number;
  stance: NodeStance;
  confidence: Confidence;
  weightedScore: number;
  reasoningNote: string;
  whatWouldChange: string;
}

export interface NodeConclusion extends HypothesisNode {
  supportingEvidence: EvidenceCard[];
  counterEvidence: EvidenceCard[];
}

export interface MemoSection {
  id: string;
  title: string;
  body: string;
  linkedNodeIds: string[];
  linkedEvidenceIds: string[];
}

export interface InvestmentMemo {
  executiveSummary: string;
  finalStance: FinalStance;
  confidence: Confidence;
  finalScore: number;
  keyDrivers: string[];
  biggestCounterargument: string;
  whatWouldChangeTheView: string[];
  humanReviewChecklist: string[];
  sections: MemoSection[];
}

export type RunPhaseName =
  | "Task Framing"
  | "Hypothesis Generation"
  | "Evidence Collection"
  | "Evidence Scoring"
  | "Reasoning Synthesis"
  | "Memo Rendering";

export interface RunPhase {
  name: RunPhaseName;
  status: "complete" | "running" | "queued" | "failed";
  detail: string;
}

export interface ResearchRun {
  task: ResearchTask;
  rootQuestion: string;
  phases: RunPhase[];
  nodes: NodeConclusion[];
  evidence: EvidenceCard[];
  memo: InvestmentMemo;
  mode: "fixture" | "miromind-augmented";
}
```

Write `src/lib/researchConfig.ts`:

```ts
import type {
  Company,
  CompanyId,
  QuestionTemplate,
  QuestionTemplateId,
  ResearchTask
} from "./types";

export const companies: Company[] = [
  {
    id: "nvda",
    name: "NVIDIA",
    ticker: "NVDA",
    sectorFrame: "AI accelerators and data center platforms",
    researchLens: "AI data center demand, Blackwell ramp, CUDA moat, hyperscaler capex"
  },
  {
    id: "msft",
    name: "Microsoft",
    ticker: "MSFT",
    sectorFrame: "enterprise software and cloud AI infrastructure",
    researchLens: "Azure AI growth, Copilot monetization, OpenAI dependency, enterprise adoption"
  },
  {
    id: "mu",
    name: "Micron",
    ticker: "MU",
    sectorFrame: "memory semiconductors and AI infrastructure supply chain",
    researchLens: "HBM demand, DRAM/NAND pricing cycle, AI memory attach rate, supply discipline"
  },
  {
    id: "tsla",
    name: "Tesla",
    ticker: "TSLA",
    sectorFrame: "electric vehicles, autonomy, and energy systems",
    researchLens: "EV demand, gross margin, China competition, FSD and robotaxi optionality"
  }
];

export const questionTemplates: QuestionTemplate[] = [
  {
    id: "valuation-growth",
    title: "Is the current valuation justified by growth fundamentals?",
    rootQuestion: "Is the current valuation justified by growth fundamentals?",
    nodeLabels: [
      "Revenue Growth",
      "Margin Durability",
      "Demand Sustainability",
      "Competitive Moat",
      "Valuation Sensitivity"
    ]
  },
  {
    id: "downside-risk",
    title: "What is the most material downside risk over the next 12 months?",
    rootQuestion: "What is the most material downside risk over the next 12 months?",
    nodeLabels: [
      "Demand Risk",
      "Margin Risk",
      "Execution Risk",
      "Competitive Risk",
      "Macro or Regulatory Risk"
    ]
  },
  {
    id: "bull-bear",
    title: "Where do bull and bear theses diverge most?",
    rootQuestion: "Where do bull and bear theses diverge most?",
    nodeLabels: [
      "Growth Assumption Gap",
      "Margin Assumption Gap",
      "Market Size Gap",
      "Competition Gap",
      "Valuation Gap"
    ]
  },
  {
    id: "earnings-thesis",
    title: "Did the latest earnings change the investment thesis?",
    rootQuestion: "Did the latest earnings change the investment thesis?",
    nodeLabels: [
      "Revenue Surprise",
      "Guidance Change",
      "Margin Trend",
      "Segment Momentum",
      "Management Tone"
    ]
  }
];

export const defaultResearchTask: ResearchTask = {
  companyId: "nvda",
  questionTemplateId: "valuation-growth",
  timeHorizon: "12M",
  evidencePreference: "balanced"
};

export function getCompany(companyId: CompanyId): Company {
  const company = companies.find((item) => item.id === companyId);
  if (!company) {
    throw new Error(`Unsupported company id: ${companyId}`);
  }
  return company;
}

export function getQuestionTemplate(templateId: QuestionTemplateId): QuestionTemplate {
  const template = questionTemplates.find((item) => item.id === templateId);
  if (!template) {
    throw new Error(`Unsupported question template id: ${templateId}`);
  }
  return template;
}
```

- [ ] **Step 6: Run the config test and verify it passes**

Run:

```bash
npm run test -- src/lib/researchConfig.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs vitest.config.ts src/test/setup.ts src/lib/types.ts src/lib/researchConfig.ts src/lib/researchConfig.test.ts
git commit -m "feat: scaffold valuationlens config"
```

## Task 2: Add Curated Evidence Fixtures

**Files:**
- Create: `src/data/fixtures.ts`
- Test: `src/data/fixtures.test.ts`

- [ ] **Step 1: Write the failing fixture test**

Write `src/data/fixtures.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createFixtureArtifacts } from "./fixtures";
import { defaultResearchTask } from "@/lib/researchConfig";

describe("fixture artifacts", () => {
  it("builds a complete NVIDIA golden path", () => {
    const artifacts = createFixtureArtifacts(defaultResearchTask);
    expect(artifacts.nodes).toHaveLength(5);
    expect(artifacts.evidence.length).toBeGreaterThanOrEqual(10);
    expect(artifacts.nodes.map((node) => node.label)).toEqual([
      "Revenue Growth",
      "Margin Durability",
      "Demand Sustainability",
      "Competitive Moat",
      "Valuation Sensitivity"
    ]);
    expect(artifacts.evidence.some((card) => card.direction === "refutes")).toBe(true);
  });

  it("builds lighter artifacts for every supported company and template", () => {
    const companyIds = ["nvda", "msft", "mu", "tsla"] as const;
    const templateIds = [
      "valuation-growth",
      "downside-risk",
      "bull-bear",
      "earnings-thesis"
    ] as const;

    for (const companyId of companyIds) {
      for (const questionTemplateId of templateIds) {
        const artifacts = createFixtureArtifacts({
          companyId,
          questionTemplateId,
          timeHorizon: "12M",
          evidencePreference: "balanced"
        });
        expect(artifacts.nodes).toHaveLength(5);
        expect(artifacts.evidence.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
```

- [ ] **Step 2: Run the fixture test and verify it fails**

Run:

```bash
npm run test -- src/data/fixtures.test.ts
```

Expected: FAIL because `src/data/fixtures.ts` does not exist.

- [ ] **Step 3: Implement fixtures**

Write `src/data/fixtures.ts`:

```ts
import { getCompany, getQuestionTemplate } from "@/lib/researchConfig";
import type {
  CompanyId,
  EvidenceCard,
  EvidenceDirection,
  HypothesisNode,
  QuestionTemplateId,
  ResearchTask
} from "@/lib/types";

interface FixtureArtifacts {
  rootQuestion: string;
  nodes: HypothesisNode[];
  evidence: EvidenceCard[];
}

const valuationWeights = [0.2, 0.15, 0.25, 0.2, 0.2];

const defaultWeights = [0.22, 0.18, 0.2, 0.2, 0.2];

function nodeId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeNode(label: string, index: number, claim: string): HypothesisNode {
  return {
    id: nodeId(label),
    label,
    claim,
    weight: valuationWeights[index] ?? defaultWeights[index] ?? 0.2,
    stance: "mixed",
    confidence: "Medium",
    weightedScore: 0,
    reasoningNote: "This node has balanced evidence and requires synthesis before a final stance is assigned.",
    whatWouldChange: "A fresh official filing, earnings call, or market data point that materially changes this node's evidence balance."
  };
}

function makeEvidence(input: {
  id: string;
  companyId: CompanyId;
  questionTemplateId: QuestionTemplateId;
  node: string;
  sourceTitle: string;
  sourceType: EvidenceCard["sourceType"];
  sourceDate: string;
  quotedSnippet: string;
  extractedFact: string;
  direction: EvidenceDirection;
  reliabilityScore: number;
  relevanceScore: number;
  freshnessScore: number;
  reasoningImpact: string;
  urlOrReference: string;
}): EvidenceCard {
  return {
    id: input.id,
    companyId: input.companyId,
    questionTemplateId: input.questionTemplateId,
    claimNodeId: nodeId(input.node),
    sourceTitle: input.sourceTitle,
    sourceType: input.sourceType,
    sourceDate: input.sourceDate,
    quotedSnippet: input.quotedSnippet,
    extractedFact: input.extractedFact,
    direction: input.direction,
    reliabilityScore: input.reliabilityScore,
    relevanceScore: input.relevanceScore,
    freshnessScore: input.freshnessScore,
    reasoningImpact: input.reasoningImpact,
    urlOrReference: input.urlOrReference
  };
}

function nvidiaValuationEvidence(): EvidenceCard[] {
  const companyId = "nvda";
  const questionTemplateId = "valuation-growth";

  return [
    makeEvidence({
      id: "nvda-rev-1",
      companyId,
      questionTemplateId,
      node: "Revenue Growth",
      sourceTitle: "NVIDIA earnings release",
      sourceType: "filing",
      sourceDate: "2026-02-26",
      quotedSnippet: "Data center revenue remained the dominant growth driver.",
      extractedFact: "NVIDIA's data center segment is the central contributor to recent revenue expansion.",
      direction: "supports",
      reliabilityScore: 0.95,
      relevanceScore: 0.95,
      freshnessScore: 0.9,
      reasoningImpact: "Strong segment growth supports the idea that valuation is linked to real AI infrastructure demand.",
      urlOrReference: "NVIDIA investor relations earnings materials"
    }),
    makeEvidence({
      id: "nvda-rev-2",
      companyId,
      questionTemplateId,
      node: "Revenue Growth",
      sourceTitle: "Management guidance commentary",
      sourceType: "earnings-call",
      sourceDate: "2026-02-26",
      quotedSnippet: "Management described continued demand across accelerated computing platforms.",
      extractedFact: "Guidance language indicates continued demand visibility.",
      direction: "supports",
      reliabilityScore: 0.9,
      relevanceScore: 0.9,
      freshnessScore: 0.9,
      reasoningImpact: "Management commentary supports continued growth but still depends on future conversion into revenue.",
      urlOrReference: "NVIDIA earnings call transcript"
    }),
    makeEvidence({
      id: "nvda-margin-1",
      companyId,
      questionTemplateId,
      node: "Margin Durability",
      sourceTitle: "NVIDIA gross margin trend",
      sourceType: "market-data",
      sourceDate: "2026-02-26",
      quotedSnippet: "Gross margins stayed high during the AI accelerator demand cycle.",
      extractedFact: "Recent margin strength suggests pricing power in AI accelerators.",
      direction: "supports",
      reliabilityScore: 0.85,
      relevanceScore: 0.88,
      freshnessScore: 0.86,
      reasoningImpact: "High margins support valuation, but margin durability must be tested against competition and mix shifts.",
      urlOrReference: "Curated financial metric snapshot"
    }),
    makeEvidence({
      id: "nvda-margin-2",
      companyId,
      questionTemplateId,
      node: "Margin Durability",
      sourceTitle: "Competitive pricing risk note",
      sourceType: "industry",
      sourceDate: "2026-03-10",
      quotedSnippet: "Competitors and customer-owned accelerators may increase pricing pressure over time.",
      extractedFact: "Future margin pressure is plausible if alternatives become viable at scale.",
      direction: "refutes",
      reliabilityScore: 0.74,
      relevanceScore: 0.85,
      freshnessScore: 0.82,
      reasoningImpact: "This limits confidence that current margins can be extrapolated unchanged.",
      urlOrReference: "Curated industry risk brief"
    }),
    makeEvidence({
      id: "nvda-demand-1",
      companyId,
      questionTemplateId,
      node: "Demand Sustainability",
      sourceTitle: "Hyperscaler capex tracker",
      sourceType: "industry",
      sourceDate: "2026-03-15",
      quotedSnippet: "Major cloud providers continued to prioritize AI infrastructure spending.",
      extractedFact: "Cloud capex remains an important demand signal for NVIDIA accelerators.",
      direction: "supports",
      reliabilityScore: 0.82,
      relevanceScore: 0.94,
      freshnessScore: 0.87,
      reasoningImpact: "Cloud capex supports demand sustainability because hyperscalers are the largest AI infrastructure buyers.",
      urlOrReference: "Curated hyperscaler capex summary"
    }),
    makeEvidence({
      id: "nvda-demand-2",
      companyId,
      questionTemplateId,
      node: "Demand Sustainability",
      sourceTitle: "AI monetization caution",
      sourceType: "news",
      sourceDate: "2026-03-20",
      quotedSnippet: "Investors continue to debate whether AI application revenue will justify infrastructure spend.",
      extractedFact: "The return on AI infrastructure spending is still being tested.",
      direction: "refutes",
      reliabilityScore: 0.72,
      relevanceScore: 0.89,
      freshnessScore: 0.88,
      reasoningImpact: "If AI monetization lags, demand could normalize faster than valuation assumes.",
      urlOrReference: "Curated market debate summary"
    }),
    makeEvidence({
      id: "nvda-moat-1",
      companyId,
      questionTemplateId,
      node: "Competitive Moat",
      sourceTitle: "CUDA ecosystem summary",
      sourceType: "industry",
      sourceDate: "2026-01-18",
      quotedSnippet: "NVIDIA's software ecosystem remains a major switching cost.",
      extractedFact: "CUDA and the developer ecosystem strengthen NVIDIA's competitive position.",
      direction: "supports",
      reliabilityScore: 0.8,
      relevanceScore: 0.9,
      freshnessScore: 0.78,
      reasoningImpact: "Software lock-in makes competitive displacement harder than hardware comparisons alone imply.",
      urlOrReference: "Curated ecosystem analysis"
    }),
    makeEvidence({
      id: "nvda-moat-2",
      companyId,
      questionTemplateId,
      node: "Competitive Moat",
      sourceTitle: "ASIC and in-house accelerator risk brief",
      sourceType: "industry",
      sourceDate: "2026-03-22",
      quotedSnippet: "Large cloud customers continue investing in custom AI silicon.",
      extractedFact: "Customer-owned chips may cap long-term pricing power in some workloads.",
      direction: "refutes",
      reliabilityScore: 0.78,
      relevanceScore: 0.86,
      freshnessScore: 0.88,
      reasoningImpact: "Custom silicon does not erase NVIDIA demand, but it narrows the margin of safety in valuation assumptions.",
      urlOrReference: "Curated AI silicon competition brief"
    }),
    makeEvidence({
      id: "nvda-val-1",
      companyId,
      questionTemplateId,
      node: "Valuation Sensitivity",
      sourceTitle: "Forward multiple snapshot",
      sourceType: "market-data",
      sourceDate: "2026-03-25",
      quotedSnippet: "NVIDIA continues to trade at a premium to most large-cap semiconductor peers.",
      extractedFact: "The market is pricing in sustained exceptional growth and profitability.",
      direction: "refutes",
      reliabilityScore: 0.82,
      relevanceScore: 0.95,
      freshnessScore: 0.88,
      reasoningImpact: "A premium multiple reduces tolerance for demand or margin disappointment.",
      urlOrReference: "Curated valuation snapshot"
    }),
    makeEvidence({
      id: "nvda-val-2",
      companyId,
      questionTemplateId,
      node: "Valuation Sensitivity",
      sourceTitle: "Growth-adjusted valuation note",
      sourceType: "market-data",
      sourceDate: "2026-03-25",
      quotedSnippet: "High growth can justify a premium multiple when demand visibility and margins remain strong.",
      extractedFact: "The valuation can be partly supported if growth and margins persist.",
      direction: "supports",
      reliabilityScore: 0.78,
      relevanceScore: 0.88,
      freshnessScore: 0.86,
      reasoningImpact: "The valuation is not detached from fundamentals, but it is sensitive to execution and demand assumptions.",
      urlOrReference: "Curated valuation sensitivity note"
    })
  ];
}

function genericEvidence(task: ResearchTask): EvidenceCard[] {
  const company = getCompany(task.companyId);
  const template = getQuestionTemplate(task.questionTemplateId);
  const firstNode = template.nodeLabels[0];
  const thirdNode = template.nodeLabels[2];
  const fifthNode = template.nodeLabels[4];

  return [
    makeEvidence({
      id: `${task.companyId}-${task.questionTemplateId}-support-1`,
      companyId: task.companyId,
      questionTemplateId: task.questionTemplateId,
      node: firstNode,
      sourceTitle: `${company.name} official materials snapshot`,
      sourceType: "filing",
      sourceDate: "2026-03-01",
      quotedSnippet: `${company.name} continues to report metrics tied to ${company.researchLens}.`,
      extractedFact: `${company.name}'s core research lens is relevant to ${template.title}.`,
      direction: "supports",
      reliabilityScore: 0.82,
      relevanceScore: 0.84,
      freshnessScore: 0.82,
      reasoningImpact: "Official company materials provide the baseline for this node.",
      urlOrReference: `${company.ticker} curated official materials`
    }),
    makeEvidence({
      id: `${task.companyId}-${task.questionTemplateId}-counter-1`,
      companyId: task.companyId,
      questionTemplateId: task.questionTemplateId,
      node: thirdNode,
      sourceTitle: `${company.name} risk monitor`,
      sourceType: "industry",
      sourceDate: "2026-03-08",
      quotedSnippet: `Market debate remains active around ${company.researchLens}.`,
      extractedFact: `The investment thesis has material uncertainty around ${company.researchLens}.`,
      direction: "complicates",
      reliabilityScore: 0.72,
      relevanceScore: 0.78,
      freshnessScore: 0.8,
      reasoningImpact: "This evidence lowers confidence and forces the memo to show uncertainty.",
      urlOrReference: `${company.ticker} curated risk monitor`
    }),
    makeEvidence({
      id: `${task.companyId}-${task.questionTemplateId}-valuation-1`,
      companyId: task.companyId,
      questionTemplateId: task.questionTemplateId,
      node: fifthNode,
      sourceTitle: `${company.name} market snapshot`,
      sourceType: "market-data",
      sourceDate: "2026-03-15",
      quotedSnippet: `The market price reflects expectations for ${company.sectorFrame}.`,
      extractedFact: `Valuation and expectation risk must be included in the final conclusion.`,
      direction: "refutes",
      reliabilityScore: 0.75,
      relevanceScore: 0.8,
      freshnessScore: 0.8,
      reasoningImpact: "Market expectations can make a fundamentally sound thesis less attractive if too much is priced in.",
      urlOrReference: `${company.ticker} curated market snapshot`
    })
  ];
}

export function createFixtureArtifacts(task: ResearchTask): FixtureArtifacts {
  const company = getCompany(task.companyId);
  const template = getQuestionTemplate(task.questionTemplateId);
  const evidence =
    task.companyId === "nvda" && task.questionTemplateId === "valuation-growth"
      ? nvidiaValuationEvidence()
      : genericEvidence(task);

  const nodes = template.nodeLabels.map((label, index) =>
    makeNode(
      label,
      index,
      `${label} is evaluated for ${company.name} through the lens of ${company.researchLens}.`
    )
  );

  return {
    rootQuestion:
      task.companyId === "nvda" && task.questionTemplateId === "valuation-growth"
        ? "Is NVIDIA's current valuation justified by AI growth fundamentals?"
        : template.rootQuestion,
    nodes,
    evidence
  };
}
```

- [ ] **Step 4: Run fixture tests and verify they pass**

Run:

```bash
npm run test -- src/data/fixtures.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/fixtures.ts src/data/fixtures.test.ts
git commit -m "feat: add curated research fixtures"
```

## Task 3: Implement Scoring And Final Stance Aggregation

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts`

- [ ] **Step 1: Write the failing scoring test**

Write `src/lib/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createFixtureArtifacts } from "@/data/fixtures";
import { defaultResearchTask } from "./researchConfig";
import { scoreResearchArtifacts, scoreToFinalStance } from "./scoring";

describe("research scoring", () => {
  it("maps weighted scores to final stance labels", () => {
    expect(scoreToFinalStance(1.4)).toBe("Supported");
    expect(scoreToFinalStance(0.7)).toBe("Partially Supported");
    expect(scoreToFinalStance(0)).toBe("Inconclusive");
    expect(scoreToFinalStance(-0.7)).toBe("Weakly Unsupported");
    expect(scoreToFinalStance(-1.4)).toBe("Not Supported");
  });

  it("scores the NVIDIA golden path as partially supported", () => {
    const artifacts = createFixtureArtifacts(defaultResearchTask);
    const scored = scoreResearchArtifacts(artifacts.nodes, artifacts.evidence);
    expect(scored.memo.finalStance).toBe("Partially Supported");
    expect(scored.memo.confidence).toBe("Medium-High");
    expect(scored.nodes).toHaveLength(5);
    expect(scored.nodes.find((node) => node.id === "valuation-sensitivity")?.stance).toBe(
      "weakly-refutes"
    );
  });
});
```

- [ ] **Step 2: Run scoring test and verify it fails**

Run:

```bash
npm run test -- src/lib/scoring.test.ts
```

Expected: FAIL because `src/lib/scoring.ts` does not exist.

- [ ] **Step 3: Implement scoring**

Write `src/lib/scoring.ts`:

```ts
import type {
  Confidence,
  EvidenceCard,
  FinalStance,
  HypothesisNode,
  InvestmentMemo,
  NodeConclusion,
  NodeStance
} from "./types";

function directionValue(card: EvidenceCard): number {
  if (card.direction === "supports") return 1;
  if (card.direction === "refutes") return -1;
  return -0.2;
}

function evidenceWeight(card: EvidenceCard): number {
  return (card.reliabilityScore * 0.4 + card.relevanceScore * 0.4 + card.freshnessScore * 0.2);
}

function clampScore(score: number): number {
  return Math.max(-2, Math.min(2, score));
}

function nodeStance(score: number): NodeStance {
  if (score >= 1.1) return "supports";
  if (score >= 0.3) return "weakly-supports";
  if (score <= -1.1) return "refutes";
  if (score <= -0.3) return "weakly-refutes";
  return "mixed";
}

function confidenceFor(cards: EvidenceCard[], score: number): Confidence {
  if (cards.length === 0) return "Low";
  const averageReliability =
    cards.reduce((sum, card) => sum + card.reliabilityScore, 0) / cards.length;
  const hasConflict =
    cards.some((card) => card.direction === "supports") &&
    cards.some((card) => card.direction === "refutes");
  if (averageReliability > 0.82 && Math.abs(score) > 0.6 && !hasConflict) return "High";
  if (averageReliability > 0.76 && Math.abs(score) > 0.25) return "Medium-High";
  if (averageReliability > 0.65) return "Medium";
  return "Low";
}

export function scoreToFinalStance(score: number): FinalStance {
  if (score >= 1.2) return "Supported";
  if (score >= 0.3) return "Partially Supported";
  if (score <= -1.2) return "Not Supported";
  if (score <= -0.3) return "Weakly Unsupported";
  return "Inconclusive";
}

function finalConfidence(nodes: NodeConclusion[], finalScore: number): Confidence {
  const lowConfidenceCount = nodes.filter((node) => node.confidence === "Low").length;
  const mixedCount = nodes.filter((node) => node.stance === "mixed").length;
  if (lowConfidenceCount > 1) return "Medium";
  if (mixedCount > 1 || Math.abs(finalScore) < 0.5) return "Medium";
  return "Medium-High";
}

export function scoreResearchArtifacts(
  nodes: HypothesisNode[],
  evidence: EvidenceCard[]
): { nodes: NodeConclusion[]; memo: InvestmentMemo } {
  const scoredNodes = nodes.map((node) => {
    const cards = evidence.filter((card) => card.claimNodeId === node.id);
    const rawScore = cards.reduce(
      (sum, card) => sum + directionValue(card) * evidenceWeight(card),
      0
    );
    const normalizedScore = clampScore(rawScore);
    const supportingEvidence = cards.filter((card) => card.direction === "supports");
    const counterEvidence = cards.filter((card) => card.direction !== "supports");

    return {
      ...node,
      stance: nodeStance(normalizedScore),
      confidence: confidenceFor(cards, normalizedScore),
      weightedScore: Number(normalizedScore.toFixed(2)),
      supportingEvidence,
      counterEvidence,
      reasoningNote:
        cards.length === 0
          ? `${node.label} has no evidence in the current run, so confidence remains low.`
          : `${node.label} is based on ${supportingEvidence.length} supporting card(s) and ${counterEvidence.length} counter or complicating card(s).`,
      whatWouldChange:
        counterEvidence.length > 0
          ? `Fresh evidence that weakens the counter-case around ${node.label}.`
          : `Fresh counter-evidence that challenges the current ${node.label} stance.`
    };
  });

  const finalScore = Number(
    scoredNodes.reduce((sum, node) => sum + node.weight * node.weightedScore, 0).toFixed(2)
  );
  const finalStance = scoreToFinalStance(finalScore);
  const confidence = finalConfidence(scoredNodes, finalScore);
  const evidenceIds = evidence.map((card) => card.id);

  const memo: InvestmentMemo = {
    executiveSummary:
      finalStance === "Partially Supported"
        ? "The growth case provides meaningful valuation support, but the conclusion depends on sustained demand, margin durability, and limited competitive pressure."
        : "The research run produced a stance by aggregating node-level evidence and counter-evidence.",
    finalStance,
    confidence,
    finalScore,
    keyDrivers: scoredNodes
      .filter((node) => node.stance === "supports" || node.stance === "weakly-supports")
      .slice(0, 3)
      .map((node) => node.label),
    biggestCounterargument:
      "The valuation already prices in strong execution, so demand or margin disappointment can compress the final score quickly.",
    whatWouldChangeTheView: [
      "A material slowdown in customer AI infrastructure spending.",
      "Evidence that custom silicon is taking meaningful share in core workloads.",
      "A margin reset that makes current profitability less durable."
    ],
    humanReviewChecklist: [
      "Verify the latest official filing and earnings call date.",
      "Check whether market multiples have moved since the curated snapshot.",
      "Review whether new customer capex guidance changes the demand node."
    ],
    sections: [
      {
        id: "final-stance",
        title: "Final Stance",
        body: `${finalStance} with ${confidence} confidence and a weighted score of ${finalScore}.`,
        linkedNodeIds: scoredNodes.map((node) => node.id),
        linkedEvidenceIds: evidenceIds
      },
      {
        id: "counterargument",
        title: "Biggest Counterargument",
        body: "The strongest counterargument is valuation sensitivity rather than absence of growth.",
        linkedNodeIds: ["valuation-sensitivity"],
        linkedEvidenceIds: evidence
          .filter((card) => card.claimNodeId === "valuation-sensitivity")
          .map((card) => card.id)
      }
    ]
  };

  return { nodes: scoredNodes, memo };
}
```

- [ ] **Step 4: Run scoring tests and verify they pass**

Run:

```bash
npm run test -- src/lib/scoring.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat: score research evidence"
```

## Task 4: Implement Six-Stage Research Orchestrator

**Files:**
- Create: `src/lib/orchestrator.ts`
- Test: `src/lib/orchestrator.test.ts`

- [ ] **Step 1: Write the failing orchestrator test**

Write `src/lib/orchestrator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultResearchTask } from "./researchConfig";
import { runResearch } from "./orchestrator";

describe("research orchestrator", () => {
  it("returns a complete six-stage research run", async () => {
    const run = await runResearch(defaultResearchTask);
    expect(run.mode).toBe("fixture");
    expect(run.phases.map((phase) => phase.name)).toEqual([
      "Task Framing",
      "Hypothesis Generation",
      "Evidence Collection",
      "Evidence Scoring",
      "Reasoning Synthesis",
      "Memo Rendering"
    ]);
    expect(run.phases.every((phase) => phase.status === "complete")).toBe(true);
    expect(run.nodes).toHaveLength(5);
    expect(run.memo.finalStance).toBe("Partially Supported");
  });

  it("uses an optional reasoner note when provided", async () => {
    const run = await runResearch(defaultResearchTask, {
      reasoner: async () => ({
        summary: "MiroMind confirms that valuation sensitivity is the key caveat."
      })
    });
    expect(run.mode).toBe("miromind-augmented");
    expect(run.memo.sections[0].body).toContain("MiroMind confirms");
  });
});
```

- [ ] **Step 2: Run orchestrator test and verify it fails**

Run:

```bash
npm run test -- src/lib/orchestrator.test.ts
```

Expected: FAIL because `src/lib/orchestrator.ts` does not exist.

- [ ] **Step 3: Implement orchestrator**

Write `src/lib/orchestrator.ts`:

```ts
import { createFixtureArtifacts } from "@/data/fixtures";
import { getCompany, getQuestionTemplate } from "./researchConfig";
import { scoreResearchArtifacts } from "./scoring";
import type { ResearchRun, ResearchTask, RunPhase } from "./types";

export type ResearchReasoner = (input: {
  task: ResearchTask;
  rootQuestion: string;
  nodeLabels: string[];
}) => Promise<{ summary: string }>;

const phaseDetails: RunPhase[] = [
  {
    name: "Task Framing",
    status: "complete",
    detail: "Normalized the company, question template, time horizon, and evidence preference."
  },
  {
    name: "Hypothesis Generation",
    status: "complete",
    detail: "Built a five-node hypothesis tree for the selected research question."
  },
  {
    name: "Evidence Collection",
    status: "complete",
    detail: "Retrieved curated evidence cards and mapped each card to a hypothesis node."
  },
  {
    name: "Evidence Scoring",
    status: "complete",
    detail: "Scored reliability, relevance, freshness, and evidence direction."
  },
  {
    name: "Reasoning Synthesis",
    status: "complete",
    detail: "Synthesized node-level conclusions from supporting and counter-evidence."
  },
  {
    name: "Memo Rendering",
    status: "complete",
    detail: "Rendered the final investment memo from traceable structured artifacts."
  }
];

export async function runResearch(
  task: ResearchTask,
  options: { reasoner?: ResearchReasoner } = {}
): Promise<ResearchRun> {
  const company = getCompany(task.companyId);
  const template = getQuestionTemplate(task.questionTemplateId);
  const artifacts = createFixtureArtifacts(task);
  const scored = scoreResearchArtifacts(artifacts.nodes, artifacts.evidence);
  let mode: ResearchRun["mode"] = "fixture";

  if (options.reasoner) {
    const note = await options.reasoner({
      task,
      rootQuestion: artifacts.rootQuestion,
      nodeLabels: artifacts.nodes.map((node) => node.label)
    });
    mode = "miromind-augmented";
    scored.memo.sections[0] = {
      ...scored.memo.sections[0],
      body: `${scored.memo.sections[0].body} ${note.summary}`
    };
  }

  return {
    task,
    rootQuestion:
      task.companyId === "nvda" && task.questionTemplateId === "valuation-growth"
        ? artifacts.rootQuestion
        : `${template.rootQuestion} (${company.name}, ${task.timeHorizon})`,
    phases: phaseDetails,
    nodes: scored.nodes,
    evidence: artifacts.evidence,
    memo: scored.memo,
    mode
  };
}
```

- [ ] **Step 4: Run orchestrator tests and verify they pass**

Run:

```bash
npm run test -- src/lib/orchestrator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/orchestrator.ts src/lib/orchestrator.test.ts
git commit -m "feat: orchestrate research pipeline"
```

## Task 5: Add MiroMind API Client

**Files:**
- Create: `src/lib/miromindClient.ts`
- Test: `src/lib/miromindClient.test.ts`

- [ ] **Step 1: Write the failing MiroMind client test**

Write `src/lib/miromindClient.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createMiroMindReasoner, parseJsonFromAssistantText } from "./miromindClient";
import { defaultResearchTask } from "./researchConfig";

describe("MiroMind client", () => {
  it("parses plain JSON and fenced JSON", () => {
    expect(parseJsonFromAssistantText('{"summary":"ok"}')).toEqual({ summary: "ok" });
    expect(parseJsonFromAssistantText('```json\n{"summary":"ok"}\n```')).toEqual({
      summary: "ok"
    });
  });

  it("calls the OpenAI-compatible chat completions endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"summary":"MiroMind reasoning note"}'
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const reasoner = createMiroMindReasoner({
      apiKey: "test-key",
      model: "gpt-oss-120b",
      fetchImpl: fetchMock
    });

    const result = await reasoner({
      task: defaultResearchTask,
      rootQuestion: "Is NVIDIA's current valuation justified by AI growth fundamentals?",
      nodeLabels: ["Revenue Growth"]
    });

    expect(result.summary).toBe("MiroMind reasoning note");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.miromind.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key"
        })
      })
    );
  });
});
```

- [ ] **Step 2: Run MiroMind client test and verify it fails**

Run:

```bash
npm run test -- src/lib/miromindClient.test.ts
```

Expected: FAIL because `src/lib/miromindClient.ts` does not exist.

- [ ] **Step 3: Implement the client**

Write `src/lib/miromindClient.ts`:

```ts
import type { ResearchReasoner } from "./orchestrator";

type FetchLike = typeof fetch;

interface MiroMindClientOptions {
  apiKey: string;
  model: string;
  fetchImpl?: FetchLike;
}

interface MiroMindChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export function parseJsonFromAssistantText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const jsonText = fenced ? fenced[1] : trimmed;
  return JSON.parse(jsonText);
}

function buildPrompt(input: Parameters<ResearchReasoner>[0]): string {
  return [
    "You are helping produce a transparent financial research trace.",
    "Return only JSON with this shape: {\"summary\":\"one concise reasoning note\"}.",
    `Root question: ${input.rootQuestion}`,
    `Company id: ${input.task.companyId}`,
    `Question template id: ${input.task.questionTemplateId}`,
    `Node labels: ${input.nodeLabels.join(", ")}`,
    "Focus on how the conclusion should remain auditable through evidence, counter-evidence, and node-level synthesis."
  ].join("\n");
}

export function createMiroMindReasoner(options: MiroMindClientOptions): ResearchReasoner {
  return async (input) => {
    const response = await (options.fetchImpl ?? fetch)(
      "https://api.miromind.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: options.model,
          stream: false,
          messages: [
            {
              role: "user",
              content: buildPrompt(input)
            }
          ]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`MiroMind request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as MiroMindChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("MiroMind response did not include assistant content");
    }

    const parsed = parseJsonFromAssistantText(content);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("summary" in parsed) ||
      typeof (parsed as { summary: unknown }).summary !== "string"
    ) {
      throw new Error("MiroMind response JSON did not include a string summary");
    }

    return { summary: (parsed as { summary: string }).summary };
  };
}
```

- [ ] **Step 4: Run MiroMind client tests and verify they pass**

Run:

```bash
npm run test -- src/lib/miromindClient.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/miromindClient.ts src/lib/miromindClient.test.ts
git commit -m "feat: add miromind client"
```

## Task 6: Add API Route And Request Validation

**Files:**
- Create: `src/lib/apiSchemas.ts`
- Create: `src/app/api/research/run/route.ts`
- Test: `src/app/api/research/run/route.test.ts`

- [ ] **Step 1: Write the failing API route test**

Write `src/app/api/research/run/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run API route test and verify it fails**

Run:

```bash
npm run test -- src/app/api/research/run/route.test.ts
```

Expected: FAIL because route files do not exist.

- [ ] **Step 3: Implement request schema**

Write `src/lib/apiSchemas.ts`:

```ts
import { z } from "zod";
import type { ResearchTask } from "./types";

export const researchTaskSchema = z.object({
  companyId: z.enum(["nvda", "msft", "mu", "tsla"]),
  questionTemplateId: z.enum([
    "valuation-growth",
    "downside-risk",
    "bull-bear",
    "earnings-thesis"
  ]),
  timeHorizon: z.enum(["3M", "12M", "3Y"]),
  evidencePreference: z.enum(["balanced", "financials", "earnings", "news"]),
  useMiroMind: z.boolean().optional()
});

export type ResearchTaskRequest = z.infer<typeof researchTaskSchema>;

export function parseResearchTask(input: unknown): {
  task: ResearchTask;
  useMiroMind: boolean;
} {
  const parsed = researchTaskSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid research task: ${parsed.error.issues[0]?.message ?? "bad input"}`);
  }

  return {
    task: {
      companyId: parsed.data.companyId,
      questionTemplateId: parsed.data.questionTemplateId,
      timeHorizon: parsed.data.timeHorizon,
      evidencePreference: parsed.data.evidencePreference
    },
    useMiroMind: parsed.data.useMiroMind ?? false
  };
}
```

- [ ] **Step 4: Implement API route**

Write `src/app/api/research/run/route.ts`:

```ts
import { parseResearchTask } from "@/lib/apiSchemas";
import { createMiroMindReasoner } from "@/lib/miromindClient";
import { runResearch } from "@/lib/orchestrator";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { task, useMiroMind } = parseResearchTask(body);
    const apiKey = process.env.MIROMIND_API_KEY;
    const model = process.env.MIROMIND_MODEL ?? "gpt-oss-120b";

    const run = await runResearch(task, {
      reasoner:
        useMiroMind && apiKey
          ? createMiroMindReasoner({
              apiKey,
              model
            })
          : undefined
    });

    return Response.json({ run });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to run research"
      },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 5: Run API route tests and verify they pass**

Run:

```bash
npm run test -- src/app/api/research/run/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/apiSchemas.ts src/app/api/research/run/route.ts src/app/api/research/run/route.test.ts
git commit -m "feat: add research api route"
```

## Task 7: Build The Three-Column Workbench UI

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/components/ResearchWorkbench.tsx`
- Create: `src/components/ResearchSetup.tsx`
- Create: `src/components/RunTimeline.tsx`
- Create: `src/components/InvestmentMemo.tsx`
- Create: `src/components/HypothesisTree.tsx`
- Create: `src/components/EvidencePanel.tsx`
- Test: `src/components/ResearchWorkbench.test.tsx`

- [ ] **Step 1: Write the failing UI test**

Write `src/components/ResearchWorkbench.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResearchWorkbench } from "./ResearchWorkbench";

describe("ResearchWorkbench", () => {
  it("renders the golden path memo and trace controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network disabled in this component test");
      })
    );

    render(<ResearchWorkbench />);

    expect(await screen.findByText("ValuationLens")).toBeInTheDocument();
    expect(screen.getByText("NVIDIA")).toBeInTheDocument();
    expect(screen.getByText("Partially Supported")).toBeInTheDocument();
    expect(screen.getByText("Hypothesis Tree")).toBeInTheDocument();
    expect(screen.getByText("Evidence Cards")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run UI test and verify it fails**

Run:

```bash
npm run test -- src/components/ResearchWorkbench.test.tsx
```

Expected: FAIL because component files do not exist.

- [ ] **Step 3: Create app shell**

Write `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ValuationLens",
  description: "Transparent financial research agent for auditable investment memos"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Write `src/app/page.tsx`:

```tsx
import { ResearchWorkbench } from "@/components/ResearchWorkbench";

export default function HomePage() {
  return <ResearchWorkbench />;
}
```

- [ ] **Step 4: Create presentational components**

Write `src/components/ResearchSetup.tsx`:

```tsx
"use client";

import { companies, questionTemplates } from "@/lib/researchConfig";
import type { EvidencePreference, ResearchTask, TimeHorizon } from "@/lib/types";

interface ResearchSetupProps {
  task: ResearchTask;
  isRunning: boolean;
  onTaskChange: (task: ResearchTask) => void;
  onRun: () => void;
}

const horizons: TimeHorizon[] = ["3M", "12M", "3Y"];
const preferences: Array<{ id: EvidencePreference; label: string }> = [
  { id: "balanced", label: "Balanced" },
  { id: "financials", label: "Financials" },
  { id: "earnings", label: "Earnings calls" },
  { id: "news", label: "News/events" }
];

export function ResearchSetup({ task, isRunning, onTaskChange, onRun }: ResearchSetupProps) {
  return (
    <section className="setup-panel" aria-label="Research setup">
      <div>
        <p className="eyebrow">Research Setup</p>
        <h1>ValuationLens</h1>
        <p className="lede">Turn a stock question into an auditable memo.</p>
      </div>

      <label>
        Company
        <select
          value={task.companyId}
          onChange={(event) =>
            onTaskChange({ ...task, companyId: event.target.value as ResearchTask["companyId"] })
          }
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Research Question
        <select
          value={task.questionTemplateId}
          onChange={(event) =>
            onTaskChange({
              ...task,
              questionTemplateId: event.target.value as ResearchTask["questionTemplateId"]
            })
          }
        >
          {questionTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
            </option>
          ))}
        </select>
      </label>

      <div className="segmented" aria-label="Time horizon">
        {horizons.map((horizon) => (
          <button
            key={horizon}
            className={task.timeHorizon === horizon ? "active" : ""}
            onClick={() => onTaskChange({ ...task, timeHorizon: horizon })}
            type="button"
          >
            {horizon}
          </button>
        ))}
      </div>

      <label>
        Evidence Preference
        <select
          value={task.evidencePreference}
          onChange={(event) =>
            onTaskChange({
              ...task,
              evidencePreference: event.target.value as EvidencePreference
            })
          }
        >
          {preferences.map((preference) => (
            <option key={preference.id} value={preference.id}>
              {preference.label}
            </option>
          ))}
        </select>
      </label>

      <button className="primary-action" disabled={isRunning} onClick={onRun} type="button">
        {isRunning ? "Running Research" : "Run Deep Research"}
      </button>
    </section>
  );
}
```

Write `src/components/RunTimeline.tsx`:

```tsx
import type { RunPhase } from "@/lib/types";

export function RunTimeline({ phases }: { phases: RunPhase[] }) {
  return (
    <section className="timeline" aria-label="Agent workflow">
      {phases.map((phase, index) => (
        <div className="timeline-step" key={phase.name}>
          <span className="step-index">{index + 1}</span>
          <div>
            <strong>{phase.name}</strong>
            <p>{phase.detail}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
```

Write `src/components/InvestmentMemo.tsx`:

```tsx
import type { InvestmentMemo } from "@/lib/types";

interface InvestmentMemoProps {
  memo: InvestmentMemo;
  onSectionSelect: (nodeIds: string[]) => void;
}

export function InvestmentMemo({ memo, onSectionSelect }: InvestmentMemoProps) {
  return (
    <section className="memo-panel" aria-label="Investment memo">
      <div className="memo-hero">
        <p className="eyebrow">Interactive Investment Memo</p>
        <h2>{memo.finalStance}</h2>
        <p>{memo.executiveSummary}</p>
        <div className="stance-row">
          <span>Confidence: {memo.confidence}</span>
          <span>Score: {memo.finalScore}</span>
        </div>
      </div>

      <div className="memo-grid">
        <article>
          <h3>Key Drivers</h3>
          <ul>
            {memo.keyDrivers.map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Biggest Counterargument</h3>
          <p>{memo.biggestCounterargument}</p>
        </article>
      </div>

      <article className="memo-section">
        <h3>What Would Change The View</h3>
        <ul>
          {memo.whatWouldChangeTheView.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="memo-section">
        <h3>Human Review Checklist</h3>
        <ul>
          {memo.humanReviewChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      {memo.sections.map((section) => (
        <button
          className="trace-button"
          key={section.id}
          onClick={() => onSectionSelect(section.linkedNodeIds)}
          type="button"
        >
          <span>{section.title}</span>
          <small>{section.body}</small>
        </button>
      ))}
    </section>
  );
}
```

Write `src/components/HypothesisTree.tsx`:

```tsx
import type { NodeConclusion } from "@/lib/types";

interface HypothesisTreeProps {
  nodes: NodeConclusion[];
  highlightedNodeIds: string[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function HypothesisTree({
  nodes,
  highlightedNodeIds,
  selectedNodeId,
  onSelectNode
}: HypothesisTreeProps) {
  return (
    <section className="tree-panel" aria-label="Hypothesis tree">
      <div className="panel-heading">
        <p className="eyebrow">Reasoning Trace</p>
        <h2>Hypothesis Tree</h2>
      </div>
      <div className="tree-list">
        {nodes.map((node) => (
          <button
            className={[
              "tree-node",
              selectedNodeId === node.id ? "selected" : "",
              highlightedNodeIds.includes(node.id) ? "highlighted" : ""
            ].join(" ")}
            key={node.id}
            onClick={() => onSelectNode(node.id)}
            type="button"
          >
            <span>{node.label}</span>
            <strong>{node.stance}</strong>
            <small>
              {node.confidence} confidence | {node.supportingEvidence.length} for |{" "}
              {node.counterEvidence.length} against
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
```

Write `src/components/EvidencePanel.tsx`:

```tsx
import type { EvidenceCard, NodeConclusion } from "@/lib/types";

interface EvidencePanelProps {
  node: NodeConclusion | null;
  evidence: EvidenceCard[];
}

export function EvidencePanel({ node, evidence }: EvidencePanelProps) {
  const visibleEvidence = node
    ? evidence.filter((card) => card.claimNodeId === node.id)
    : evidence.slice(0, 4);

  return (
    <section className="evidence-panel" aria-label="Evidence cards">
      <div className="panel-heading">
        <p className="eyebrow">Evidence Cards</p>
        <h2>{node ? node.label : "Selected Evidence"}</h2>
      </div>
      {node ? (
        <div className="reasoning-note">
          <strong>Reasoning Note</strong>
          <p>{node.reasoningNote}</p>
          <strong>What Would Change</strong>
          <p>{node.whatWouldChange}</p>
        </div>
      ) : null}
      <div className="evidence-list">
        {visibleEvidence.map((card) => (
          <article className={`evidence-card ${card.direction}`} key={card.id}>
            <div>
              <strong>{card.sourceTitle}</strong>
              <span>{card.sourceDate}</span>
            </div>
            <p>{card.extractedFact}</p>
            <small>{card.reasoningImpact}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create workbench controller**

Write `src/components/ResearchWorkbench.tsx`:

```tsx
"use client";

import { createFixtureArtifacts } from "@/data/fixtures";
import { defaultResearchTask } from "@/lib/researchConfig";
import { scoreResearchArtifacts } from "@/lib/scoring";
import type { ResearchRun, ResearchTask } from "@/lib/types";
import { useState } from "react";
import { EvidencePanel } from "./EvidencePanel";
import { HypothesisTree } from "./HypothesisTree";
import { InvestmentMemo } from "./InvestmentMemo";
import { ResearchSetup } from "./ResearchSetup";
import { RunTimeline } from "./RunTimeline";

function createInitialRun(): ResearchRun {
  const artifacts = createFixtureArtifacts(defaultResearchTask);
  const scored = scoreResearchArtifacts(artifacts.nodes, artifacts.evidence);
  return {
    task: defaultResearchTask,
    rootQuestion: artifacts.rootQuestion,
    phases: [
      {
        name: "Task Framing",
        status: "complete",
        detail: "Normalized the company, question template, time horizon, and evidence preference."
      },
      {
        name: "Hypothesis Generation",
        status: "complete",
        detail: "Built a five-node hypothesis tree for the selected research question."
      },
      {
        name: "Evidence Collection",
        status: "complete",
        detail: "Retrieved curated evidence cards and mapped each card to a hypothesis node."
      },
      {
        name: "Evidence Scoring",
        status: "complete",
        detail: "Scored reliability, relevance, freshness, and evidence direction."
      },
      {
        name: "Reasoning Synthesis",
        status: "complete",
        detail: "Synthesized node-level conclusions from supporting and counter-evidence."
      },
      {
        name: "Memo Rendering",
        status: "complete",
        detail: "Rendered the final investment memo from traceable structured artifacts."
      }
    ],
    nodes: scored.nodes,
    evidence: artifacts.evidence,
    memo: scored.memo,
    mode: "fixture"
  };
}

export function ResearchWorkbench() {
  const [task, setTask] = useState<ResearchTask>(defaultResearchTask);
  const [run, setRun] = useState<ResearchRun>(() => createInitialRun());
  const [isRunning, setIsRunning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("demand-sustainability");
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);

  async function handleRun() {
    setIsRunning(true);
    try {
      const response = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task)
      });
      if (!response.ok) {
        throw new Error("Research API returned a non-success response");
      }
      const payload = (await response.json()) as { run: ResearchRun };
      setRun(payload.run);
      setSelectedNodeId(payload.run.nodes[0]?.id ?? null);
      setHighlightedNodeIds([]);
    } catch {
      const artifacts = createFixtureArtifacts(task);
      const scored = scoreResearchArtifacts(artifacts.nodes, artifacts.evidence);
      setRun({
        task,
        rootQuestion: artifacts.rootQuestion,
        phases: createInitialRun().phases,
        nodes: scored.nodes,
        evidence: artifacts.evidence,
        memo: scored.memo,
        mode: "fixture"
      });
    } finally {
      setIsRunning(false);
    }
  }

  const selectedNode = run.nodes.find((node) => node.id === selectedNodeId) ?? null;

  return (
    <main className="app-shell">
      <ResearchSetup
        task={task}
        isRunning={isRunning}
        onTaskChange={setTask}
        onRun={handleRun}
      />
      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Deep Research Track</p>
            <h2>{run.rootQuestion}</h2>
          </div>
          <span className="mode-pill">{run.mode}</span>
        </div>
        <RunTimeline phases={run.phases} />
        <InvestmentMemo memo={run.memo} onSectionSelect={setHighlightedNodeIds} />
      </section>
      <aside className="trace-column">
        <HypothesisTree
          nodes={run.nodes}
          selectedNodeId={selectedNodeId}
          highlightedNodeIds={highlightedNodeIds}
          onSelectNode={setSelectedNodeId}
        />
        <EvidencePanel node={selectedNode} evidence={run.evidence} />
      </aside>
    </main>
  );
}
```

- [ ] **Step 6: Run UI tests and verify they pass**

Run:

```bash
npm run test -- src/components/ResearchWorkbench.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/components/ResearchWorkbench.tsx src/components/ResearchSetup.tsx src/components/RunTimeline.tsx src/components/InvestmentMemo.tsx src/components/HypothesisTree.tsx src/components/EvidencePanel.tsx src/components/ResearchWorkbench.test.tsx
git commit -m "feat: build research workbench"
```

## Task 8: Add Styling And Build Verification

**Files:**
- Create: `src/app/globals.css`

- [ ] **Step 1: Write global CSS**

Write `src/app/globals.css`:

```css
:root {
  color-scheme: light;
  --ink: #101827;
  --muted: #667085;
  --line: #d9e0ea;
  --panel: #ffffff;
  --field: #f7f9fc;
  --blue: #0b47a1;
  --teal: #0f9f8f;
  --amber: #b86b00;
  --red: #b42318;
  --green: #027a48;
  --shadow: 0 18px 50px rgba(16, 24, 39, 0.08);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #eef3f8;
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button,
select {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 380px;
  gap: 16px;
  min-height: 100vh;
  padding: 16px;
}

.setup-panel,
.workspace,
.trace-column > section,
.timeline,
.memo-panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
}

.setup-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
}

.eyebrow {
  color: var(--blue);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  margin: 0 0 6px;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  font-size: 30px;
  line-height: 1;
  margin-bottom: 8px;
}

h2 {
  font-size: 20px;
  line-height: 1.25;
  margin-bottom: 8px;
}

h3 {
  font-size: 15px;
  margin-bottom: 8px;
}

.lede,
.memo-hero p,
.timeline-step p,
.reasoning-note p,
.evidence-card p,
.evidence-card small {
  color: var(--muted);
}

label {
  display: grid;
  gap: 8px;
  color: #344054;
  font-size: 13px;
  font-weight: 700;
}

select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--ink);
  padding: 10px 12px;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.segmented button,
.primary-action,
.trace-button,
.tree-node {
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
}

.segmented button {
  background: var(--field);
  padding: 9px 0;
}

.segmented .active,
.primary-action {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}

.primary-action {
  padding: 12px 14px;
  font-weight: 800;
}

.workspace {
  min-width: 0;
  overflow: auto;
  padding: 16px;
}

.workspace-header {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.mode-pill {
  border: 1px solid #b7d4ff;
  border-radius: 999px;
  color: var(--blue);
  font-size: 12px;
  font-weight: 800;
  padding: 6px 10px;
  white-space: nowrap;
}

.timeline {
  box-shadow: none;
  display: grid;
  gap: 8px;
  margin: 14px 0;
  padding: 12px;
}

.timeline-step {
  align-items: flex-start;
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
}

.step-index {
  align-items: center;
  background: #e6f4f1;
  border-radius: 50%;
  color: var(--teal);
  display: inline-flex;
  font-weight: 900;
  height: 28px;
  justify-content: center;
  width: 28px;
}

.memo-panel {
  box-shadow: none;
  padding: 16px;
}

.memo-hero {
  border-bottom: 1px solid var(--line);
  margin-bottom: 14px;
  padding-bottom: 14px;
}

.memo-hero h2 {
  color: var(--blue);
  font-size: 34px;
}

.stance-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stance-row span,
.trace-button span {
  font-weight: 800;
}

.stance-row span {
  background: #eef5ff;
  border-radius: 999px;
  color: var(--blue);
  padding: 7px 10px;
}

.memo-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.memo-grid article,
.memo-section {
  background: var(--field);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px;
}

.trace-button {
  align-items: flex-start;
  background: #fff;
  display: grid;
  gap: 4px;
  margin-top: 10px;
  padding: 12px;
  text-align: left;
  width: 100%;
}

.trace-column {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.tree-panel,
.evidence-panel {
  overflow: hidden;
  padding: 14px;
}

.panel-heading {
  border-bottom: 1px solid var(--line);
  margin-bottom: 12px;
  padding-bottom: 10px;
}

.tree-list,
.evidence-list {
  display: grid;
  gap: 10px;
}

.tree-node {
  background: #fff;
  display: grid;
  gap: 5px;
  padding: 12px;
  text-align: left;
}

.tree-node strong {
  color: var(--blue);
}

.tree-node small {
  color: var(--muted);
}

.tree-node.selected {
  border-color: var(--teal);
  box-shadow: 0 0 0 3px rgba(15, 159, 143, 0.14);
}

.tree-node.highlighted {
  background: #fff8e8;
  border-color: #f2c170;
}

.reasoning-note {
  background: #f7fbff;
  border: 1px solid #cfe3ff;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 12px;
}

.evidence-card {
  border-left: 4px solid var(--muted);
  border-radius: 8px;
  background: var(--field);
  padding: 12px;
}

.evidence-card.supports {
  border-left-color: var(--green);
}

.evidence-card.refutes {
  border-left-color: var(--red);
}

.evidence-card.complicates {
  border-left-color: var(--amber);
}

.evidence-card div {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.evidence-card span {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 1120px) {
  .app-shell {
    grid-template-columns: 280px minmax(0, 1fr);
  }

  .trace-column {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .app-shell,
  .trace-column,
  .memo-grid {
    grid-template-columns: 1fr;
  }

  .app-shell {
    padding: 10px;
  }
}
```

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm run test
```

Expected: PASS for all tests.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS and `.next` build output is created.

- [ ] **Step 4: Start the dev server for visual verification**

Run:

```bash
npm run dev
```

Expected: dev server starts, usually at `http://localhost:3000`.

Open the app with the Browser tool and verify:

- The page is not blank.
- The three-column layout is visible on desktop width.
- NVIDIA golden path shows `Partially Supported`.
- Clicking a memo trace button highlights hypothesis nodes.
- Selecting a tree node updates evidence cards.
- On mobile width, columns stack without text overlap.

- [ ] **Step 5: Stop the dev server and commit**

Stop the running dev server with `Ctrl-C`.

```bash
git add src/app/globals.css
git commit -m "style: polish research workbench"
```

## Task 9: Add README And Demo Script

**Files:**
- Create: `README.md`
- Create: `docs/demo-script.md`

- [ ] **Step 1: Write README**

Write `README.md`:

```md
# ValuationLens

ValuationLens is a transparent financial research agent for large-cap technology stocks. It turns a stock research question into an auditable hypothesis tree, evidence cards, node-level reasoning, and an interactive investment memo.

## Supported Scope

Companies:

- NVIDIA
- Microsoft
- Micron
- Tesla

Research templates:

- Is the current valuation justified by growth fundamentals?
- What is the most material downside risk over the next 12 months?
- Where do bull and bear theses diverge most?
- Did the latest earnings change the investment thesis?

The demo golden path is NVIDIA with the question: Is NVIDIA's current valuation justified by AI growth fundamentals?

## Why It Matters

Financial research does not only need a polished answer. It needs a visible path from question to hypothesis, evidence, counter-evidence, uncertainty, and final judgment.

ValuationLens is designed to show that path.

## How It Works

The app runs a six-stage research workflow:

1. Task Framing
2. Hypothesis Generation
3. Evidence Collection
4. Evidence Scoring
5. Reasoning Synthesis
6. Memo Rendering

Every major memo claim links back to hypothesis nodes and evidence cards.

## MiroMind Integration

Set these environment variables to enable MiroMind-augmented reasoning:

```bash
MIROMIND_API_KEY=your_key_here
MIROMIND_MODEL=gpt-oss-120b
```

The app calls the OpenAI-compatible chat completions endpoint at:

```text
https://api.miromind.ai/v1/chat/completions
```

If credentials are not present, the app uses the curated fixture pipeline so the hackathon demo remains stable.

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Test

```bash
npm run test
npm run build
```

## Safety Boundary

ValuationLens is research assistance software. It does not provide personalized investment advice, trading instructions, automatic portfolio changes, or order execution.
```

- [ ] **Step 2: Write demo script**

Write `docs/demo-script.md`:

```md
# ValuationLens Three-Minute Demo Script

## 0:00 to 0:20 - Problem

Financial research does not only need an answer. It needs evidence, counter-evidence, uncertainty, and a traceable path from data to judgment.

## 0:20 to 0:45 - Setup

Open ValuationLens. Select NVIDIA and the question: Is the current valuation justified by growth fundamentals?

Briefly point out that Microsoft, Micron, and Tesla are also supported.

## 0:45 to 1:20 - Workflow

Click Run Deep Research.

Show the six visible stages:

1. Task Framing
2. Hypothesis Generation
3. Evidence Collection
4. Evidence Scoring
5. Reasoning Synthesis
6. Memo Rendering

Explain that the app is not a single report-generation prompt. It creates structured artifacts at every stage.

## 1:20 to 2:05 - Hypothesis Tree

Open Demand Sustainability and Valuation Sensitivity.

Show supporting evidence, counter-evidence, confidence, and reasoning notes.

Explain that every node keeps both the pro and con case.

## 2:05 to 2:35 - Investment Memo

Show the final stance: Partially Supported.

Explain the conclusion: NVIDIA's AI growth fundamentals provide meaningful valuation support, but the valuation has elevated sensitivity to demand, margin, and competition assumptions.

## 2:35 to 3:00 - Reasoning Transparency

Click the final stance trace button. Show how the final memo highlights the related hypothesis nodes and evidence cards.

Close with: ValuationLens makes the AI's investment research process traceable, challengeable, and reviewable.
```

- [ ] **Step 3: Verify docs contain the required positioning**

Run:

```bash
rg -n "transparent|hypothesis tree|evidence cards|investment advice|NVIDIA|Micron" README.md docs/demo-script.md
```

Expected: output includes matches for both files.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/demo-script.md
git commit -m "docs: add valuationlens submission materials"
```

## Task 10: Final Verification

**Files:**
- Verify all files created by Tasks 1 through 9.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck and production build**

Run:

```bash
npm run check
npm run build
```

Expected: PASS for both commands.

- [ ] **Step 3: Start app**

Run:

```bash
npm run dev
```

Expected: dev server starts on `http://localhost:3000` or another available port.

- [ ] **Step 4: Browser verification**

Use the Browser tool to verify the demo path:

- Open the local app URL.
- Select NVIDIA.
- Select `Is the current valuation justified by growth fundamentals?`.
- Click `Run Deep Research`.
- Confirm the memo shows `Partially Supported`.
- Click `Final Stance`.
- Confirm hypothesis nodes highlight.
- Select `Demand Sustainability`.
- Confirm evidence cards update.
- Resize to mobile width.
- Confirm no text overlap.

- [ ] **Step 5: Stop app and inspect git status**

Stop the dev server with `Ctrl-C`.

Run:

```bash
git status --short
```

Expected: clean working tree after all commits.
