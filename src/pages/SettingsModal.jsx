import React from "react";
import { X, Settings, ShieldCheck, Zap, Download, Gauge } from "lucide-react";
import "./SettingsModal.css";

const AGENT_OPTIONS = [
  { id: "ollama", name: "Ollama (Atlas)" },
  { id: "gemini_research", name: "Gemini (Igris)" },
  { id: "openrouter", name: "OpenRouter (Sora)" },
  { id: "dev", name: "Groq (Shiro)" },
  { id: "nvidia", name: "NVIDIA (Johan)" },
  { id: "cohere", name: "Cohere (Light)" },
  { id: "mistral", name: "Mistral (Armin)" },
  { id: "huggingface", name: "HuggingFace (Reigen)" },
  { id: "siliconflow", name: "SiliconFlow (Sinbad)" },
  { id: "zai", name: "ZAI (Sinbad)" },
  { id: "coding", name: "Coding Agent (Sinbad)" },
];

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) {
  if (!isOpen) return null;

  const handleChange = (key, value) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <div className="settings-modal-title">
            <Settings size={20} className="settings-header-icon" />
            {/* <h2>Vector Settings</h2> */}
          </div>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-modal-body">
          {/* Default Agent Preference */}
          <div className="settings-group">
            <div className="settings-group-header">
              <Zap size={16} className="group-icon" />
              <div>
                <label className="settings-label">Default Model Agent</label>
                <p className="settings-desc">
                  Selected agent model for new conversations.
                </p>
              </div>
            </div>
            <select
              className="settings-select"
              value={settings.defaultAgent || "dev"}
              onChange={(e) => handleChange("defaultAgent", e.target.value)}
            >
              {AGENT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-fallback Default */}
          <div className="settings-group">
            <div className="settings-group-header">
              <ShieldCheck size={16} className="group-icon" />
              <div>
                <label className="settings-label">Auto-Fallback Default</label>
                <p className="settings-desc">
                  Enable auto-fallback retry chain on launch.
                </p>
              </div>
            </div>
            <label className="settings-toggle-switch">
              <input
                type="checkbox"
                checked={!!settings.defaultFallback}
                onChange={(e) => handleChange("defaultFallback", e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Telemetry & Rate Limits */}
          <div className="settings-group">
            <div className="settings-group-header">
              <Gauge size={16} className="group-icon" />
              <div>
                <label className="settings-label">Show Rate Limit Meter</label>
                <p className="settings-desc">
                  Display provider RPM/TPM ceiling telemetry badges.
                </p>
              </div>
            </div>
            <label className="settings-toggle-switch">
              <input
                type="checkbox"
                checked={settings.showRateLimits !== false}
                onChange={(e) => handleChange("showRateLimits", e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Preferred Export Format */}
          <div className="settings-group">
            <div className="settings-group-header">
              <Download size={16} className="group-icon" />
              <div>
                <label className="settings-label">Default Export Format</label>
                <p className="settings-desc">
                  Preferred format for quick single-click exports.
                </p>
              </div>
            </div>
            <select
              className="settings-select"
              value={settings.exportFormat || "markdown"}
              onChange={(e) => handleChange("exportFormat", e.target.value)}
            >
              <option value="markdown">Markdown (.md)</option>
              <option value="pdf">PDF Document (.pdf)</option>
            </select>
          </div>
        </div>

        {/* <div className="settings-modal-footer">
          <button type="button" className="settings-save-btn" onClick={onClose}>
            Done
          </button>
        </div> */}
      </div>
    </div>
  );
}
