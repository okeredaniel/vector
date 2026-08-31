import { useState, useMemo } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Terminal,
  Cpu,
  Sparkles,
  Zap,
  Eye,
  Play,
  FileCode,
  X,
  RefreshCw,
} from "lucide-react";
import { useActivity } from "../context/ActivityContext.jsx";
import "./ActivityTab.css";

const FILTER_CATEGORIES = [
  { id: "all", label: "All Activity" },
  { id: "tools", label: "Tool Executions" },
  { id: "media", label: "Media & Audio" },
  { id: "monitors", label: "Monitors & Alerts" },
  { id: "system", label: "Self-Extend & System" },
];

const AGENT_COLORS = {
  ollama: "#f5f5f5",
  ollama_local: "#f5f5f5",
  gemini_research: "#fbff00",
  openrouter: "#ff9101",
  dev: "#f800d7",
  nvidia: "#fc002e",
  cohere: "#00ee3b",
  mistral: "#a78bfa",
  huggingface: "#0055ff",
  siliconflow: "#00ffff",
  zai: "#38bdf8",
  coding: "#f472b6",
  github: "#a78bfa",
};

const CATEGORY_ICONS = {
  tools: Terminal,
  media: Play,
  monitors: AlertCircle,
  system: FileCode,
};

function formatRelativeTime(isoString) {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? "s" : ""} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
}

export default function ActivityTab() {
  const { activities, loaded, refresh } = useActivity();
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      // brief minimum spin so the click always feels acknowledged, even
      // when the fetch resolves near-instantly from cache
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const enriched = useMemo(
    () =>
      activities.map((a) => ({
        ...a,
        agentColor: AGENT_COLORS[a.agent] || "#a78bfa",
        timeLabel: formatRelativeTime(a.time),
        icon: CATEGORY_ICONS[a.category] || Terminal,
        type:
          a.category === "media"
            ? "Media Pipeline"
            : a.category === "monitors"
            ? "Monitor"
            : a.category === "system"
            ? "Self-Extend"
            : "Tool Execution",
      })),
    [activities]
  );

  const stats = useMemo(() => {
    const total = activities.length;
    const alerts = activities.filter((a) => a.status === "alert").length;
    const pending = activities.filter((a) => a.status === "pending_review").length;
    const errors = activities.filter((a) => a.status === "error").length;
    const failures = errors + alerts; // denied permissions (alert) count as failures too, not just crashes
    const successRate = total > 0 ? (((total - failures) / total) * 100).toFixed(1) : "0";
    return [
      { label: "Total Executions", value: String(total), icon: Zap, color: "#a78bfa" },
      { label: "Pending Review", value: `${pending} Item${pending === 1 ? "" : "s"}`, icon: Cpu, color: "#38bdf8" },
      { label: "Alerts Triggered", value: `${alerts} Alert${alerts === 1 ? "" : "s"}`, icon: Eye, color: "#f59e0b" },
      { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle2, color: "#4ade80" },
    ];
  }, [activities]);

  const filteredActivities = enriched.filter((item) => {
    const matchesFilter = activeFilter === "all" || item.category === activeFilter;
    const matchesSearch =
      item.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.agent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.agentNode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.detail.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="activity-tab">
      <div className="activity-header">
        <div className="activity-header-top">
          <span className="activity-eyebrow">System Telemetry</span>
          <h1 className="activity-title">Activity Feed</h1>
        </div>
        <p className="activity-subtitle">
          Real-time execution log of agent tool calls, background watchers, and system events.
        </p>

        {/* Top Stats Overview */}
        <div className="activity-stats-grid">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="activity-stat-card" style={{ "--stat-color": stat.color }}>
                <div className="stat-card-header">
                  <span className="stat-label">{stat.label}</span>
                  <div className="stat-icon-wrap">
                    <Icon size={16} />
                  </div>
                </div>
                <span className="stat-value">{stat.value}</span>
              </div>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div className="activity-controls">
          <div className="activity-filter-chips">
            {FILTER_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`activity-filter-chip ${activeFilter === cat.id ? "active" : ""}`}
                onClick={() => setActiveFilter(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="activity-controls-right">
            <button
              type="button"
              className="activity-reload-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Reload activity list"
            >
              <RefreshCw size={13} className={isRefreshing ? "spinning" : ""} />
              <span>Reload</span>
            </button>

            <div className="activity-search-wrap">
              <input
                type="text"
                className="activity-search-input"
                placeholder="Search logs & tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="activity-list">
        {!loaded && (
          <div className="activity-empty-state">
            <Sparkles size={24} className="empty-icon" />
            <p>Loading activity history…</p>
          </div>
        )}

        {loaded &&
          filteredActivities.map((act, index) => {
            return (
              <div
                key={act.id}
                className={`activity-row status-${act.status}`}
                style={{
                  "--agent-color": act.agentColor,
                  animationDelay: `${index * 0.05}s`,
                }}
                onClick={() => setSelectedActivity(act)}
              >
                <div className="activity-agent-badge">
                  <span
                    className="agent-dot"
                    style={{
                      backgroundColor: act.agentColor,
                      boxShadow: `0 0 8px ${act.agentColor}`,
                    }}
                  />
                  <div className="agent-info">
                    <span className="agent-name">{act.agent}</span>
                    {act.agentNode && <span className="agent-node">({act.agentNode})</span>}
                  </div>
                </div>

                <div className="activity-content">
                  <div className="activity-action-line">
                    <span className="activity-type-tag">{act.type}</span>
                    <span className="activity-action-text">{act.action}</span>
                  </div>
                  <p className="activity-detail-text">{act.detail}</p>
                </div>

                <div className="activity-meta">
                  <span className={`activity-status-badge status-${act.status}`}>
                    {act.status.replace("_", " ")}
                  </span>
                  <span className="activity-time-text">
                    <Clock size={11} />
                    {act.timeLabel}
                  </span>
                </div>
              </div>
            );
          })}

        {loaded && filteredActivities.length === 0 && (
          <div className="activity-empty-state">
            <Sparkles size={24} className="empty-icon" />
            <p>No activity logs match your filter.</p>
          </div>
        )}
      </div>

      {/* Activity Detail Side Modal */}
      {selectedActivity && (
        <div className="activity-modal-backdrop" onClick={() => setSelectedActivity(null)}>
          <aside
            className="activity-side-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ "--agent-color": selectedActivity.agentColor }}
          >
            <div className="topclose">
              <button
                type="button"
                className="activity-modal-close"
                onClick={() => setSelectedActivity(null)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="activity-modal-header">
              <div className="modal-title-wrap">
                <span className="activity-type-tag">{selectedActivity.type}</span>
                <h2 className="modal-activity-title">{selectedActivity.action}</h2>
              </div>
            </div>

            <div className="activity-modal-agent-row">
              <span
                className="agent-dot"
                style={{
                  backgroundColor: selectedActivity.agentColor,
                  boxShadow: `0 0 10px ${selectedActivity.agentColor}`,
                }}
              />
              <span className="modal-agent-name">{selectedActivity.agent}</span>
              {selectedActivity.agentNode && (
                <span className="modal-agent-node">Node: {selectedActivity.agentNode}</span>
              )}
              <span className={`activity-status-badge status-${selectedActivity.status}`}>
                {selectedActivity.status.replace("_", " ")}
              </span>
            </div>

            <div className="activity-modal-grid">
              <div className="modal-spec-item">
                <span className="spec-label">Execution ID</span>
                <span className="spec-value code">EXEC-{String(selectedActivity.id).slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="modal-spec-item">
                <span className="spec-label">Timestamp</span>
                <span className="spec-value">{selectedActivity.timeLabel}</span>
              </div>
              <div className="modal-spec-item">
                <span className="spec-label">Trigger Source</span>
                <span className="spec-value">Vector Orchestrator</span>
              </div>
              <div className="modal-spec-item">
                <span className="spec-label">Category</span>
                <span className="spec-value highlight">{selectedActivity.category}</span>
              </div>
            </div>

            <div className="activity-modal-section">
              <span className="section-title">Execution Detail</span>
              <p className="modal-detail-desc">{selectedActivity.detail || "No additional detail recorded."}</p>
            </div>

            <div className="activity-modal-section">
              <span className="section-title">Raw Telemetry & Output Log</span>
              <div className="activity-log-box">
                <pre>
{`[${selectedActivity.time}] INVOCATION_START -> agent="${selectedActivity.agent}" node="${selectedActivity.agentNode || selectedActivity.agent}"
[${selectedActivity.time}] TARGET -> ${selectedActivity.action}
[${selectedActivity.time}] STATUS -> ${selectedActivity.status}
[${selectedActivity.time}] PAYLOAD -> ${selectedActivity.detail || "(none)"}
[${selectedActivity.time}] INVOCATION_END -> execution ${selectedActivity.status === "error" ? "failed" : "completed"}.`}
                </pre>
              </div>
            </div>

            <div className="activity-modal-footer">
              <button
                type="button"
                className="activity-modal-action-btn"
                onClick={() => setSelectedActivity(null)}
              >
                Close Trace
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}