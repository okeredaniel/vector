// Replaces the old bottom-right "Uptime / Agents active" card with a
// small monospace HUD-style corner readout, folding uptime into it.
import { useEffect, useState } from "react";

function formatUptime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export default function CoordinateReadout({ nodeCount, activeCount }) {
  const [now, setNow] = useState(new Date());
  const [uptimeSeconds, setUptimeSeconds] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setNow(new Date());
      setUptimeSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const time = now.toUTCString().slice(17, 25);

  return (
    <div className="coordinate-readout">
      <span>SYS.TIME &nbsp; {time} UTC</span>
      <span>SYS.UPTIME &nbsp; {formatUptime(uptimeSeconds)}</span>
      <span>NODES.ACTIVE &nbsp; {activeCount}/{nodeCount}</span>
    </div>
  );
}
