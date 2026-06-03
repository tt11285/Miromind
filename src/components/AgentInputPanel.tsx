"use client";

import type {
  AgentRequest,
  EvidencePreference,
  ListedSecurity,
  TimeHorizon
} from "@/lib/agent/types";
import { useState } from "react";

interface AgentInputPanelProps {
  isRunning: boolean;
  modeLabel: "Live Agent" | "Demo Fallback" | "Error";
  onRun: (request: AgentRequest) => void;
  onCancel?: () => void;
}

const exampleQuestion =
  "Is NVIDIA's current valuation justified by AI growth fundamentals?";

const demoSecurities: Array<ListedSecurity & { displayName: string }> = [
  {
    displayName: "NVIDIA",
    name: "NVIDIA Corporation",
    ticker: "NVDA",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  {
    displayName: "Microsoft",
    name: "Microsoft Corporation",
    ticker: "MSFT",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  {
    displayName: "Micron",
    name: "Micron Technology, Inc.",
    ticker: "MU",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  {
    displayName: "Tesla",
    name: "Tesla, Inc.",
    ticker: "TSLA",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  }
];

const suggestedQuestionsByTicker: Record<string, string[]> = {
  NVDA: [
    "Is NVIDIA's current valuation justified by AI growth fundamentals?",
    "Can NVIDIA sustain data center growth if hyperscaler capex normalizes?",
    "How much downside risk does NVIDIA face from AI chip competition?",
    "Is NVIDIA's software and networking moat strong enough to defend margins?"
  ],
  MSFT: [
    "Is Microsoft's valuation justified by Azure and AI monetization growth?",
    "Can Copilot adoption materially expand Microsoft's revenue per user?",
    "How exposed is Microsoft to a slowdown in enterprise AI spending?",
    "Does Microsoft's AI infrastructure investment create enough return on capital?"
  ],
  MU: [
    "Is Micron's valuation justified by HBM-driven AI memory demand?",
    "Can Micron sustain pricing power through the next memory cycle?",
    "How much of Micron's upside depends on AI server demand versus traditional memory recovery?",
    "Is Micron's margin profile structurally improving or cyclically peaking?"
  ],
  TSLA: [
    "Is Tesla's valuation justified by autonomous driving and robotaxi optionality?",
    "Can Tesla defend EV margins as competition and pricing pressure increase?",
    "How much should investors value Tesla's energy storage growth?",
    "Does Tesla's current valuation rely too heavily on non-automotive future businesses?"
  ]
};

export function AgentInputPanel({
  isRunning,
  modeLabel,
  onRun,
  onCancel
}: AgentInputPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListedSecurity[]>([]);
  const [security, setSecurity] = useState<ListedSecurity | null>(null);
  const [question, setQuestion] = useState("");
  const [suggestedQuestion, setSuggestedQuestion] = useState("");
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("12M");
  const [evidencePreference, setEvidencePreference] =
    useState<EvidencePreference>("balanced");

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

  function selectSecurity(item: ListedSecurity) {
    setSecurity(item);
    setQuery(`${item.name} (${item.ticker})`);
    setResults([]);
    setSuggestedQuestion("");
  }

  const suggestedQuestions = security
    ? suggestedQuestionsByTicker[security.ticker] ?? []
    : [];
  const canRun = Boolean(security) && question.trim().length > 0 && !isRunning;
  const runHelpText = !security
    ? "Select a listed company and enter a research question to run."
    : !question.trim()
      ? "Enter a research question to run."
      : "Ready to run.";

  return (
    <section className="setup-panel" aria-label="Agent input">
      <div>
        <p className="eyebrow">Real Agent</p>
        <h1>ValuationLens</h1>
        <p className="lede">
          Ask a listed-company research question and watch the reasoning chain.
        </p>
        <span className="mode-pill">{modeLabel}</span>
      </div>

      <div className="quick-chip-row" aria-label="Demo securities">
        {demoSecurities.map((item) => (
          <button
            key={item.ticker}
            type="button"
            onClick={() => selectSecurity(item)}
          >
            {item.displayName} / {item.ticker}
          </button>
        ))}
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
              onClick={() => selectSecurity(item)}
            >
              <strong>{item.name}</strong>
              <span>
                {item.ticker} | {item.exchange} | {item.country} | {item.assetType}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <label>
        Research question
        <textarea
          className="research-question-input"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
            setSuggestedQuestion("");
          }}
          placeholder={`Example: ${exampleQuestion}`}
        />
      </label>

      {suggestedQuestions.length > 0 ? (
        <label>
          Suggested questions
          <select
            value={suggestedQuestion}
            onChange={(event) => {
              const value = event.target.value;
              setSuggestedQuestion(value);
              if (value) {
                setQuestion(value);
              }
            }}
          >
            <option value="">Choose a suggested question</option>
            {suggestedQuestions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label>
        Time horizon
        <select
          value={timeHorizon}
          onChange={(event) => setTimeHorizon(event.target.value as TimeHorizon)}
        >
          <option value="3M">3M</option>
          <option value="12M">12M</option>
          <option value="3Y">3Y</option>
        </select>
      </label>

      <label>
        Evidence preference
        <select
          value={evidencePreference}
          onChange={(event) =>
            setEvidencePreference(event.target.value as EvidencePreference)
          }
        >
          <option value="balanced">Balanced</option>
          <option value="financials">Financial statements first</option>
          <option value="earnings">Earnings calls first</option>
          <option value="news">News and events first</option>
        </select>
      </label>

      {!canRun ? (
        <p className="run-help" id="run-help">
          {runHelpText}
        </p>
      ) : null}

      <button
        aria-describedby={!canRun ? "run-help" : undefined}
        className="primary-action"
        disabled={!canRun}
        title={!canRun ? runHelpText : undefined}
        onClick={() =>
          security &&
          onRun({
            security,
            question: question.trim(),
            timeHorizon,
            researchDepth: "deep",
            evidencePreference,
            fallbackAllowed: true
          })
        }
        type="button"
      >
        {isRunning ? "Running Research" : "Run Deep Research"}
      </button>

      {isRunning && onCancel ? (
        <button className="secondary-action" type="button" onClick={onCancel}>
          Stop research
        </button>
      ) : null}
    </section>
  );
}
