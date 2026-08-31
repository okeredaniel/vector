// Groups nodes by their icon/type and shows a 3-bar activity indicator
// per group instead of the old approval queue / chat card filler.
function activityLevel(node) {
  if (node.state === "running") return 3;
  if (node.state === "approval") return 2;
  if (node.state === "error") return 1;
  return 1;
}

export default function SignalBars({ nodes }) {
  return (
    <div className="signal-bars">
      {nodes.map((node) => {
        const level = activityLevel(node);
        return (
          <div key={node.id} className="signal-bar-item">
            <div className="signal-bar-bars">
              {[1, 2, 3].map((bar) => (
                <span
                  key={bar}
                  className="signal-bar"
                  style={{
                    height: `${bar * 5}px`,
                    background: bar <= level ? node.color : "rgba(255,255,255,0.12)",
                  }}
                />
              ))}
            </div>
            <span className="signal-bar-label">{node.name}</span>
          </div>
        );
      })}
    </div>
  );
}
