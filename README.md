# ValuationLens

ValuationLens is a transparent financial research agent for large-cap technology stocks. It lets a user select a listed public company, ask a research question, and watch the agent stream the reasoning chain from task framing to hypothesis tree, evidence, local scoring, and final memo.

Every major memo claim links back to hypothesis nodes and evidence cards.

## Supported Scope

Supported demo securities:

- NVIDIA Corporation (NVDA, NASDAQ)
- Microsoft Corporation (MSFT, NASDAQ)
- Micron Technology, Inc. (MU, NASDAQ)
- Tesla, Inc. (TSLA, NASDAQ)

The left panel searches by company name or ticker and requires the user to select a listed equity before a research run can start.

Golden path:

> Is NVIDIA's current valuation justified by AI growth fundamentals?

## Why It Matters

Financial research needs a visible path from question to hypothesis, evidence, counter-evidence, uncertainty, and final judgment. ValuationLens is designed for research review, not blind report generation, so users can inspect how the system reaches and qualifies its conclusions.

## How It Works

ValuationLens follows a seven-stage workflow:

1. Task Framing
2. Hypothesis Generation
3. Evidence Planning
4. Evidence Research
5. Evidence Scoring
6. Reasoning Synthesis
7. Memo Rendering

## Live Agent Setup

Create `.env.local`:

```bash
MIROMIND_API_KEY=your_key_here
MIROMIND_MODEL=gpt-oss-120b
MIROMIND_BASE_URL=https://api.miromind.ai/v1
```

When `MIROMIND_API_KEY` is present, ValuationLens runs in Live Agent mode and streams MiroMind-backed research stages. Without the key, the app only uses clearly labeled Demo Fallback mode for curated demo tasks.

The API key is configured on the server and is never entered in the browser.

## Primary Demo

Use NVIDIA Corporation (NVDA, NASDAQ) with:

> Is NVIDIA's current valuation justified by AI growth fundamentals?

Use Micron Technology (MU, NASDAQ) as a secondary demo to show that the agent flow is not hard-coded to NVIDIA.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm run test
npm run check
npm run build
```

## Safety Boundary

ValuationLens provides research assistance only. It does not provide personalized investment advice, trading instructions, automatic portfolio changes, or order execution.
