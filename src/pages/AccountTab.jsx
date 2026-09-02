import { useState } from "react";
import "./AccountTab.css";


// ── Tool section data derived from the backend tools folder ──────────────
const TOOL_SECTIONS = [
  {
    id: "weather",
    icon: "🌤",
    label: "Weather",
    color: "#38bdf8",
    description: "Get real-time weather for any city.",
    fields: [{ key: "location", placeholder: "City name (e.g. Lagos)", label: "Location" }],
    action: "Get Weather",
  },
  {
    id: "finance",
    icon: "💹",
    label: "Finance",
    color: "#4ade80",
    description: "Live exchange rates & crypto prices.",
    tabs: ["Exchange Rate", "Crypto Price"],
    variants: [
      {
        fields: [
          { key: "base_currency", placeholder: "From (e.g. USD)", label: "Base Currency" },
          { key: "target_currency", placeholder: "To (e.g. NGN)", label: "Target Currency" },
        ],
        action: "Get Rate",
      },
      {
        fields: [
          { key: "coin", placeholder: "Coin name (e.g. bitcoin)", label: "Coin" },
          { key: "vs_currency", placeholder: "vs currency (e.g. usd)", label: "Vs Currency" },
        ],
        action: "Get Price",
      },
    ],
  },
  {
    id: "tts",
    icon: "🔊",
    label: "Text to Speech",
    color: "#f472b6",
    description: "Convert any text to an MP3 audio file.",
    fields: [
      { key: "text", placeholder: "Type something to speak...", label: "Text", textarea: true },
      { key: "voice", placeholder: "e.g. en-US-AriaNeural", label: "Voice" },
    ],
    action: "Generate Audio",
    voices: [
      "en-US-AriaNeural",
      "en-US-GuyNeural",
      "en-US-JennyNeural",
      "en-GB-SoniaNeural",
      "en-GB-RyanNeural",
      "en-NG-EzinneNeural",
      "en-NG-AbeoNeural",
      "en-AU-NatashaNeural",
      "en-IN-NeerjaNeural",
    ],
  },
  {
    id: "web",
    icon: "🔍",
    label: "Web Search",
    color: "#fb923c",
    description: "Search the web via Tavily and get summarised results.",
    fields: [{ key: "query", placeholder: "Search for anything...", label: "Query" }],
    action: "Search",
  },
  {
    id: "notes",
    icon: "📝",   
    label: "Notes",
    color: "#a78bfa",
    description: "List, read, and search your notes folder.",
    tabs: ["List Notes", "Read Note", "Search Notes"],
    variants: [
      { fields: [], action: "List All Notes" },
      { fields: [{ key: "filename", placeholder: "e.g. test.pdf", label: "Filename" }], action: "Read Note" },
      { fields: [{ key: "query", placeholder: "Keyword to find...", label: "Search Query" }], action: "Search Notes" },
    ],
  },
  {
    id: "youtube",
    icon: "▶️",
    label: "YouTube",
    color: "#f87171",
    description: "Upload videos to YouTube with title, description, and privacy settings.",
    fields: [
      { key: "file_path", placeholder: "Local file path", label: "File Path" },
      { key: "title", placeholder: "Video title", label: "Title" },
      { key: "description", placeholder: "Video description", label: "Description", textarea: true },
      { key: "privacy_status", placeholder: "private / public / unlisted", label: "Privacy" },
    ],
    action: "Upload to YouTube",
  },
  {
    id: "audio",
    icon: "🎵",
    label: "Audio Tools",
    color: "#fbbf24",
    description: "Search & download music, or duck audio in a video clip.",
    tabs: ["Search Music", "Download Music", "Duck Audio"],
    variants: [
      {
        fields: [
          { key: "query", placeholder: "e.g. lo-fi chill no copyright", label: "Search Query" },
          { key: "count", placeholder: "Number of results (default 5)", label: "Count" },
        ],
        action: "Search Music",
      },
      {
        fields: [
          { key: "url", placeholder: "YouTube URL", label: "Track URL" },
          { key: "output_name", placeholder: "output_name.mp3 (optional)", label: "Output Name" },
        ],
        action: "Download Music",
      },
      {
        fields: [
          { key: "video_path", placeholder: "Path to video file", label: "Video Path" },
          { key: "music_path", placeholder: "Path to music file", label: "Music Path" },
          { key: "music_volume", placeholder: "Music volume 0-1 (default 0.3)", label: "Music Volume" },
        ],
        action: "Duck Audio",
      },
    ],
  },
  {
    id: "video",
    icon: "🎬",
    label: "Video Tools",
    color: "#22d3ee",
    description: "Transcribe, caption, and burn subtitles into video files.",
    tabs: ["Transcribe", "Generate Captions", "Burn Captions"],
    variants: [
      {
        fields: [{ key: "file_path", placeholder: "Path to video file", label: "File Path" }],
        action: "Transcribe Video",
      },
      {
        fields: [
          { key: "file_path", placeholder: "Path to video file", label: "File Path" },
          { key: "words_per_caption", placeholder: "Words per caption (default 4)", label: "Words Per Caption" },
        ],
        action: "Generate Captions (.srt)",
      },
      {
        fields: [
          { key: "video_path", placeholder: "Path to video file", label: "Video Path" },
          { key: "srt_path", placeholder: "Path to .srt file (optional)", label: "SRT Path" },
          { key: "font_size", placeholder: "Font size (default 18)", label: "Font Size" },
          { key: "font_color", placeholder: "e.g. white, yellow", label: "Font Color" },
          { key: "position", placeholder: "bottom / middle / top", label: "Position" },
        ],
        action: "Burn Captions",
      },
    ],
  },
  {
    id: "twitch",
    icon: "🟣",
    label: "Twitch Tools",
    color: "#c084fc",
    description: "Fetch VODs, download clips, and convert aspect ratios.",
    tabs: ["Latest VODs", "Top Clips", "Download Clip", "Convert Aspect"],
    variants: [
      {
        fields: [
          { key: "channel_url", placeholder: "https://www.twitch.tv/channelname", label: "Channel URL" },
          { key: "count", placeholder: "Number of VODs (default 5)", label: "Count" },
        ],
        action: "Get Latest VODs",
      },
      {
        fields: [
          { key: "channel_url", placeholder: "https://www.twitch.tv/channelname", label: "Channel URL" },
          { key: "count", placeholder: "Number of clips (default 10)", label: "Count" },
          { key: "period", placeholder: "7d / 30d / 24hr / all", label: "Period" },
        ],
        action: "Get Top Clips",
      },
      {
        fields: [
          { key: "clip_url", placeholder: "Twitch clip URL", label: "Clip URL" },
          { key: "output_name", placeholder: "output_name.mp4 (optional)", label: "Output Name" },
        ],
        action: "Download Clip",
      },
      {
        fields: [
          { key: "input_path", placeholder: "Path to video file", label: "Input Path" },
          { key: "aspect", placeholder: "9:16 / 16:9 / 1:1 / 4:5", label: "Aspect Ratio" },
        ],
        action: "Convert Aspect Ratio",
      },
    ],
  },
  {
    id: "files",
    icon: "📁",
    label: "File Tools",
    color: "#34d399",
    description: "Read, write, edit files and run shell commands.",
    tabs: ["List Files", "Read File", "Write File", "Run Command"],
    variants: [
      {
        fields: [{ key: "directory", placeholder: "Directory path (default: .)", label: "Directory" }],
        action: "List Files",
      },
      {
        fields: [{ key: "path", placeholder: "File path", label: "File Path" }],
        action: "Read File",
      },
      {
        fields: [
          { key: "path", placeholder: "File path", label: "File Path" },
          { key: "content", placeholder: "Content to write...", label: "Content", textarea: true },
        ],
        action: "Write File",
      },
      {
        fields: [{ key: "command", placeholder: "e.g. dir, echo hello", label: "Command" }],
        action: "Run Command",
      },
    ],
  },
  {
    id: "roblox",
    icon: "🎮",
    label: "Roblox Studio",
    color: "#e879f9",
    description: "Call Roblox Studio MCP tools directly from Vector.",
    tabs: ["List Tools", "Call Tool"],
    variants: [
      { fields: [], action: "List Studio Tools" },
      {
        fields: [
          { key: "tool_name", placeholder: "Tool name from list above", label: "Tool Name" },
          { key: "arguments", placeholder: '{"key": "value"}', label: "Arguments (JSON)" },
        ],
        action: "Call Studio Tool",
      },
    ],
  },
  {
    id: "monitors",
    icon: "👁",
    label: "Monitors",
    color: "#f59e0b",
    description: "Set up background watchers that alert you when a condition is met.",
    tabs: ["Create Monitor", "List Monitors", "Delete Monitor"],
    variants: [
      {
        fields: [
          { key: "description", placeholder: "e.g. Bitcoin drops below $60k", label: "Description" },
          { key: "check_task", placeholder: "Instruction for the agent to check", label: "Check Task", textarea: true },
          { key: "interval_minutes", placeholder: "Check every X minutes (default 30)", label: "Interval (mins)" },
          { key: "agent_id", placeholder: "Agent ID (default: dev)", label: "Agent ID" },
        ],
        action: "Create Monitor",
      },
      { fields: [], action: "List All Monitors" },
      {
        fields: [{ key: "monitor_id", placeholder: "Monitor ID", label: "Monitor ID" }],
        action: "Delete Monitor",
      },
    ],
  },
  {
    id: "self_extend",
    icon: "⚡",
    label: "Self-Extend",
    color: "#818cf8",
    description: "Request, review, approve or reject AI-generated tools.",
    tabs: ["Request Tool", "List Pending", "Approve Tool", "Reject Tool"],
    variants: [
      {
        fields: [
          { key: "description", placeholder: "Describe the tool you need...", label: "Description", textarea: true },
          { key: "suggested_name", placeholder: "snake_case_name (optional)", label: "Suggested Name" },
        ],
        action: "Request New Tool",
      },
      { fields: [], action: "List Pending Tools" },
      {
        fields: [{ key: "safe_name", placeholder: "Tool safe name", label: "Safe Name" }],
        action: "Approve Tool",
      },
      {
        fields: [{ key: "safe_name", placeholder: "Tool safe name", label: "Safe Name" }],
        action: "Reject Tool",
      },
    ],
  },
];

function FieldGroup({ fields, values, onChange, color }) {
  return (
    <div className="at-field-group">
      {fields.map((f) =>
        f.textarea ? (
          <label key={f.key} className="at-field-label">
            <span>{f.label}</span>
            <textarea
              className="at-textarea"
              style={{ "--tool-color": color }}
              placeholder={f.placeholder}
              value={values[f.key] || ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              rows={4}
            />
          </label>
        ) : (
          <label key={f.key} className="at-field-label">
            <span>{f.label}</span>
            <input
              className="at-input"
              style={{ "--tool-color": color }}
              type="text"
              placeholder={f.placeholder}
              value={values[f.key] || ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          </label>
        )
      )}
    </div>
  );
}

function ToolCard({ tool, index = 0 }) {
  const hasVariants = !!tool.variants;
  const [activeTab, setActiveTab] = useState(0);
  const [values, setValues] = useState({});
  const [voiceOpen, setVoiceOpen] = useState(false);

  const currentVariant = hasVariants ? tool.variants[activeTab] : tool;
  const currentFields = currentVariant.fields || [];
  const currentAction = currentVariant.action || tool.action;

  const handleChange = (key, val) => setValues((prev) => ({ ...prev, [key]: val }));

  return (
    <div
      className="at-tool-card"
      style={{
        "--tool-color": tool.color,
        animationDelay: `${index * 0.04}s`,
      }}
    >
      <div className="at-card-header">
        <div className="at-card-icon">{tool.icon}</div>
        <div className="at-card-meta">
          <h3 className="at-card-title">{tool.label}</h3>
          <p className="at-card-desc">{tool.description}</p>
        </div>
        <div className="at-card-dot" />
      </div>

      {hasVariants && (
        <div className="at-tabs">
          {tool.tabs.map((tab, i) => (
            <button
              key={tab}
              className={`at-tab ${activeTab === i ? "active" : ""}`}
              style={{ "--tool-color": tool.color }}
              onClick={() => { setActiveTab(i); setValues({}); }}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {tool.id === "tts" && (
        <div className="at-voice-picker">
          <button
            className="at-voice-toggle"
            style={{ "--tool-color": tool.color }}
            onClick={() => setVoiceOpen((v) => !v)}
          >
            {"\uD83C\uDF99"} Select Voice {voiceOpen ? "\u25B2" : "\u25BC"}
          </button>
          {voiceOpen && (
            <div className="at-voice-grid">
              {tool.voices.map((v) => (
                <button
                  key={v}
                  className={`at-voice-chip ${values.voice === v ? "selected" : ""}`}
                  style={{ "--tool-color": tool.color }}
                  onClick={() => { handleChange("voice", v); setVoiceOpen(false); }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <FieldGroup
        fields={currentFields}
        values={values}
        onChange={handleChange}
        color={tool.color}
      />

      <button
        className="at-action-btn"
        style={{ "--tool-color": tool.color }}
        onClick={() => console.log("[" + tool.id + "] action:", currentAction, values)}
      >
        {currentAction}
      </button>
    </div>
  );
}

export default function AccountTab() {
  const [search, setSearch] = useState("");

  const filtered = TOOL_SECTIONS.filter(
    (t) =>
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="account-tab">
      <div className="at-header">
        <div className="at-header-top">
          <h1 className="at-title">Tools</h1>
          <span className="at-badge">{TOOL_SECTIONS.length} tools</span>
        </div>
        <p className="at-subtitle">Backend tools ready to wire up — UI panels for every Vector tool.</p>
        <div className="at-search-wrap">
          <span className="at-search-icon">🔎</span>
          <input
            className="at-search"
            type="text"
            placeholder="Filter tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="at-grid">
        {filtered.map((tool, index) => (
          <ToolCard key={tool.id} tool={tool} index={index} />
        ))}
        {filtered.length === 0 && (
          <p className="at-empty">No tools match "{search}"</p>
        )}
      </div>
    </div>
  );
}
