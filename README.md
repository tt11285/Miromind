# ValuationLens

ValuationLens is a transparent financial research agent for large-cap technology stocks. It turns a stock research question into an auditable hypothesis tree, evidence cards, node-level reasoning, and an interactive investment memo.

Every major memo claim links back to hypothesis nodes and evidence cards.

## Supported Scope

Supported companies:

- NVIDIA
- Microsoft
- Micron
- Tesla

Supported research templates:

- Is the current valuation justified by growth fundamentals?
- What is the most material downside risk over the next 12 months?
- Where do bull and bear theses diverge most?
- Did the latest earnings change the investment thesis?

Golden path:

> Is NVIDIA's current valuation justified by AI growth fundamentals?

## Why It Matters

Financial research needs a visible path from question to hypothesis, evidence, counter-evidence, uncertainty, and final judgment. ValuationLens is designed for research review, not blind report generation, so users can inspect how the system reaches and qualifies its conclusions.

## How It Works

ValuationLens follows a six-stage workflow:

1. Task Framing
2. Hypothesis Generation
3. Evidence Collection
4. Evidence Scoring
5. Reasoning Synthesis
6. Memo Rendering

## MiroMind Integration

The visible UI demo remains fixture-backed by default so the hackathon walkthrough is stable. The API route calls MiroMind only when a request includes `useMiroMind: true` and `MIROMIND_API_KEY` is present.

```env
MIROMIND_API_KEY=your_key_here
MIROMIND_MODEL=gpt-oss-120b
```

Endpoint:

```text
https://api.miromind.ai/v1/chat/completions
```

Example API flag:

```json
{
  "useMiroMind": true
}
```

Without credentials, or without `useMiroMind: true`, the curated fixture pipeline keeps the hackathon demo stable.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm run test
npm run build
```

## Safety Boundary

ValuationLens provides research assistance only. It does not provide personalized investment advice, trading instructions, automatic portfolio changes, or order execution.
