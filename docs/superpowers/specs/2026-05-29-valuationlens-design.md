# ValuationLens Design Spec

Date: 2026-05-29

## 1. Product Positioning

ValuationLens is a transparent financial research agent for large-cap technology stocks. It turns an investment research question into an auditable hypothesis tree, evidence cards, node-level reasoning, and an interactive investment memo.

The project is built for the MiroMind Deep Research track. The core objective is not to generate a more polished stock report. The core objective is to make the AI's research process visible, traceable, challengeable, and reviewable.

The product supports:

- Companies: NVIDIA, Microsoft, Micron, Tesla
- Research templates:
  - Is the current valuation justified by growth fundamentals?
  - What is the most material downside risk over the next 12 months?
  - Where do bull and bear theses diverge most?
  - Did the latest earnings change the investment thesis?

The demo golden path is:

- Company: NVIDIA
- Question: Is NVIDIA's current valuation justified by AI growth fundamentals?
- Output: An interactive investment memo with a hypothesis tree, evidence cards, counter-evidence, confidence scores, and a traceable final stance.

ValuationLens does not provide personalized investment advice, trading instructions, automatic portfolio changes, or order execution.

## 2. Target User And Use Case

The target user is an investor, analyst, founder, student, or hackathon judge who wants to understand how an AI reaches a financial research conclusion.

The primary use case is single-company deep research:

1. The user selects a company.
2. The user selects a research question template.
3. The agent decomposes the question into a hypothesis tree.
4. The agent collects and scores supporting and opposing evidence.
5. The agent synthesizes node-level conclusions.
6. The agent generates a memo that can be traced back to evidence and reasoning notes.

The key product promise is:

> The user can inspect why the agent reached a conclusion, where the evidence came from, what the strongest counterargument is, and what would change the view.

## 3. Judging Strategy

ValuationLens is designed to compete on all three award dimensions.

Best Use Case:

- Financial research is a high-value domain where correctness alone is insufficient.
- Users need evidence, counter-evidence, uncertainty, and auditability before trusting a conclusion.
- The use case is realistic and easy to understand within a short demo.

Best Technical Implementation:

- The app is a multi-stage research pipeline, not a single prompt.
- Structured artifacts are produced at each stage: research task, hypothesis tree, evidence cards, node scores, synthesis notes, final memo.
- MiroMind is used for multi-step reasoning across decomposition, extraction, scoring, and synthesis.

Best Reasoning Transparency:

- The final stance is derived from weighted hypothesis nodes.
- Every important claim is linked to one or more evidence cards.
- Nodes include supporting evidence, counter-evidence, confidence, uncertainty, and "what would change this view".
- The UI lets users move from final conclusion to node reasoning to source evidence.

## 4. MVP Scope

P0 requirements:

- Research setup UI for the four supported companies and four supported question templates.
- Complete NVIDIA golden path for the AI valuation question.
- Three-column research workbench:
  - Left: research setup
  - Center: interactive investment memo
  - Right: hypothesis tree and evidence drawer
- Agent run timeline:
  - Task framing
  - Hypothesis generation
  - Evidence collection
  - Evidence scoring
  - Reasoning synthesis
  - Memo rendering
- Complete evidence cards for the NVIDIA golden path.
- Node-level scores and final weighted stance.
- README and three-minute demo script.

P1 requirements:

- Microsoft, Micron, and Tesla run through the same workflow with lighter preloaded evidence.
- Markdown export for the memo.
- README section explaining the MiroMind reasoning workflow.
- Basic source freshness and reliability indicators.

P2 requirements:

- Live web/news search for supplemental evidence.
- User-adjustable node weights.
- Multi-company comparison.
- Free-form custom questions.
- More valuation metrics and deeper market data integration.

## 5. User Experience

The main screen is a three-column research workbench.

### 5.1 Left Column: Research Setup

Controls:

- Company selector:
  - NVIDIA
  - Microsoft
  - Micron
  - Tesla
- Research question selector:
  - Is the current valuation justified by growth fundamentals?
  - What is the most material downside risk over the next 12 months?
  - Where do bull and bear theses diverge most?
  - Did the latest earnings change the investment thesis?
- Time horizon:
  - 3M
  - 12M
  - 3Y
- Evidence preference:
  - Balanced
  - Financial statements first
  - Earnings calls first
  - News and events first
- Run Deep Research button.

### 5.2 Center Column: Interactive Investment Memo

The memo includes:

- Executive summary
- Final stance:
  - Supported
  - Partially Supported
  - Inconclusive
  - Weakly Unsupported
  - Not Supported
- Confidence
- Key drivers
- Biggest counterargument
- What would change the view
- Human review checklist
- Evidence-backed section details

For the NVIDIA golden path, the recommended final stance is:

> Partially Supported, with elevated valuation sensitivity.

The memo should explain that NVIDIA's AI growth fundamentals provide meaningful support for the valuation, but the conclusion depends on continued data center demand, Blackwell ramp execution, cloud capex durability, and limited margin pressure from competition or customer-owned chips. The strongest counterargument is not that growth is absent, but that the valuation already requires very little execution error.

### 5.3 Right Column: Hypothesis Tree

The right column renders the reasoning structure:

- Root node: the selected research question.
- Child nodes: hypothesis nodes for the selected template.
- Each node shows:
  - Node stance
  - Confidence
  - Number of supporting evidence cards
  - Number of counter-evidence cards
  - Weighted score
  - Expandable reasoning note
  - Source snippets

Clicking a final memo claim highlights the nodes and evidence cards that support that claim.

## 6. Agent Workflow

The agent workflow is a visible six-stage pipeline.

### 6.1 Task Framing

Input:

- Company
- Question template
- Time horizon
- Evidence preference

Output:

- Normalized company identifier
- Research question type
- Time horizon
- Required evidence categories
- Initial decision criteria

Example for NVIDIA:

The agent converts "Is NVIDIA's current valuation justified by AI growth fundamentals?" into a structured valuation support task. Relevant criteria include revenue growth, margin durability, demand sustainability, competitive moat, and valuation sensitivity.

### 6.2 Hypothesis Generation

The agent generates the hypothesis tree for the selected question template. The tree is adapted to the selected company's business context.

For NVIDIA, the valuation template becomes:

- Revenue Growth
- Margin Durability
- Demand Sustainability
- Competitive Moat
- Valuation Sensitivity

### 6.3 Evidence Collection

The agent collects or retrieves evidence from the evidence layer.

Primary evidence categories:

- Company official materials:
  - 10-K
  - 10-Q
  - annual report
  - earnings release
  - earnings call transcript
  - investor presentation
- Market and valuation data:
  - market capitalization
  - revenue growth
  - margin trends
  - forward multiples
  - EV/Sales
  - P/E
- News and industry events:
  - product launches
  - regulatory events
  - major customer capex updates
  - supply chain events
  - competitor announcements
- Competitor and ecosystem signals:
  - AMD
  - Broadcom
  - hyperscaler capex
  - AI accelerator demand
  - HBM and memory cycle indicators

The golden path should use a curated, stable evidence pack to reduce demo risk. Live search can be used as a supplemental feature after the core flow works.

### 6.4 Evidence Scoring

Each evidence card is scored on:

- Reliability: source credibility and verifiability
- Relevance: connection to the hypothesis node
- Freshness: date and recency
- Direction: supports, refutes, or neutral
- Reasoning impact: why this evidence changes or does not change the node conclusion

### 6.5 Reasoning Synthesis

For each hypothesis node, the agent synthesizes:

- Local stance
- Confidence
- Weighted score
- Key supporting evidence
- Key counter-evidence
- Reasoning note
- What would change this node

The root conclusion is derived from the weighted node scores, not directly generated as a standalone opinion.

### 6.6 Memo Rendering

The final memo is rendered from structured artifacts:

- Research task
- Hypothesis tree
- Evidence cards
- Node scores
- Reasoning notes
- Final stance

The memo must not include major claims that cannot be traced back to evidence cards.

## 7. Hypothesis Templates

### 7.1 Valuation Justification Template

Root question:

Is the current valuation justified by growth fundamentals?

Nodes:

- Revenue Growth: Is growth strong enough to support the valuation?
- Margin Durability: Are current or expected margins sustainable?
- Demand Sustainability: Is customer demand real, durable, and likely to continue?
- Competitive Moat: Can the company defend its position against competitors and substitutes?
- Valuation Sensitivity: How much future growth is already priced in?

Company-specific language:

- NVIDIA: AI data center, H100/H200/Blackwell, CUDA moat, hyperscaler capex, customer-owned chips.
- Microsoft: Azure AI growth, Copilot monetization, enterprise adoption, OpenAI dependency.
- Micron: HBM demand, DRAM/NAND pricing cycle, AI memory attach rate, supply discipline.
- Tesla: EV demand, gross margin, China competition, FSD and robotaxi optionality.

### 7.2 Downside Risk Template

Root question:

What is the most material downside risk over the next 12 months?

Nodes:

- Demand Risk
- Margin Risk
- Execution Risk
- Competitive Risk
- Macro or Regulatory Risk

Output:

- Most material risk
- Probability
- Impact
- Early warning signals
- Evidence for and against

### 7.3 Bull vs Bear Divergence Template

Root question:

Where do bull and bear theses diverge most?

Nodes:

- Growth Assumption Gap
- Margin Assumption Gap
- Market Size Gap
- Competition Gap
- Valuation Gap

Output:

- Top debate points
- Strongest bull evidence
- Strongest bear evidence
- Which side is better supported
- Data that would resolve the debate

### 7.4 Earnings Thesis Change Template

Root question:

Did the latest earnings change the investment thesis?

Nodes:

- Revenue Surprise
- Guidance Change
- Margin Trend
- Segment Momentum
- Management Tone

Output:

- Thesis changed, reinforced, or unchanged
- What changed
- What did not change
- Key quotes or evidence
- Follow-up metrics to watch

## 8. Evidence Model

The core evidence object is an Evidence Card.

Required fields:

- id
- company
- question_template
- claim_node_id
- source_title
- source_type
- source_date
- quoted_snippet
- extracted_fact
- supports_or_refutes
- reliability_score
- relevance_score
- freshness_score
- reasoning_impact
- url_or_reference

Every Evidence Card must answer:

- Which hypothesis node does this evidence affect?
- Does it support, refute, or complicate the node?
- Where did it come from?
- How reliable is it?
- How fresh is it?
- Why does it matter?

## 9. Scoring And Final Stance

Each hypothesis node receives four conceptual scores:

- Evidence Strength: quality and specificity of evidence.
- Support Balance: whether stronger evidence supports or refutes the node.
- Materiality: importance to the root question.
- Uncertainty: freshness, contradiction, and future assumption risk.

Node output:

- stance: supports, weakly supports, mixed, weakly refutes, refutes
- confidence: high, medium, low
- weighted_score: -2 to +2
- key_supporting_evidence
- key_counter_evidence
- reasoning_note
- what_would_change_this_node

For the NVIDIA valuation template, default node weights are:

- Revenue Growth: 20%
- Margin Durability: 15%
- Demand Sustainability: 25%
- Competitive Moat: 20%
- Valuation Sensitivity: 20%

Final stance mapping:

- +1.2 to +2.0: Supported
- +0.3 to +1.2: Partially Supported
- -0.3 to +0.3: Inconclusive
- -1.2 to -0.3: Weakly Unsupported
- -2.0 to -1.2: Not Supported

The final confidence is reduced when:

- Evidence is stale.
- Evidence conflicts sharply.
- Key claims rely mainly on projections.
- The largest node has low confidence.
- Source quality is weak.

## 10. Architecture

Core modules:

### 10.1 Research Setup UI

Collects company, question template, time horizon, and evidence preference.

Output:

- ResearchTask

### 10.2 Research Orchestrator

Coordinates the six-stage workflow. It should not directly generate conclusions. It calls specialized steps and records intermediate artifacts.

### 10.3 MiroMind Reasoning Runner

Uses the MiroMind Deep Research API for:

- Task framing
- Hypothesis tree generation
- Evidence extraction
- Evidence direction classification
- Node-level reasoning
- Memo synthesis

The app should present a structured reasoning trace rather than claiming to expose hidden model thoughts.

### 10.4 Evidence Layer

Stores and retrieves curated evidence cards. The NVIDIA golden path uses a high-quality preloaded evidence pack.

### 10.5 Synthesis Engine

Aggregates node conclusions into the root stance. It enforces the rule that important memo claims must be evidence-backed.

### 10.6 Audit Trail Store

Stores every research run:

- ResearchTask
- Task frame
- Hypothesis tree
- Evidence cards
- Node scores
- Reasoning notes
- Final memo

### 10.7 Memo And Tree Renderer

Renders the center memo and right-side hypothesis tree. Supports trace interactions from memo claims to nodes and evidence.

## 11. Error Handling And Safety

The app must handle:

- Missing evidence: show insufficient evidence and low confidence.
- Conflicting evidence: show both sides and reduce confidence.
- Stale source dates: label freshness risk.
- Unsupported claims: block or flag final memo claims with no evidence cards.
- API failure: fall back to preloaded golden path data and label the run as demo mode.
- Ambiguous user selection: require one supported company and one supported question template.

Safety boundaries:

- Do not provide personalized financial advice.
- Do not recommend automatic buy or sell actions.
- Do not imply real-time market completeness.
- Include a clear "research assistance only" limitation.

## 12. Testing Strategy

Functional tests:

- Each supported company can be selected.
- Each supported question template can start a run.
- NVIDIA golden path produces the full six-stage output.
- Every final memo claim links to at least one evidence card.
- Clicking a memo claim highlights the related node and evidence.
- Evidence cards display source title, date, direction, and reasoning impact.

Reasoning consistency tests:

- Node scores aggregate to the final stance.
- The final stance label matches the weighted score range.
- Low-confidence or conflicting evidence reduces confidence.
- Counter-evidence is displayed, not hidden.

Demo reliability tests:

- Golden path works without live network dependencies.
- The app can complete the demo flow in under three minutes.
- The UI remains readable on a standard laptop viewport.

## 13. Demo Video Script

0:00 to 0:20: Problem

Financial research does not only need an answer. It needs evidence, counter-evidence, uncertainty, and a traceable path from data to judgment.

0:20 to 0:45: Setup

Select NVIDIA and the valuation question. Briefly show that Microsoft, Micron, and Tesla are also supported.

0:45 to 1:20: Agent Workflow

Show the six stages completing:

- Task framing
- Hypothesis generation
- Evidence collection
- Evidence scoring
- Reasoning synthesis
- Memo rendering

1:20 to 2:05: Hypothesis Tree

Open Demand Sustainability and Valuation Sensitivity. Show supporting evidence, counter-evidence, confidence, and reasoning notes.

2:05 to 2:35: Investment Memo

Show final stance, confidence, key drivers, biggest counterargument, what would change the view, and human review checklist.

2:35 to 3:00: Reasoning Transparency

Click the final conclusion and show how it traces back to hypothesis nodes and evidence cards.

## 14. Submission Copy

Short description:

ValuationLens is a transparent financial research agent for large-cap technology stocks. Instead of giving a black-box buy or sell answer, it decomposes an investment question into a hypothesis tree, collects supporting and opposing evidence, scores each reasoning node, and generates an auditable investment memo. The demo focuses on whether NVIDIA's current valuation is justified by AI growth fundamentals, while the product supports NVIDIA, Microsoft, Micron, and Tesla across four research templates. Every key conclusion links back to evidence cards and reasoning notes, making the AI's research process traceable, challengeable, and reviewable.

Pitch:

ValuationLens turns stock research questions into auditable hypothesis trees, evidence cards, and investment memos.

Chinese pitch:

ValuationLens 是一个透明投研 Agent。普通 AI 可能直接告诉你 NVIDIA 值不值得买，但在投研里，真正关键的是它为什么这么判断，证据是什么，反方观点是什么，哪些条件会推翻这个结论。ValuationLens 会把投资问题拆成假设树，把每个判断连接到证据卡，最后生成一份可审计的 investment memo。

## 15. Development Priority

Build order:

1. Implement the NVIDIA golden path with complete structured data.
2. Implement the research setup UI and three-column workbench.
3. Implement hypothesis tree, evidence cards, and memo trace interactions.
4. Implement the run timeline for the six-stage workflow.
5. Add Microsoft, Micron, and Tesla with lighter preloaded evidence.
6. Wire the MiroMind API into decomposition, scoring, and synthesis.
7. Polish the README and record the demo video.

The priority is reasoning trace quality over data breadth. The golden path must feel credible, inspectable, and stable.

