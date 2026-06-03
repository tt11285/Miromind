interface AgentStatusBarProps {
  mode: "Live Agent" | "Demo Fallback" | "Error";
  stageLabel: string;
  elapsedMs: number;
  apiCalls: number;
  verifiedSources: number;
  totalSources: number;
  isRunning: boolean;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function AgentStatusBar({
  mode,
  stageLabel,
  elapsedMs,
  apiCalls,
  verifiedSources,
  totalSources,
  isRunning
}: AgentStatusBarProps) {
  return (
    <section className="agent-status-bar" aria-label="Agent status">
      <div className="status-stat status-stage">
        <span className={`status-dot ${isRunning ? "live" : "idle"}`} />
        <div>
          <small>Stage</small>
          <strong>{stageLabel}</strong>
        </div>
      </div>
      <div className="status-stat">
        <div>
          <small>Elapsed</small>
          <strong>{formatElapsed(elapsedMs)}</strong>
        </div>
      </div>
      <div className="status-stat">
        <div>
          <small>Model calls</small>
          <strong>{apiCalls}</strong>
        </div>
      </div>
      <div className="status-stat">
        <div>
          <small>Sources verified</small>
          <strong>
            {verifiedSources}/{totalSources}
          </strong>
        </div>
      </div>
      <span className="mode-pill">{mode}</span>
    </section>
  );
}
