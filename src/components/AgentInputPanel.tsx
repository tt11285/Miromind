"use client";

import type {
  AgentRequest,
  EvidencePreference,
  ListedSecurity,
  ResearchDepth,
  TimeHorizon
} from "@/lib/agent/types";
import { useState } from "react";

interface AgentInputPanelProps {
  isRunning: boolean;
  modeLabel: "Live Agent" | "Demo Fallback" | "Error";
  onRun: (request: AgentRequest) => void;
}

const defaultQuestion =
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

export function AgentInputPanel({
  isRunning,
  modeLabel,
  onRun
}: AgentInputPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListedSecurity[]>([]);
  const [security, setSecurity] = useState<ListedSecurity | null>(null);
  const [question, setQuestion] = useState(defaultQuestion);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("12M");
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>("deep");
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
  }

  const canRun = Boolean(security) && question.trim().length > 0 && !isRunning;

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
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
      </label>

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
        Research depth
        <select
          value={researchDepth}
          onChange={(event) => setResearchDepth(event.target.value as ResearchDepth)}
        >
          <option value="deep">Deep Agent</option>
          <option value="fast">Fast Agent</option>
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
