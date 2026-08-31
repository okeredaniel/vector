import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const ActivityContext = createContext(null);

const RENDER_BASE = "https://vector-backend-8neo.onrender.com";
const MAX_ACTIVITIES = 200; // cap in-memory list so this can't grow unbounded in a long session

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
  const wsRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${RENDER_BASE}/activity?limit=${MAX_ACTIVITIES}`);
        if (res.ok) {
          const data = await res.json();
          setActivities((data || []).map(normalizeEntry));
        }
      } catch (err) {
        console.error("[activity] failed to load history:", err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

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

      setActivities((prev) => [normalizeEntry(data), ...prev].slice(0, MAX_ACTIVITIES));
    };

    return () => ws.close();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${RENDER_BASE}/activity?limit=${MAX_ACTIVITIES}`);
      if (res.ok) {
        const data = await res.json();
        setActivities((data || []).map(normalizeEntry));
      }
    } catch (err) {
      console.error("[activity] failed to refresh:", err);
    }
  }, []);

  return (
    <ActivityContext.Provider value={{ activities, loaded, refresh }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used inside an ActivityProvider");
  return ctx;
}