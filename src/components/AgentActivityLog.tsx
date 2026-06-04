"use client";

import { useEffect, useRef, useState } from "react";

export type ActivityKind = "info" | "model" | "source" | "warn" | "done";

export interface ActivityEntry {
  id: string;
  atMs: number;
  text: string;
  kind: ActivityKind;
}

interface AgentActivityLogProps {
  entries: ActivityEntry[];
  isRunning: boolean;
  collapseOnComplete?: boolean;
}

function formatAt(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AgentActivityLog({
  entries,
  isRunning,
  collapseOnComplete = false
}: AgentActivityLogProps) {
  const streamRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (collapseOnComplete) {
      setIsOpen(false);
    }
  }, [collapseOnComplete]);

  useEffect(() => {
    const element = streamRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [entries.length, isOpen]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="activity-log" aria-label="Agent activity log">
      <button
        aria-expanded={isOpen}
        className="compact-panel-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <div>
          <p className="eyebrow">Live Reasoning</p>
          <h3>Agent activity</h3>
        </div>
        {isRunning ? (
          <span className="activity-live">working…</span>
        ) : (
          <strong>{entries.length} steps</strong>
        )}
      </button>
      {isOpen ? (
        <div className="activity-stream" ref={streamRef}>
          {entries.map((entry, index) => (
            <div className={`activity-line ${entry.kind}`} key={entry.id}>
              <span className="activity-time">{formatAt(entry.atMs)}</span>
              <span className="activity-text">
                {entry.text}
                {isRunning && index === entries.length - 1 ? (
                  <i className="activity-cursor" />
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
