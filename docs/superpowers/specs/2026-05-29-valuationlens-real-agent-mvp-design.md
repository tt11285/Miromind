# ValuationLens Real Agent MVP Design Spec

Date: 2026-05-29

## 1. Why This Spec Exists

The current ValuationLens implementation proves the interface idea: a three-column financial research workbench with an investment memo, hypothesis tree, evidence cards, and traceable reasoning.

However, it is not yet a real agent. The current app is fixture-first:

- The left column only selects from prewritten companies and question templates.
- The run button posts a static task and does not request live MiroMind reasoning by default.
- The backend always starts from curated fixture artifacts.
- MiroMind, when enabled manually through the API, only appends a short summary and does not generate the research chain.
- The visible UI behaves like a dashboard of prepared knowledge rather than an agent actively doing research.

This spec replaces that direction with a Real Agent MVP: the user enters a company and a research question, clicks one button, and the middle and right columns show a live MiroMind-driven research process as it decomposes the question, forms hypotheses, gathers evidence, scores evidence, and synthesizes a memo.

## 2. Product Positioning

ValuationLens is a real-time financial research agent for single-company deep research.

Its core promise:

> A user can ask a financial research question and watch the agent build the reasoning chain from task framing to hypothesis tree, evidence, counter-evidence, scoring, and final memo.

The product is built for the MiroMind Deep Research track. The important demo is not that the AI can produce a polished answer. The important demo is that the AI can show how it got there.

## 3. MVP Goal

The MVP should make the app unmistakably feel like an agent, not a board.

Success means:

1. The user can type a company and a custom research question.
2. Clicking `Run Deep Research` starts a live run.
3. The UI visibly progresses through multiple agent stages.
4. MiroMind is called by default when `MIROMIND_API_KEY` is configured.
5. MiroMind generates at least the task frame, hypothesis tree, evidence cards, and memo synthesis.
6. The final memo is traceable back to generated hypothesis nodes and generated evidence cards.
7. If MiroMind is not configured or fails, the app clearly labels fallback mode instead of pretending to be live.

## 4. Non-Goals

The MVP will not attempt to become a trading system.

Out of scope:

- Personalized investment advice
- Price targets as recommendations
- Order placement or portfolio changes
- User account system
- Persistent run history
- Full market-data terminal
- Multi-company comparison
- Fully autonomous browsing across arbitrary websites

The product can cite sources and discuss risks, but it must stay framed as research assistance.

## 5. User Experience

The screen remains a three-column workbench, but the behavior changes.

### 5.1 Left Column: Agent Input

The left column is where the user defines the research task.

Controls:

- Company input:
  - Free text field, for example `NVIDIA`, `Microsoft`, `Micron`, `Tesla`, `TSMC`, `Palantir`.
  - Quick chips for the demo set: NVIDIA, Microsoft, Micron, Tesla.
- Research question textarea:
  - Free-form question.
  - Suggested prompts:
    - Is the current valuation justified by AI growth fundamentals?
    - What is the biggest downside risk over the next 12 months?
    - Where do bull and bear theses diverge most?
    - Did the latest earnings change the investment thesis?
- Time horizon:
  - 3M
  - 12M
  - 3Y
- Research depth:
  - Fast Agent
  - Deep Agent
- Evidence preference:
  - Balanced
  - Financial statements first
  - Earnings calls first
  - News and events first
- Run button:
  - `Run Deep Research`

The panel must show the current mode:

- `Live Agent`: MiroMind key exists and the run uses MiroMind.
- `Demo Fallback`: no key or live run failed and fixture fallback is used.
- `Error`: live run failed and fallback is disabled.

The API key is never entered in the browser. It is configured on the server through `.env.local`.

### 5.2 Center Column: Live Research Chain And Memo

Before the run completes, the center column shows a live run timeline.

Stages:

1. Task Framing
2. Hypothesis Generation
3. Evidence Planning
4. Evidence Research
5. Evidence Scoring
6. Reasoning Synthesis
7. Memo Rendering

Each stage shows:

- Status: queued, running, complete, failed
- Short explanation of what the agent is doing
- Generated artifact summary when complete
- Error text if failed

As soon as the memo is available, the center column shows:

- Executive summary
- Final stance
- Confidence
- Key drivers
- Biggest counterargument
- What would change the view
- Human review checklist
- Trace buttons for memo sections

Clicking a memo section trace button selects the linked hypothesis node and updates the evidence panel.

### 5.3 Right Column: Generated Reasoning Artifacts

The right column shows generated artifacts as they become available.

Top: Hypothesis tree

- Root question
- Generated hypothesis nodes
- Node claim
- Weight
- Stance
- Confidence
- Supporting evidence count
- Counter-evidence count
- Reasoning note
- What would change the node conclusion

Bottom: Evidence cards

- Source title
- Source type
- Source date
- URL or reference
- Quoted snippet or compact source excerpt
- Extracted fact
- Direction: supports, refutes, complicates
- Reliability score
- Relevance score
- Freshness score
- Reasoning impact

The right column should make it obvious that evidence and nodes were generated during the run, not loaded from a static board.

## 6. Agent Architecture

The backend becomes agent-first.

Current pipeline:

```text
UI task -> API -> fixture artifacts -> deterministic scoring -> memo
```

New pipeline:

```text
UI task
  -> API streaming run
  -> MiroMind task framing
  -> MiroMind hypothesis generation
  -> MiroMind evidence research
  -> deterministic evidence scoring
  -> MiroMind reasoning synthesis
  -> memo rendering
  -> streaming UI artifacts
```

Fixtures remain only as an explicit fallback.

### 6.1 Server-Side Modules

Recommended modules:

- `src/lib/agent/types.ts`
  - Defines run events, agent artifacts, schema contracts, and phase states.
- `src/lib/agent/miromindClient.ts`
  - Wraps MiroMind API calls.
  - Handles model, base URL, timeout, errors, JSON parsing.
- `src/lib/agent/prompts.ts`
  - Stores prompts for each agent stage.
- `src/lib/agent/schemas.ts`
  - Zod schemas for MiroMind structured outputs.
- `src/lib/agent/runAgent.ts`
  - Orchestrates the live multi-stage run.
- `src/lib/agent/fallback.ts`
  - Converts existing fixtures into the new event/artifact shape.
- `src/app/api/research/run/route.ts`
  - Streams agent events to the browser.

### 6.2 Client-Side Modules

Recommended modules:

- `src/components/AgentInputPanel.tsx`
  - Replaces the static setup panel.
- `src/components/AgentRunTimeline.tsx`
  - Shows streaming phase progress.
- `src/components/LiveResearchWorkbench.tsx`
  - Owns run state and stream parsing.
- `src/components/HypothesisTree.tsx`
  - Reused but adapted for dynamic nodes.
- `src/components/EvidencePanel.tsx`
  - Reused but adapted for streaming evidence.
- `src/components/InvestmentMemo.tsx`
  - Reused but adapted for partial and final memo states.

## 7. MiroMind Integration

The app uses server-side environment variables:

```bash
MIROMIND_API_KEY=your_key_here
MIROMIND_MODEL=gpt-oss-120b
MIROMIND_BASE_URL=https://api.miromind.ai/v1
```

Rules:

- The browser never receives the API key.
- If `MIROMIND_API_KEY` exists, the default run mode is `Live Agent`.
- If the key is missing, the UI must show `Demo Fallback` before the user runs.
- If a live run fails, the app can fallback only if fallback is enabled and must clearly label the result as fallback.
- The README must explain `.env.local` setup.

The client request includes:

```json
{
  "company": "Micron",
  "question": "Is Micron's valuation justified by HBM-driven AI demand?",
  "timeHorizon": "12M",
  "researchDepth": "deep",
  "evidencePreference": "balanced",
  "fallbackAllowed": true
}
```

The API responds as a stream of JSON lines. Each line is one agent event.

## 8. Streaming Event Contract

Use `fetch` with a readable stream instead of `EventSource`, because the request needs a POST body.

Event shape:

```ts
type AgentEvent =
  | { type: "run-started"; runId: string; mode: "live-agent" | "demo-fallback" }
  | { type: "phase-started"; phase: AgentPhaseName; detail: string }
  | { type: "artifact"; artifact: AgentArtifact }
  | { type: "phase-completed"; phase: AgentPhaseName; detail: string }
  | { type: "phase-failed"; phase: AgentPhaseName; error: string }
  | { type: "run-completed"; run: ResearchRun }
  | { type: "run-failed"; error: string; fallbackAvailable: boolean };
```

Artifact types:

- `task-frame`
- `hypothesis-tree`
- `evidence-plan`
- `evidence-cards`
- `scored-nodes`
- `memo`

The UI should update incrementally when each artifact arrives.

## 9. Agent Stage Contracts

### 9.1 Task Framing

Input:

- Company text
- Question text
- Time horizon
- Research depth
- Evidence preference

MiroMind output:

- Normalized company name
- Ticker if known
- Sector frame
- Restated root question
- Research objective
- Decision criteria
- Evidence categories needed
- Safety note that this is research assistance

### 9.2 Hypothesis Generation

MiroMind output:

- Root question
- 4 to 7 hypothesis nodes
- For each node:
  - Label
  - Claim
  - Why it matters
  - Weight
  - Evidence needed
  - Counter-evidence needed

This is the core "Hypothesis Tree" structure.

### 9.3 Evidence Planning

MiroMind output:

- Per-node search/research questions
- Preferred source types
- Known source candidates if available
- What would count as supporting evidence
- What would count as refuting evidence

This stage makes the research plan visible before the answer appears.

### 9.4 Evidence Research

MiroMind output:

- Evidence cards linked to node IDs
- Supporting evidence
- Refuting evidence
- Complicating evidence
- Source title/date/type/reference
- Short quoted snippet or source-grounded paraphrase
- Explanation of how the evidence affects the node

For the MVP, MiroMind is allowed to provide source references through its own research capability. The app should not fake citations. If a source URL or date is uncertain, the card must say so.

### 9.5 Evidence Scoring

Local deterministic scoring remains useful here.

The app scores:

- Reliability
- Relevance
- Freshness
- Direction
- Node confidence
- Weighted node score
- Final stance

MiroMind should not be the only scorer. Keeping scoring local makes the reasoning more auditable.

### 9.6 Reasoning Synthesis

MiroMind receives:

- Task frame
- Hypothesis tree
- Evidence cards
- Scored node conclusions

MiroMind output:

- Executive summary
- Final stance
- Confidence
- Key drivers
- Biggest counterargument
- What would change the view
- Human review checklist
- Memo sections linked to node IDs and evidence IDs

## 10. Prompting And JSON Reliability

Every MiroMind stage must request JSON only.

Each stage should:

- Include a strict JSON schema in the prompt.
- Ask for no markdown outside JSON.
- Validate with Zod.
- Retry once with a repair prompt if JSON parsing fails.
- If retry fails, mark the phase as failed and either fallback or show an error.

The app should store raw MiroMind text only in server logs during development, not in the browser UI.

## 11. Fallback Behavior

Fallback is allowed, but it must be honest.

Fallback modes:

- Missing key: show `Demo Fallback` before run starts.
- Live error: show a visible warning and then load fallback artifacts only if `fallbackAllowed` is true.
- User disables fallback: show an error instead of fixture results.

Fallback artifacts can reuse existing curated data, but the UI label must never imply they came from a live MiroMind run.

## 12. Error Handling

Expected errors:

- Missing API key
- Invalid user input
- MiroMind timeout
- MiroMind non-JSON response
- Schema validation failure
- Empty evidence cards
- Network failure

UI behavior:

- Keep completed phases visible.
- Mark the failed phase clearly.
- Show a concise human-readable error.
- Offer `Retry Live Agent`.
- Offer `Run Demo Fallback` if fallback is available.

## 13. Safety Boundary

The app must include visible safety copy:

> ValuationLens is research assistance software. It does not provide personalized investment advice, trading instructions, automatic portfolio changes, or order execution.

Generated memos should avoid commands like "buy", "sell", or "short" as instructions. Preferred language:

- "The evidence supports..."
- "The thesis is partially supported..."
- "The main uncertainty is..."
- "A human reviewer should verify..."

## 14. Demo Path

Primary live demo:

- Company: Micron
- Question: Is Micron's valuation justified by HBM-driven AI demand?
- Time horizon: 12M
- Research depth: Deep Agent
- Evidence preference: Balanced

Why Micron:

- It reflects the user's update replacing Apple with Micron.
- HBM demand is an AI-infrastructure thesis with clear bull and bear arguments.
- It is less overused than NVIDIA and better demonstrates that the app can handle more than one prewritten golden path.

Backup demo:

- Company: NVIDIA
- Question: Is NVIDIA's current valuation justified by AI growth fundamentals?

The final demo should show:

1. User enters company and question.
2. Agent run starts.
3. Timeline stages move from running to complete.
4. Hypothesis tree appears while the run progresses.
5. Evidence cards appear linked to nodes.
6. Memo appears with a final stance.
7. Clicking a memo trace selects the relevant node and evidence.
8. The UI displays `Live Agent` if MiroMind was used.

## 15. Acceptance Criteria

The Real Agent MVP is complete when:

- A user can type any company string and any research question string.
- The browser request triggers a MiroMind-backed run when `MIROMIND_API_KEY` is present.
- The UI streams or progressively displays at least four live phases before final completion.
- MiroMind generates a hypothesis tree rather than the app loading a fixed tree.
- MiroMind generates evidence cards rather than the app loading only fixed evidence.
- Local scoring converts generated evidence into node scores and final stance.
- The memo is generated from live artifacts and links back to generated nodes/evidence.
- Missing API key produces an honest `Demo Fallback` state.
- README explains `.env.local` setup and live/fallback modes.
- Tests cover:
  - missing key fallback
  - live stream success with mocked MiroMind
  - malformed MiroMind JSON retry/failure
  - memo trace selects linked node/evidence
  - no API key leaks to client output

## 16. Implementation Strategy

Implement in layers:

1. Add new dynamic request and artifact types.
2. Replace the left panel with free-text company/question input.
3. Add server-side MiroMind stage calls with mocked tests.
4. Add streaming response from the run route.
5. Add client stream parser and progressive UI updates.
6. Adapt hypothesis tree, evidence panel, and memo to dynamic artifacts.
7. Relegate fixtures to explicit fallback mode.
8. Update README and demo script.
9. Run full browser verification on live mocked mode and fallback mode.

The implementation should not delete the existing fixture system immediately. It should wrap it as fallback while the live agent path becomes the default.

