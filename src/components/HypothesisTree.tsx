import type { HypothesisNodeDraft } from "@/lib/agent/types";

interface HypothesisTreeProps {
  nodes: HypothesisNodeDraft[];
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
            aria-pressed={selectedNodeId === node.id}
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
            <strong>{Math.round(node.weight * 100)}% weight</strong>
            <small>
              {node.evidenceNeeded.length} evidence needs |{" "}
              {node.counterEvidenceNeeded.length} counter checks
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
