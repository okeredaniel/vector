export default function NodeTooltip({ node }) {
  return (
    <div className="node-tooltip" style={{ "--node-color": node.color }}>
      <p className="node-tooltip-name">{node.name}</p>
      <p className="node-tooltip-row">{node.tasks} {node.tasks === 1 ? "task" : "tasks"} running</p>
      <p className="node-tooltip-row muted">Active {node.lastActive}</p>
    </div>
  );
}
