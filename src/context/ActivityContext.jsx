import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const ActivityContext = createContext(null);

const RENDER_BASE = "https://vector-backend-8neo.onrender.com";
const MAX_ACTIVITIES = 200;

function normalizeEntry(row) {
  return {
    id: row.id || crypto.randomUUID(),
    agent: row.agent_name || row.agent_id || "Unknown",
    agentNode: row.agent_node || "",
    category: row.category || "tools",
    action: row.action || "",
    detail: row.detail || "",
    status: row.status || "completed",
    time: row.created_at || new Date().toISOString(),
  };
}

export function ActivityProvider({ children }) {
  const [activities, setActivities] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  // Merge instead of replace — this is what stops the fetch/websocket race
  // from clobbering each other's data.
  const mergeActivities = useCallback((rows, { replace = false } = {}) => {
    setActivities((prev) => {
      const base = replace ? [] : prev;
      const byId = new Map(base.map((a) => [a.id, a]));
      for (const row of rows) byId.set(row.id, row);
      return Array.from(byId.values())
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, MAX_ACTIVITIES);
    });
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${RENDER_BASE}/activity?limit=${MAX_ACTIVITIES}`);
      if (!res.ok) throw new Error(`activity fetch failed: ${res.status}`);
      const data = await res.json();
      mergeActivities((data || []).map(normalizeEntry), { replace: true });
      setError(null);
    } catch (err) {
      console.error("[activity] failed to load history:", err);
      setError(err.message || "Failed to load activity");
    } finally {
      setLoaded(true);
    }
  }, [mergeActivities]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const wsBase = RENDER_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type !== "activity_event") return;
      mergeActivities([normalizeEntry(data)]);
    };

    return () => ws.close();
  }, [mergeActivities]);

  return (
    <ActivityContext.Provider value={{ activities, loaded, error, refresh: fetchHistory }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used inside an ActivityProvider");
  return ctx;
}