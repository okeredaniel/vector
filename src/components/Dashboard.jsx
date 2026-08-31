import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import "./Dashboard.css";
import { useDraggableStage } from "./useDraggableStage.js";
import NodeTooltip from "./NodeTooltip.jsx";
import GlobeWidget from "./GlobeWidget.jsx";
import SignalBars from "./SignalBars.jsx";
import CoordinateReadout from "./CoordinateReadout.jsx";
import {
  Settings,
  PenLine,
  MessageCircle,
  BarChart3,
  Monitor as MonitorIcon,
  DollarSign,
  Search,
  Folder,
  Sigma,
  X,
  Bell,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import Ytb from "../assets/Youtube.png"
import { openUrl } from "@tauri-apps/plugin-opener";


const CANVAS_W = 1440;
const CANVAS_H = 900;
const HUB = { x: 720, y: 450 };

// Everything in this file fetches/connects through these two constants -
// both default to the live Render backend, never localhost.
const API_BASE = "https://vector-backend-8neo.onrender.com";
const WS_BASE = API_BASE.replace(/^http/, "ws");

const WS_RECONNECT_BASE_MS = 1500;
const WS_RECONNECT_MAX_MS = 20000;
const NODE_STATUS_POLL_MS = 15000;

// Static structural config only - identity, layout, wiring. Live numbers
// come from /nodes/status.
const NODES = [
  {
    id: "atlas", name: "Atlas", icon: Settings, x: 720, y: 190,
    state: "idle", statusText: "idle", beamDelay: 0, color: "#f5f5f5",
    tasks: 0, lastActive: "—", description2: "Local Runtime & Offline System Control",
    executionMode: "Autonomous (On-Device)",
    controlledTools: ["file_tools.py", "notes_tool.py", "celsius_to_fahrenheit.py", "local_executor"],
  },
  {
    id: "igris", name: "Igris", icon: PenLine, x: 887, y: 251,
    state: "idle", statusText: "idle", beamDelay: 0.75, color: "#fbff00",
    tasks: 0, lastActive: "—", description2: "Multimodal & Content Automation Center",
    executionMode: "Supervised Auto-Upload",
    controlledTools: ["youtube_tools.py", "video_tool.py", "tts_tool.py", "smart_caption.py"],
  },
  {
    id: "sora", name: "Sora", icon: MessageCircle, x: 976, y: 405,
    state: "idle", statusText: "idle", beamDelay: 1.5, color: "#ff9101",
    tasks: 0, lastActive: "—", description2: "Unified Gateway & Multi-Model Router",
    executionMode: "Dynamic Smart-Routing",
    controlledTools: ["web_tools.py", "orchestrator/router.py", "fallback.py", "routing.py"],
  },
  {
    id: "shiro", name: "Shiro", icon: BarChart3, x: 945, y: 580,
    state: "idle", statusText: "idle", beamDelay: 2.25, color: "#f800d7",
    tasks: 0, lastActive: "—", description2: "Ultra-Fast Analytics & Whisper Transcription",
    executionMode: "Real-Time Auto-Stream",
    controlledTools: ["video_tool.py (Whisper v3)", "tool_stats.py", "tool_health.py", "provider_health.py"],
  },
  {
    id: "johan", name: "Johan", icon: MonitorIcon, x: 809, y: 694,
    state: "idle", statusText: "idle", beamDelay: 3, color: "#fc002e",
    tasks: 0, lastActive: "—", description2: "GPU Acceleration & Infrastructure Oversight",
    executionMode: "Background Infrastructure",
    controlledTools: ["provider_health.py", "monitors.py", "ws_manager.py", "permission_broker.py"],
  },
  {
    id: "light", name: "Light", icon: DollarSign, x: 631, y: 694,
    state: "idle", statusText: "idle", beamDelay: 3.75, color: "#00ee3b",
    tasks: 0, lastActive: "—", description2: "Financial Intelligence & RAG Retrieval",
    executionMode: "Supervised Financial Exec",
    controlledTools: ["finance_tool.py", "convert_usd_to_ngn.py", "currency_converter.py", "memory.py"],
  },
  {
    id: "armin", name: "Armin", icon: Search, x: 495, y: 580,
    state: "idle", statusText: "idle", beamDelay: 4.5, color: "#a78bfa",
    tasks: 0, lastActive: "—", description2: "Deep Search & Open Reasoning Engine",
    executionMode: "Autonomous Web Agent",
    controlledTools: ["web_tools.py (Tavily)", "weather_tool.py", "job_board_monitor.py", "planner.py"],
  },
  {
    id: "reigen", name: "Reigen", icon: Folder, x: 464, y: 405,
    state: "idle", statusText: "idle", beamDelay: 5.25, color: "#0055ff",
    tasks: 0, lastActive: "—", description2: "Media Processing & Open Model Hub",
    executionMode: "Autonomous Media Pipeline",
    controlledTools: ["audio_tools.py", "twitch_tools.py", "clip_picker.py", "youtube_clip_tools.py"],
  },
  {
    id: "sinbad", name: "Sinbad", icon: Sigma, x: 553, y: 251,
    state: "idle", statusText: "idle", beamDelay: 5.25, color: "#00ffff",
    tasks: 0, lastActive: "—", description2: "Self-Evolution, Roblox MCP & Coding Master",
    executionMode: "Full Autonomous Orchestration",
    controlledTools: ["self_extend.py", "roblox_tool.py", "coding_agent.py", "scheduler.py"],
  },
];

function useStageScale(containerRef) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function computeScale(width, height) {
      const scaleX = width / CANVAS_W;
      const scaleY = height / CANVAS_H;
      setScale(Math.max(scaleX, scaleY));
    }

    computeScale(el.clientWidth, el.clientHeight);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        computeScale(width, height);
      }
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [containerRef]);

  return scale;
}

function HexNode({ node, onClick }) {
  const Icon = node.icon;
  const hasWarning = node.hasRetiredTool;
  const badgeCount = node.id === "sinbad" ? node.pendingApprovalCount : 0;

  return (
    <div
      className={`node-wrap ${node.state}`}
      style={{
        left: node.x,
        top: node.y,
        animationDelay: `${node.beamDelay}s`,
        "--node-color": node.color,
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onClick?.();
        }
      }}
    >
      <div className="hex-glow" />
      <div className="hex-wrapper">
        <div className="hex">
          <Icon className="hex-icon" size={26} strokeWidth={3} />
        </div>
        {hasWarning && (
          <div className="hex-warning-badge" title="A tool on this node was auto-retired">
            <AlertTriangle size={11} strokeWidth={2.5} />
          </div>
        )}
        {badgeCount > 0 && (
          <div className="hex-count-badge" title={`${badgeCount} pending approval(s)`}>
            {badgeCount}
          </div>
        )}
      </div>
      <div className="label">
        <span className="hex-name">{node.name}</span>
        <span className="hex-tip">View details</span>
      </div>
    </div>
  );
}

function Starfield({ count = 0 }) {
  const stars = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() < 0.85 ? 1 : 2,
      delay: Math.random() * 4,
      duration: 2 + Math.random() * 3,
    }));
  }, [count]);

  return (
    <div className="starfield">
      {stars.map((s) => (
        <div
          key={s.id}
          className="star"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function toolToAction(safeName, entry) {
  return {
    id: `tool-${safeName}`,
    type: entry.is_update ? "TOOL UPDATE" : "TOOL APPROVAL",
    typeColor: "#818cf8",
    agent: "Coding Agent",
    agentNode: "Sinbad",
    color: "#00ffff",
    title: entry.is_update ? `Update Drafted: ${entry.tool_name}` : `New Tool Drafted: ${entry.tool_name}`,
    description: entry.description || `Tool '${entry.tool_name}' is waiting in tools/pending/ for review.`,
    time: entry.created_at ? new Date(entry.created_at).toLocaleTimeString() : "",
    actions: ["Approve & Deploy", "Reject"],
    _kind: "pending_tool",
    _safeName: safeName,
  };
}

// Monitors now show in three distinct states, each with the buttons that
// actually make sense for that state:
// - active:    still watching, hasn't triggered - Pause / Delete
// - triggered: condition met, needs a decision  - Acknowledge / Pause
// - paused:    not currently checking            - Resume / Delete
function monitorToAction(monitorId, entry) {
  const status = entry.status || "active";

  const statusConfig = {
    active: {
      type: "MONITOR ACTIVE",
      typeColor: "#5b8def",
      title: entry.description || "Monitor Watching",
      description: entry.last_result
        ? `Last check: ${entry.last_result}`
        : `Watching, checks every ${entry.interval_minutes || 30}m. No trigger yet.`,
      actions: ["Pause Monitor", "Delete Monitor"],
    },
    triggered: {
      type: "MONITOR ALERT",
      typeColor: "#f59e0b",
      title: entry.description || "Monitor Triggered",
      description: entry.last_result || "Condition met.",
      actions: ["Acknowledge", "Pause Monitor"],
    },
    paused: {
      type: "MONITOR PAUSED",
      typeColor: "#8b88a6",
      title: entry.description || "Monitor Paused",
      description: entry.last_result
        ? `Last check before pausing: ${entry.last_result}`
        : "Not currently checking.",
      actions: ["Resume Monitor", "Delete Monitor"],
    },
  };

  const cfg = statusConfig[status] || statusConfig.active;

  return {
    id: `monitor-${monitorId}`,
    type: cfg.type,
    typeColor: cfg.typeColor,
    agent: entry.agent_id || "agent",
    agentNode: "Light",
    color: "#00ee3b",
    title: cfg.title,
    description: cfg.description,
    time: entry.triggered_at
      ? new Date(entry.triggered_at).toLocaleTimeString()
      : entry.last_checked
      ? new Date(entry.last_checked).toLocaleTimeString()
      : "",
    actions: cfg.actions,
    _kind: "monitor",
    _monitorId: monitorId,
    _monitorStatus: status,
  };
}

function permissionToAction(msg) {
  return {
    id: `perm-${msg.request_id}`,
    type: "PERMISSION REQUEST",
    typeColor: "#f87171",
    agent: msg.agent || "agent",
    agentNode: msg.agent || "",
    color: "#fbff00",
    title: `${msg.tool} Permission Request`,
    description: `Agent ${msg.agent} wants to run ${msg.tool}(${JSON.stringify(msg.args || {})})`,
    time: new Date().toLocaleTimeString(),
    actions: ["Approve", "Deny"],
    _kind: "permission",
    _requestId: msg.request_id,
  };
}

function retiredToolToAction(msg) {
  return {
    id: `retired-${msg.tool_name}-${msg.consecutive_errors}`,
    type: "TOOL RETIRED",
    typeColor: "#f59e0b",
    agent: "Tool Health",
    agentNode: "Shiro",
    color: "#f800d7",
    title: `Auto-Retired: ${msg.tool_name}`,
    description: `Failed ${msg.consecutive_errors} times in a row. Last error: ${msg.reason || "unknown"}`,
    time: new Date().toLocaleTimeString(),
    actions: ["Reactivate", "Dismiss"],
    _kind: "retired_tool",
    _toolName: msg.tool_name,
  };
}

function providerFixToAction(fixId, entry) {
  return {
    id: `fix-${fixId}`,
    type: "PROVIDER FIX",
    typeColor: "#5b8def",
    agent: entry.provider || "provider",
    agentNode: "Sora",
    color: "#ff9101",
    title: entry.title || "Provider Issue Detected",
    description: entry.description || entry.diagnosis || "A backend provider failure was detected and a fix was drafted.",
    time: entry.created_at ? new Date(entry.created_at).toLocaleTimeString() : "",
    actions: ["Review", "Dismiss"],
    _kind: "provider_fix",
    _fixId: fixId,
  };
}

export default function Dashboard() {
  const [nodesList, setNodesList] = useState(NODES);
  const containerRef = useRef(null);
  const baseScale = useStageScale(containerRef);

  const { pan, zoom, isDragging, isSettling } = useDraggableStage();
  const [activeNode, setActiveNode] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingActions, setPendingActions] = useState([]);
  const [expandedActionId, setExpandedActionId] = useState(null);
  const [isRefreshingActions, setIsRefreshingActions] = useState(false);

  const [wsState, setWsState] = useState("connecting");
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const wsRef = useRef(null);
  const connGenRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const unmountedRef = useRef(false);

  const stageScale = baseScale * zoom;

const connectionState = !browserOnline
  ? "offline"
  : wsState === "open"
  ? "online"
  : "connecting";
  
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/nodes/status`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const status = await res.json();

      setNodesList((prev) =>
        prev.map((n) => {
          const s = status[n.id];
          if (!s) return n;
          const hasWork = (s.active_tasks || 0) > 0;
          const health = s.dynamic_tool_health || {};
          const hasRetiredTool = Object.values(health).some((h) => h.status === "retired");

          const recentActivity = Object.entries(s.tools || {})
            .filter(([, v]) => v.last_called)
            .sort((a, b) => new Date(b[1].last_called) - new Date(a[1].last_called))
            .slice(0, 4)
            .map(([toolName, v]) => ({
              tool: toolName,
              calls: v.calls,
              lastCalled: v.last_called,
            }));

          return {
            ...n,
            tasks: s.active_tasks ?? n.tasks,
            lastActive: s.last_active ? new Date(s.last_active).toLocaleTimeString() : n.lastActive,
            state: hasWork ? "running" : n.state === "shutdown" ? "shutdown" : "idle",
            statusText: hasWork ? "running" : n.state === "shutdown" ? "offline" : "idle",
            activeMonitors: s.active_monitors || [],
            recentActivity,
            hasRetiredTool,
            ...(n.id === "johan" ? { wsConnections: s.ws_connections } : {}),
            ...(n.id === "sinbad" ? {
              toolsDrafted: s.tools_drafted,
              toolsRetired: s.tools_retired,
              pendingApprovalCount: s.pending_approval_count,
            } : {}),
          };
        })
      );
    } catch (err) {
      // fail silent
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, NODE_STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [loadStatus]);

  useEffect(() => {
    if (!activeNode) return;
    const updated = nodesList.find((n) => n.id === activeNode.id);
    if (updated && updated !== activeNode) setActiveNode(updated);
  }, [nodesList]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectWs = useCallback(() => {
  if (unmountedRef.current) return;

  if (reconnectTimerRef.current) {
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    reconnectTimerRef.current = setTimeout(connectWs, WS_RECONNECT_BASE_MS);
    return;
  }

  const myGen = ++connGenRef.current; // ← THIS LINE WAS MISSING
  setWsState("connecting");

  const ws = new WebSocket(`${WS_BASE}/ws`);
  wsRef.current = ws;

  let heartbeatInterval = null;

  ws.onopen = () => {
    if (connGenRef.current !== myGen) return;
    reconnectAttemptRef.current = 0;
    setWsState("open");

    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  };

  ws.onclose = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (connGenRef.current !== myGen) return;
    if (unmountedRef.current) return;
    setWsState("closed");
    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;
    const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** (attempt - 1), WS_RECONNECT_MAX_MS);
    reconnectTimerRef.current = setTimeout(connectWs, delay);
  };

  ws.onerror = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (connGenRef.current !== myGen) return;
    setWsState("closed");
    ws.close();
  };

  ws.onmessage = (event) => {
    if (connGenRef.current !== myGen) return;
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type === "pong") return;

    if (msg.type === "permission_request") {
      setPendingActions((prev) => [permissionToAction(msg), ...prev]);
    } else if (msg.type === "tool_pending_review") {
      setPendingActions((prev) => [
        toolToAction(msg.safe_name, {
          tool_name: msg.tool_name,
          description: msg.description,
          is_update: msg.is_update,
          created_at: new Date().toISOString(),
        }),
        ...prev,
      ]);
    } else if (msg.type === "monitor_triggered") {
      setPendingActions((prev) => {
        const withoutOld = prev.filter((a) => a.id !== `monitor-${msg.monitor_id}`);
        return [
          monitorToAction(msg.monitor_id, {
            status: "triggered",
            description: msg.description,
            last_result: msg.result,
            triggered_at: new Date().toISOString(),
          }),
          ...withoutOld,
        ];
      });
    } else if (msg.type === "tool_retired") {
      setPendingActions((prev) => [retiredToolToAction(msg), ...prev]);
    } else if (msg.type === "provider_fix_drafted") {
      setPendingActions((prev) => [
        providerFixToAction(msg.fix_id, {
          provider: msg.provider,
          title: msg.title,
          description: msg.description,
          created_at: new Date().toISOString(),
        }),
        ...prev,
      ]);
    }
  };
}, []);

// Separate top-level effect — NOT inside connectWs. Must come after
// connectWs is declared above, since it references it.
useEffect(() => {
  const goOnline = () => {
    
    setBrowserOnline(true);
      setWsState("connecting");
    reconnectAttemptRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      connectWs();
    }
  };

  const goOffline = () => {
    setBrowserOnline(false);
    setWsState("closed");
    wsRef.current?.close();
  };

  window.addEventListener("online", goOnline);
  window.addEventListener("offline", goOffline);
  return () => {
    window.removeEventListener("online", goOnline);
    window.removeEventListener("offline", goOffline);
  };
}, [connectWs]);

  const refreshPendingActions = useCallback(async () => {
    setIsRefreshingActions(true);
    try {
      const [pendingRes, monitorsRes, fixesRes] = await Promise.all([
        fetch(`${API_BASE}/tools/pending`),
        fetch(`${API_BASE}/monitors`),
        fetch(`${API_BASE}/provider-health/pending-fixes`),
      ]);
      const pending = await pendingRes.json();
      const monitors = await monitorsRes.json();
      const fixes = await fixesRes.json().catch(() => ({}));

      const toolActions = Object.entries(pending)
        .filter(([, entry]) => entry.status === "pending_review")
        .map(([safeName, entry]) => toolToAction(safeName, entry));

      const monitorActions = Object.entries(monitors)
        .filter(([, entry]) => ["active", "triggered", "paused"].includes(entry.status))
        .map(([id, entry]) => monitorToAction(id, entry));

      const fixActions = Object.entries(fixes || {}).map(([id, entry]) =>
        providerFixToAction(id, entry)
      );

      setPendingActions((prev) => {
        const nonMonitorPrev = prev.filter((a) => a._kind !== "monitor");
        const existingIds = new Set(nonMonitorPrev.map((a) => a.id));
        const freshNonMonitor = [...toolActions, ...fixActions].filter(
          (a) => !existingIds.has(a.id)
        );
        return [...monitorActions, ...nonMonitorPrev, ...freshNonMonitor];
      });
    } catch (err) {
      // fail silent
    } finally {
      setIsRefreshingActions(false);
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;

    refreshPendingActions();
    connectWs();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connectWs, refreshPendingActions]);

  const closeModal = () => setActiveNode(null);
  const openNotifications = () => {
    setActiveNode(null);
    setShowNotifications(true);
    setExpandedActionId(null);
    refreshPendingActions();
  };
  const closeNotifications = () => {
    setShowNotifications(false);
    setExpandedActionId(null);
  };
  const handleNodeClick = (node) => setActiveNode(node);

  const handleTogglePower = (nodeId) => {
    setNodesList((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          const isShutdown = n.state === "shutdown";
          const nextState = isShutdown ? "running" : "shutdown";
          const nextStatus = isShutdown ? "running" : "offline";
          return { ...n, state: nextState, statusText: nextStatus };
        }
        return n;
      })
    );
    setActiveNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      const isShutdown = prev.state === "shutdown";
      return {
        ...prev,
        state: isShutdown ? "running" : "shutdown",
        statusText: isShutdown ? "running" : "offline",
      };
    });
  };

  const handleActionDecision = async (e, actionId, decision) => {
    e.stopPropagation();
    const action = pendingActions.find((a) => a.id === actionId);
    if (!action) return;

    const lowerDecision = decision.toLowerCase();
    const isPauseAction = action._kind === "monitor" && lowerDecision.includes("pause");
    const isAcknowledgeAction = action._kind === "monitor" && lowerDecision.includes("acknowledge");
    const isResumeAction = action._kind === "monitor" && lowerDecision.includes("resume");
    const isDeleteAction = action._kind === "monitor" && lowerDecision.includes("delete");

    if (isPauseAction) {
      try {
        await fetch(`${API_BASE}/monitors/${action._monitorId}/pause`, { method: "POST" });
        setPendingActions((prev) =>
          prev.map((item) =>
            item.id === actionId
              ? {
                  ...item,
                  type: "MONITOR PAUSED",
                  typeColor: "#8b88a6",
                  _monitorStatus: "paused",
                  actions: ["Resume Monitor", "Delete Monitor"],
                }
              : item
          )
        );
      } catch (err) {
        console.error(`[Action Popup] Failed to pause monitor ${actionId}:`, err);
      }
      return;
    }

    if (isResumeAction) {
      setPendingActions((prev) =>
        prev.map((item) =>
          item.id === actionId
            ? {
                ...item,
                type: "MONITOR ACTIVE",
                typeColor: "#5b8def",
                _monitorStatus: "active",
                actions: ["Pause Monitor", "Delete Monitor"],
              }
            : item
        )
      );
      try {
        await fetch(`${API_BASE}/monitors/${action._monitorId}/resume`, { method: "POST" });
      } catch (err) {
        console.error(`[Action Popup] Failed to resume monitor ${actionId}:`, err);
      }
      return;
    }

    if (isAcknowledgeAction) {
      setPendingActions((prev) => prev.filter((item) => item.id !== actionId));
      if (expandedActionId === actionId) setExpandedActionId(null);
      try {
        await fetch(`${API_BASE}/monitors/${action._monitorId}/acknowledge`, { method: "POST" });
      } catch (err) {
        console.error(`[Action Popup] Failed to acknowledge monitor ${actionId}:`, err);
      }
      return;
    }

    if (isDeleteAction) {
      setPendingActions((prev) => prev.filter((item) => item.id !== actionId));
      if (expandedActionId === actionId) setExpandedActionId(null);
      try {
        await fetch(`${API_BASE}/monitors/${action._monitorId}`, { method: "DELETE" });
      } catch (err) {
        console.error(`[Action Popup] Failed to delete monitor ${actionId}:`, err);
      }
      return;
    }

    if (action._kind === "provider_fix" && lowerDecision.includes("review")) {
      return;
    }

    setPendingActions((prev) => prev.filter((item) => item.id !== actionId));
    if (expandedActionId === actionId) setExpandedActionId(null);

    try {
      if (action._kind === "pending_tool") {
        const approve = lowerDecision.includes("approve");
        await fetch(
          `${API_BASE}/tools/pending/${action._safeName}/${approve ? "approve" : "reject"}`,
          { method: "POST" }
        );
      } else if (action._kind === "permission") {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "permission_response",
            request_id: action._requestId,
            decision: lowerDecision.includes("approve") ? "allow_once" : "deny",
          }));
        }
      } else if (action._kind === "retired_tool") {
        if (lowerDecision.includes("reactivate")) {
          await fetch(`${API_BASE}/tools/health/${action._toolName}/reactivate`, { method: "POST" });
        }
      } else if (action._kind === "provider_fix") {
        if (lowerDecision.includes("dismiss")) {
          await fetch(`${API_BASE}/provider-health/pending-fixes/${action._fixId}`, { method: "DELETE" });
        }
      }
    } catch (err) {
      console.error(`[Action Popup] Failed to submit decision for ${actionId}:`, err);
    }
  };

  const toggleExpandAction = (id) => {
    setExpandedActionId((prev) => (prev === id ? null : id));
  };

  const activeCount = nodesList.filter((n) => n.state === "running").length;

  const connLabel =
    connectionState === "online" ? "Online" : connectionState === "connecting" ? "Connecting…" : "Offline";

  return (
    <div
      className={`vector-app ${isDragging ? "is-dragging" : ""}`}
      ref={containerRef}
    >
      <Starfield count={40} />
      <div className="topbar">
        <div className="topbar-left">
          <span className="brand">VECTOR</span>
        </div>
        <div className="topbar-right">
<button
  className="ytb-box"
  onClick={() => openUrl("https://studio.youtube.com")}
>
  <span>Youtube</span>
</button>
          <button className={`conn-status ${connectionState}`}>{connLabel}</button>
          <div
            className="widget notification-widget icon-only"
            role="button"
            tabIndex={0}
            onClick={openNotifications}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                openNotifications();
              }
            }}
          >

            <Bell className="widget-icon" size={20} />
            {pendingActions.length > 0 && (
              <span className="topbar-bell-badge">{pendingActions.length}</span>
            )}
          </div>
        </div>
      </div>

      <CoordinateReadout nodeCount={nodesList.length} activeCount={activeCount} />

      {activeNode && (
        <div className="modal-backdrop" onClick={closeModal}>
          <aside className="side-modal" onClick={(event) => event.stopPropagation()}>
            <div className="topclose">
              <button className="modal-close" onClick={closeModal} aria-label="Close modal">
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="modal-header">
              <div className="modal-heading">
                <div className="modal-icon-wrap" style={{ "--node-color": activeNode.color }}>
                  <activeNode.icon size={23} strokeWidth={2} />
                </div>
                <div>
                  <h2>{activeNode.name}</h2>
                  <p className="modal-tag" style={{ color: activeNode.color }}>Node details</p>
                  <p className="modal-description2">{activeNode.description2}</p>
                </div>
              </div>
            </div>

            <div className={`modal-status-pill state-${activeNode.state}`}>
              <span className="modal-status-dot" />
              {activeNode.statusText}
            </div>

            <div className="modal-stat-grid">
              <div className="modal-stat">
                <span className="modal-stat-label">Active Tasks</span>
                <span className="modal-stat-value">{activeNode.tasks}</span>
              </div>
              <div className="modal-stat">
                <span className="modal-stat-label">Last Active</span>
                <span className="modal-stat-value">{activeNode.lastActive}</span>
              </div>
              <div className="modal-stat">
                <span className="modal-stat-label">Total Tool Calls</span>
                <span className="modal-stat-value">
                  {activeNode.recentActivity?.reduce((sum, a) => sum + (a.calls || 0), 0) || 0}
                </span>
              </div>
              <div className="modal-stat">
                <span className="modal-stat-label">Execution Mode</span>
                <span className="modal-stat-value mode-tag">{activeNode.executionMode}</span>
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-section">
                <p className="modal-section-label">Auto-Controlled Tools</p>
                <div className="modal-tools-grid">
                  {activeNode.controlledTools.map((toolName, i) => (
                    <span key={i} className="modal-tool-chip" style={{ "--node-color": activeNode.color }}>
                      ⚡ {toolName}
                    </span>
                  ))}
                </div>
              </div>

              {activeNode.activeMonitors?.length > 0 && (
                <div className="modal-section">
                  <p className="modal-section-label">Active Monitors</p>
                  <div className="modal-tools-grid">
                    {activeNode.activeMonitors.map((m, i) => (
                      <span key={i} className="modal-tool-chip" style={{ "--node-color": activeNode.color }}>
                        👁 {m.description}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-section">
                <p className="modal-section-label">Recent Activity</p>
                <div className="model-cards">
                  {activeNode.recentActivity?.length > 0 ? (
                    activeNode.recentActivity.map((item, i) => (
                      <div key={i} className="model-card" style={{ "--node-color": activeNode.color }}>
                        <div className="model-card-header">
                          <span className="model-card-name">{item.tool}</span>
                          <span className="model-card-provider">{item.calls} calls</span>
                        </div>
                        <p className="model-card-description">
                          Last run {item.lastCalled ? new Date(item.lastCalled).toLocaleString() : "—"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="model-card" style={{ "--node-color": activeNode.color }}>
                      <p className="model-card-description">No recorded activity yet for this node.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              className={`modal-primary-action ${activeNode.state === "shutdown" ? "power-on" : "power-off"}`}
              onClick={() => handleTogglePower(activeNode.id)}
            >
              {activeNode.state === "shutdown" ? "Power On Node" : "Shut Down Node"}
            </button>
          </aside>
        </div>
      )}

      {showNotifications && (
        <div className="modal-backdrop" onClick={closeNotifications}>
          <aside
            className={`side-modal action-popup-modal ${expandedActionId ? "is-expanded" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="topclose">
              <button
                className="modal-close"
                onClick={refreshPendingActions}
                aria-label="Reload notifications"
                disabled={isRefreshingActions}
                style={{ marginRight: 8 }}
              >
                <RefreshCw size={16} strokeWidth={2} className={isRefreshingActions ? "spin" : ""} />
              </button>
              <button className="modal-close" onClick={closeNotifications} aria-label="Close notifications">
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="modal-header">
              <div>
                <p className="modal-tag">Pending Action Required</p>
                <h2>System Decision Queue</h2>
              </div>
            </div>
            <div className="modal-body">
              {pendingActions.length === 0 ? (
                <div className="notification-empty">
                  <div className="action-clear-icon">✓</div>
                  <p className="notification-title">All Actions Handled</p>
                  <p className="notification-subtitle">No pending approvals or alerts requiring user action.</p>
                </div>
              ) : (
                pendingActions.map((action) => {
                  const isExpanded = expandedActionId === action.id;
                  return (
                    <div
                      key={action.id}
                      className={`action-popup-card ${isExpanded ? "is-expanded" : ""}`}
                      style={{ "--action-color": action.typeColor }}
                      onClick={() => toggleExpandAction(action.id)}
                    >
                      <div className="action-card-header">
                        <span
                          className="action-type-badge"
                          style={{
                            color: action.typeColor,
                            background: `color-mix(in srgb, ${action.typeColor} 12%, transparent)`,
                          }}
                        >
                          {action.type}
                        </span>
                        <span className="action-expand-hint">
                          {isExpanded ? "Click to collapse ▲" : "Click for more info ▼"}
                        </span>
                      </div>

                      <div className="action-agent-line">
                        <span
                          className="action-dot"
                          style={{ backgroundColor: action.color, boxShadow: `0 0 6px ${action.color}` }}
                        />
                        <span className="action-agent-name">{action.agent}</span>
                        <span className="action-agent-node">({action.agentNode})</span>
                        <span className="action-time">{action.time}</span>
                      </div>

                      <h3 className="action-card-title">{action.title}</h3>
                      <p className="action-card-desc">{action.description}</p>

                      {isExpanded && (
                        <div className="action-extended-box">
                          <span className="extended-label">EXTENDED PAYLOAD & LOG DETAILS</span>
                          <div className="extended-details-grid">
                            <div className="ext-item">
                              <span className="ext-key">Caller Agent:</span>
                              <span className="ext-val">{action.agent} ({action.agentNode})</span>
                            </div>
                            <div className="ext-item">
                              <span className="ext-key">Source:</span>
                              <span className="ext-val">{action._kind}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="action-btn-group">
                        {action.actions.map((actName, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={`action-decision-btn ${idx === 0 ? "primary" : "secondary"}`}
                            onClick={(e) => handleActionDecision(e, action.id, actName)}
                          >
                            {actName}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}

      <div
        className={`stage ${isSettling ? "settling" : ""}`}
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${stageScale})`,
        }}
      >
        <svg
          className="mesh-svg"
          width={CANVAS_W}
          height={CANVAS_H}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        >
          <ellipse cx={HUB.x} cy={HUB.y} rx="50" ry="50" className="ring ring-1" />
          <ellipse cx={HUB.x} cy={HUB.y} rx="100" ry="100" className="ring ring-2" />
          <ellipse cx={HUB.x} cy={HUB.y} rx="160" ry="160" className="ring ring-3" />
          <ellipse cx={HUB.x} cy={HUB.y} rx="230" ry="230" className="ring ring-4" />
          <ellipse cx={HUB.x} cy={HUB.y} rx="310" ry="310" className="ring ring-5" />
          <ellipse cx={HUB.x} cy={HUB.y} rx="380" ry="380" className="ring ring-6" />
          <ellipse cx={HUB.x} cy={HUB.y} rx="450" ry="450" className="ring ring-6" />

          {nodesList.map((node) => (
            <line key={node.id} x1={HUB.x} y1={HUB.y} x2={node.x} y2={node.y} className="spoke" />
          ))}

          {nodesList.map((node) => (
            <circle key={`pulse-${node.id}`} r="3" className="pulse-dot" style={{ fill: node.color }}>
              <animateMotion
                dur="2.2s"
                repeatCount="indefinite"
                begin={`${node.beamDelay}s`}
                path={`M ${node.x} ${node.y} L ${HUB.x} ${HUB.y}`}
              />
            </circle>
          ))}
        </svg>

        <div className="nexus-halo" style={{ left: HUB.x, top: HUB.y }} />
        <div className="hub-glow" style={{ left: HUB.x, top: HUB.y }} />
        <div className="lighthouse-pivot" style={{ left: HUB.x, top: HUB.y }}>
          <div className="lighthouse-beam" />
        </div>
        <div className="nexusringblock" style={{ left: HUB.x, top: HUB.y }}>
          <div className="nexus-ring-3d nexus-ring-3d-a" />
          <div className="nexus-ring-3d nexus-ring-3d-b" />
          <div className="nexus-ring-3d nexus-ring-3d-c" />
        </div>

        <div className="hub-core" style={{ left: HUB.x, top: HUB.y }} />

        {nodesList.map((node) => (
          <HexNode key={node.id} node={node} onClick={() => handleNodeClick(node)} />
        ))}
      </div>
    </div>
  );
}