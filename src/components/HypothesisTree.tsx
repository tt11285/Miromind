import type { NodeConclusion } from "@/lib/types";

interface HypothesisTreeProps {
  nodes: NodeConclusion[];
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
            <strong>{node.stance}</strong>
            <small>
              {node.confidence} confidence | {node.supportingEvidence.length} for |{" "}
              {node.counterEvidence.length} against
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
