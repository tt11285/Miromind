"use client";

import { useEffect, useRef } from "react";

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
}

function formatAt(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AgentActivityLog({ entries, isRunning }: AgentActivityLogProps) {
  const streamRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = streamRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="activity-log" aria-label="Agent activity log">
      <div className="compact-section-heading">
        <div>
          <p className="eyebrow">Live Reasoning</p>
          <h3>Agent activity</h3>
        </div>
        {isRunning ? <span className="activity-live">working…</span> : null}
      </div>
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
    </section>
  );
}
