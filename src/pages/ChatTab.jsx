import { useState, useEffect, useRef } from "react";
import {
  Send, Square, Plus, ChevronDown, Sparkles, MessageSquarePlus, History,
  MessageSquare, Trash2, FileText, FileImage, FileVideo, FileType2, X,
  Pin, PinOff, Download, Settings, Folder, Loader2, RotateCcw,
} from "lucide-react";
import { useChat } from "../context/ChatContext.jsx";
import ChatBubble from "./ChatBubble.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import SettingsModal from "./SettingsModal.jsx";

import { exportChatAsMarkdown, exportChatAsPDF } from "../utils/exportChat.js";
import "./ChatTab.css";
import PermissionModal from "./PermissionModal.jsx";
import { createPortal } from "react-dom";

const AGENT_MODELS = [
  {
    id: "ollama",
    name: "Ollama",
    agent: "Atlas",
    color: "#f5f5f5",
    rpm: "Unlimited",
    tpm: "Local GPU",
    usagePct: 5,
  },
  {
    id: "gemini_research",
    name: "Gemini",
    agent: "Igris",
    color: "#fbff00",
    rpm: "15 RPM",
    tpm: "1M TPM",
    usagePct: 35,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    agent: "Sora",
    color: "#ff9101",
    rpm: "20 RPM",
    tpm: "200k TPM",
    usagePct: 60,
  },
  {
    id: "dev",
    name: "Groq",
    agent: "Shiro",
    color: "#f800d7",
    rpm: "30 RPM",
    tpm: "14.4k TPM",
    usagePct: 40,
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    agent: "Johan",
    color: "#fc002e",
    rpm: "40 RPM",
    tpm: "500k TPM",
    usagePct: 20,
  },
  {
    id: "cohere",
    name: "Cohere",
    agent: "Light",
    color: "#00ee3b",
    rpm: "20 RPM",
    tpm: "100k TPM",
    usagePct: 15,
  },
  {
    id: "mistral",
    name: "Mistral",
    agent: "Armin",
    color: "#a78bfa",
    rpm: "30 RPM",
    tpm: "500k TPM",
    usagePct: 25,
  },
  {
    id: "huggingface",
    name: "HuggingFace",
    agent: "Reigen",
    color: "#0055ff",
    rpm: "10 RPM",
    tpm: "50k TPM",
    usagePct: 75,
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    agent: "Sinbad",
    color: "#00ffff",
    rpm: "50 RPM",
    tpm: "1M TPM",
    usagePct: 10,
  },
  {
    id: "zai",
    name: "ZAI",
    agent: "Sinbad",
    color: "#38bdf8",
    rpm: "60 RPM",
    tpm: "1M TPM",
    usagePct: 8,
  },
  {
    id: "coding",
    name: "Coding Agent",
    agent: "Sinbad",
    color: "#f472b6",
    rpm: "40 RPM",
    tpm: "800k TPM",
    usagePct: 12,
  },
];

const PASTE_WORD_THRESHOLD = 50;
const TEXTAREA_MAX_HEIGHT = 200;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50MB

const PROMPT_STARTERS = [
  {
    icon: "🚀",
    label: "Build UI Component",
    prompt:
      "Create a modern glassmorphic React UI component with smooth CSS animations.",
  },
  {
    icon: "⚡",
    label: "Optimize Query",
    prompt:
      "Write an optimized SQL query with indexing strategies for high-throughput tables.",
  },
  {
    icon: "🎨",
    label: "Design System",
    prompt:
      "Draft a dark space color palette and typography guidelines for a premium web app.",
  },
  {
    icon: "🛠️",
    label: "Debug Async Code",
    prompt:
      "Explain common memory leak patterns in asynchronous event loops and how to solve them.",
  },
];

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

function wordCount(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function makeId() {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeTextAttachment(text, words) {
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 120);
  return {
    id: makeId(),
    kind: "text",
    text,
    words,
    snippet,
    name: `Pasted text (${words} words)`,
  };
}

function capitalizeFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Convert a File to a base64 data URL so it survives page reloads AND
// survives being sent (see handleSubmit — it used to revoke blob URLs
// right after sendMessage(), which broke image previews inside sent
// chat bubbles since the blob no longer resolved to anything).
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Build a chat-composer attachment. Images use a persistent base64 dataUrl
// (survives sending + reload); videos still use a blob URL since they
// aren't re-rendered the same way after send.
async function makeFileAttachment(file) {
  const isImage = file.type.startsWith("image/");
  const isVideo =
    file.type.startsWith("video/") || file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i);
  const isPdf = file.type === "application/pdf" || file.name.match(/\.pdf$/i);

  let previewUrl = null;
  if (isImage || isVideo) {
    try {
      previewUrl = await fileToDataUrl(file);
    } catch {
      previewUrl = null;
    }
  }

  return {
    id: makeId(),
    kind: isVideo ? "video" : isImage ? "image" : isPdf ? "pdf" : "file",
    file,
    name:
      file.name ||
      (isVideo ? "Video file" : isImage ? "Image file" : isPdf ? "PDF file" : "Attached file"),
    previewUrl,
  };
}


export default function ChatTab() {
  const {
    messages,
    sendMessage,
    stopSending,
    isSending,
    sessionList,
    activeSessionId,
    startNewChat,
    switchChat,
    deleteChat,
    duplicateSession,
    searchHistory,
    togglePin,
    getDraft,
    setDraft,
    loaded,
    activeSessionLoaded,
    permissionRequest,
    respondToPermission,
  } = useChat();

  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [selectedModel, setSelectedModel] = useState(AGENT_MODELS[0]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [oversizeError, setOversizeError] = useState(null); // { names: string[] } | null
  const [previewImage, setPreviewImage] = useState(null); // { url, name }
  const [loadedThumbIds, setLoadedThumbIds] = useState(() => new Set());

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("vector_user_settings");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      defaultAgent: "dev",
      defaultFallback: false,
      showRateLimits: true,
      exportFormat: "markdown",
    };
  });

  const historyRef = useRef(null);
  const scrollRegionRef = useRef(null);
  const dropdownRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const isNearBottomRef = useRef(true);

  


  useEffect(() => {
  if (isNearBottomRef.current) {
    scrollToBottom("auto");
  }
}, [messages.length]);

useEffect(() => {
  if (activeSessionLoaded && messages.length > 0) {
    requestAnimationFrame(() => scrollToBottom("auto"));
  }
}, [activeSessionId, activeSessionLoaded]);

  useEffect(() => {
    if (settings.defaultAgent) {
      const match = AGENT_MODELS.find((m) => m.id === settings.defaultAgent);
      if (match) setSelectedModel(match);
    }
  }, []);

  useEffect(() => {
    setValue(getDraft(activeSessionId));
  }, [activeSessionId, getDraft]);

  // Splits raw Files into ones under the size cap and ones over it.
  // Used by every attach path (picker, drop, paste) so the limit is
  // enforced consistently and the same modal fires no matter how the
  // file arrived. Defined with `function` (hoisted) so it's safe to
  // reference from handlers defined above or below it.
  function splitBySizeLimit(files) {
    const valid = [];
    const oversized = [];
    for (const f of files) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        oversized.push(f);
      } else {
        valid.push(f);
      }
    }
    if (oversized.length > 0) {
      setOversizeError({
        names: oversized.map((f) => `${f.name} (${formatBytes(f.size)})`),
      });
    }
    return valid;
  }



  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem("vector_user_settings", JSON.stringify(newSettings));
    } catch {}
  };

  const handleExportChat = () => {
    const currentSession = sessionList.find(
      (s) => s.id === activeSessionId,
    ) || {
      id: activeSessionId || "current",
      title: "Active Chat",
      messages,
      createdAt: Date.now(),
    };

    if (settings.exportFormat === "pdf") {
      exportChatAsPDF(currentSession);
    } else {
      exportChatAsMarkdown(currentSession);
    }
  };

  const checkNearBottom = () => {
    const el = scrollRegionRef.current;
    if (!el) return true;
    const threshold = 120;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  const scrollToBottom = (behavior = "smooth") => {
    const el = scrollRegionRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useEffect(() => {
    const el = scrollRegionRef.current;
    if (!el) return;

    const handleScroll = () => {
      const nearBottom = checkNearBottom();
      isNearBottomRef.current = nearBottom;
      setShowScrollButton(!nearBottom);
    };

    el.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom("auto");
    }
  }, [messages.length]);

  useEffect(() => {
    const el = scrollRegionRef.current;
    if (!el) return;

    let debounceTimer = null;
    const resizeObserver = new ResizeObserver(() => {
      if (!isNearBottomRef.current) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        scrollToBottom("auto");
      }, 80);
    });

    resizeObserver.observe(el);
    return () => {
      clearTimeout(debounceTimer);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setModelDropdownOpen(false);
      }
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY =
      el.scrollHeight > TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
  };

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  const handleChange = (event) => {
    const next = event.target.value;
    setValue(next);
    setDraft(activeSessionId, next);
  };

  

  const handlePaste = (event) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const files = Array.from(clipboard.items || [])
      .map((item) => (item.kind === "file" ? item.getAsFile() : null))
      .filter(Boolean);

    if (files.length > 0) {
      event.preventDefault();
      const validFiles = splitBySizeLimit(files);
      if (validFiles.length === 0) return;
      Promise.all(validFiles.map(makeFileAttachment)).then((chatAtts) => {
        setAttachments((prev) => [...prev, ...chatAtts]);
      });
      return;
    }

    const text = clipboard.getData("text");
    if (!text) return;

    const words = wordCount(text);
    if (words > PASTE_WORD_THRESHOLD) {
      event.preventDefault();
      setAttachments((prev) => [...prev, makeTextAttachment(text, words)]);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilePicked = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      const validFiles = splitBySizeLimit(files);
      if (validFiles.length > 0) {
        const chatAtts = await Promise.all(validFiles.map(makeFileAttachment));
        setAttachments((prev) => [...prev, ...chatAtts]);
      }
    }
    event.target.value = "";
  };

  const handleRemoveAttachment = (id) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      // Only blob: URLs (videos now — images are base64 and don't need this)
      // actually need revoking; calling revokeObjectURL on a data: URL is a
      // harmless no-op, but the kind check keeps intent clear.
      if (target?.kind === "video" && target.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

const handleSubmit = (event) => {
  event.preventDefault();
  if (isSending || isHistoryLoading) return;

  const typed = value.trim();
  if (!typed && attachments.length === 0) return;

  sendMessage(typed, attachments, selectedModel.id, settings.defaultFallback);

  isNearBottomRef.current = true;
  scrollToBottom("auto");

  setValue("");
  setAttachments([]);
  requestAnimationFrame(resizeTextarea);
};

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const handleDeleteHistory = (e, id) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (pendingDeleteId) {
      deleteChat(pendingDeleteId);
    }
    setPendingDeleteId(null);
  };

  const ModelPicker = ({ dropdownDirection = "down" }) => (
    <div className="chat-model-picker-wrap" ref={dropdownRef}>
      <button
        type="button"
        className="chat-model-picker-btn"
        disabled={isSending}
        title={
          isSending
            ? "Can't switch models while waiting for a reply"
            : undefined
        }
        onClick={() => {
          if (isSending) return;
          setModelDropdownOpen((prev) => !prev);
        }}
      >
        <span
          className="chat-model-dot"
          style={{
            backgroundColor: selectedModel.color,
            boxShadow: `0 0 8px ${selectedModel.color}`,
          }}
        />
        <span className="chat-model-name">{selectedModel.name}</span>
        {settings.showRateLimits !== false && (
          <span
            className="chat-model-quota-pill"
            style={{
              borderColor:
                selectedModel.usagePct > 80
                  ? "rgba(248, 113, 113, 0.4)"
                  : "rgba(255, 255, 255, 0.12)",
              color: selectedModel.usagePct > 80 ? "#f87171" : "#a78bfa",
            }}
          >
            {selectedModel.usagePct}%
          </span>
        )}
        <ChevronDown
          size={14}
          className={`chat-model-chevron ${modelDropdownOpen ? "open" : ""}`}
        />
      </button>

      {modelDropdownOpen && !isSending && (
        <div className={`chat-model-dropdown dir-${dropdownDirection}`}>
          <div className="chat-model-dropdown-header">Select Model Agent</div>
          {AGENT_MODELS.map((model) => {
            const usageColor =
              model.usagePct > 80
                ? "#f87171"
                : model.usagePct > 50
                  ? "#fbbf24"
                  : "#4ade80";
            return (
              <button
                key={model.id}
                type="button"
                className={`chat-model-option ${selectedModel.id === model.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedModel(model);
                  setModelDropdownOpen(false);
                }}
              >
                <span
                  className="chat-model-dot"
                  style={{
                    backgroundColor: model.color,
                    boxShadow: `0 0 6px ${model.color}`,
                  }}
                />
                <div className="chat-model-option-info">
                  <span className="chat-model-opt-name">{model.name}</span>
                  <span className="chat-model-opt-agent">{model.agent}</span>
                </div>
                {settings.showRateLimits !== false && (
                  <div className="chat-model-telemetry">
                    <span className="telemetry-rpm">{model.rpm}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // `loaded` comes from ChatContext and flips to true once the initial
  // Supabase fetch (sessions + messages) resolves. `activeSessionLoaded`
  // flips to true once the CURRENT session's own messages are fetched
  // (lazy-loaded per session) — both together prevent flashing the
  // "Hello Mister" empty state while a real chat's messages are en route.
  const isHistoryLoading = !loaded || !activeSessionLoaded;
  const hasMessages = messages.length > 0;
  const isEmpty = !hasMessages && !isHistoryLoading;

  return (
    <div className="chat-tab">

      <div className="chat-main-area">
        <div className="chat-tab-header">
          <div className="chat-tab-header-left">
            {/* VECTOR */}
            
            <div className="chat-history-wrap" ref={historyRef}>
              <button
                type="button"
                className="chat-history-toggle"
                onClick={() => setHistoryOpen((prev) => !prev)}
                title="Chat history"
              >
                <History size={16} strokeWidth={2.5} />
                <ChevronDown
                  size={13}
                  className={`chat-history-chevron ${historyOpen ? "open" : ""}`}
                />
              </button>

              {historyOpen && (
                <div className="chat-history-dropdown">
                  <input
                    type="text"
                    className="chat-history-search"
                    placeholder="Search chats..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />

                  <button
                    type="button"
                    className="chat-history-new-item"
                    onClick={() => {
                      if (messages.length === 0) return;
                      startNewChat();
                      setHistoryOpen(false);
                    }}
                    disabled={messages.length === 0}
                    title={
                      messages.length === 0
                        ? "New chat already active"
                        : "New chat"
                    }
                  >
                    <MessageSquarePlus size={14} />
                    <span>New chat</span>
                  </button>

                  <div className="chat-history-dropdown-header">
                    {historySearch ? "Results" : "Recents"}
                  </div>
                  {(historySearch
                    ? searchHistory(historySearch)
                    : sessionList.map((s) => ({
                        sessionId: s.id,
                        sessionTitle: s.title,
                        snippet: null,
                      }))
                  ).map((item) => (
                    <div
                      key={item.messageId || item.sessionId}
                      className={`chat-history-item ${activeSessionId === item.sessionId ? "active" : ""}`}
                      onClick={() => {
                        switchChat(item.sessionId);
                        setHistoryOpen(false);
                        setHistorySearch("");
                      }}
                    >
                      <MessageSquare size={14} className="history-icon" />
                      <div className="history-text">
                        <span className="history-title">
                          {capitalizeFirst(item.sessionTitle)}
                        </span>
                        {item.snippet && (
                          <span className="history-snippet">
                            {item.snippet}
                          </span>
                        )}
                      </div>
                      {!historySearch && (
                        <>
                          <button
                            type="button"
                            className="history-pin-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(item.sessionId);
                            }}
                            title={
                              sessionList.find((s) => s.id === item.sessionId)
                                ?.pinned
                                ? "Unpin"
                                : "Pin"
                            }
                          >
                            {sessionList.find((s) => s.id === item.sessionId)
                              ?.pinned ? (
                              <Pin size={12} fill="currentColor" />
                            ) : (
                              <PinOff size={12} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="history-delete-btn"
                            onClick={(e) =>
                              handleDeleteHistory(e, item.sessionId)
                            }
                            title="Delete conversation"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="chat-tab-header-right">
            <button
              type="button"
              className="chat-header-btn"
              onClick={handleExportChat}
              title={`Export conversation as ${settings.exportFormat === "pdf" ? "PDF" : "Markdown"}`}
            >
              <Download size={15} />
            </button>

            <button
              type="button"
              className="chat-header-btn"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings size={15} />
            </button>

            <ModelPicker dropdownDirection="down" />
          </div>
        </div>

        <div className={`chat-tab-body ${isEmpty ? "is-empty" : ""}`}>
          <div className="chat-scroll-region" ref={scrollRegionRef}>
            {isHistoryLoading ? (
              <div className="chat-history-loading">
                <div className="vector-glossy-wrap">
                  <span className="vector-glossy-ghost" aria-hidden="true">
                    Vector
                  </span>
                  <span className="vector-glossy-text">Vector</span>
                </div>
              </div>
            ) : (
              <div className="chat-thread">
                {!isEmpty &&
                  messages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      msg={msg}
                      agentId={selectedModel.id}
                      sessionId={activeSessionId}
                      useFallback={settings.defaultFallback}
                    />
                  ))}
              </div>
            )}
          </div>

          <div className="chat-composer-cluster">
            {showScrollButton && !isEmpty && (
              <button
                type="button"
                className="chat-scroll-to-bottom"
                onClick={() => scrollToBottom("smooth")}
                aria-label="Scroll to latest message"
              >
                <ChevronDown size={16} />
              </button>
            )}

            {isEmpty && (
              <div className="chat-greeting-block">
                <Sparkles size={35} style={{ color: selectedModel.color }} />{" "}
                <h2 className="chat-greeting-title">Hello Mister</h2>
              </div>
            )}

            <div className="chat-tab-card-wrap">
              <form className="chat-tab-card" onSubmit={handleSubmit}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.json,.py,.js"
                  className="chat-file-input-hidden"
                  onChange={handleFilePicked}
                />

                {attachments.length > 0 && (
                  <div className="chat-paste-attachments-row">
                    {attachments.map((attachment) => {
                      const isMedia =
                        attachment.kind === "image" ||
                        attachment.kind === "video";
                      const ICONS = {
                        text: FileText,
                        pdf: FileType2,
                        file: FileImage,
                      };
                      const Icon = ICONS[attachment.kind] || FileImage;
                      const meta =
                        attachment.kind === "text"
                          ? `Pasted · ${attachment.words} words`
                          : attachment.kind === "pdf"
                            ? `PDF · ${formatBytes(attachment.file?.size ?? 0)}`
                            : `File · ${formatBytes(attachment.file?.size ?? 0)}`;

                      return (
                        <div
                          key={attachment.id}
                          className={`chat-paste-chip is-${attachment.kind}`}
                        >
                          {attachment.kind === "image" && (
                            <div className="chat-paste-chip-media">
                              {!loadedThumbIds.has(attachment.id) && (
                                <div className="chat-paste-chip-skeleton" />
                              )}
                              <img
                                src={attachment.previewUrl}
                                alt={attachment.name}
                                className="chat-paste-chip-thumb"
                                style={{
                                  opacity: loadedThumbIds.has(attachment.id)
                                    ? 1
                                    : 0,
                                }}
                                onLoad={() =>
                                  setLoadedThumbIds((prev) => {
                                    const next = new Set(prev);
                                    next.add(attachment.id);
                                    return next;
                                  })
                                }
                                onClick={() =>
                                  setPreviewImage({
                                    url: attachment.previewUrl,
                                    name: attachment.name,
                                  })
                                }
                              />
                            </div>
                          )}

                          {attachment.kind === "video" &&
                            (attachment.previewUrl ? (
                              <div className="chat-paste-chip-media">
                                <video
                                  src={attachment.previewUrl}
                                  className="chat-paste-chip-thumb"
                                  muted
                                />
                              </div>
                            ) : (
                              <div className="chat-paste-chip-icon">
                                <FileVideo size={14} />
                              </div>
                            ))}

                          {!isMedia && (
                            <>
                              <div className="chat-paste-chip-body">
                                {attachment.kind === "text" ? (
                                  <div className="chat-paste-chip-snippet">
                                    {attachment.snippet}
                                  </div>
                                ) : (
                                  <div className="chat-paste-chip-filename">
                                    {attachment.name}
                                  </div>
                                )}
                                                                <span className="chat-paste-chip-meta">
                                  {meta}
                                </span>
                              </div>
                            </>
                          )}

                          <button
                            type="button"
                            className="chat-paste-chip-remove"
                            onClick={() =>
                              handleRemoveAttachment(attachment.id)
                            }
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  aria-label="Chat message"
                  className="chat-input"
                  rows={1}
                  value={value}
                  onChange={handleChange}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isHistoryLoading
                      ? "Loading your conversations..."
                      : isSending
                        ? "Waiting for a reply..."
                        : `Ask ${selectedModel.name} (${selectedModel.agent}) anything...`
                  }
                  disabled={isHistoryLoading}
                />
                <div className="chat-card-row">
                  <button
                    type="button"
                    className="chat-attach-btn"
                    onClick={handleAttachClick}
                    aria-label="Attach a file or image"
                    title="Attach a file or image"
                    disabled={isHistoryLoading}
                  >
                    <Plus size={20} />
                  </button>
                  <button
                    type={isSending ? "button" : "submit"}
                    className={`chat-action ${isSending ? "is-sending" : "is-send"}`}
                    aria-label={isSending ? "Stop generating" : "Send message"}
                    onClick={isSending ? stopSending : undefined}
                    title={isSending ? "Stop" : undefined}
                    disabled={isHistoryLoading}
                  >
                    {isSending ? (
                      <Square
                        className="chat-action-icon"
                        size={14}
                        strokeWidth={2}
                        fill="currentColor"
                      />
                    ) : (
                      <Send
                        className="chat-action-icon"
                        size={16}
                        strokeWidth={2}
                        style={{
                          transform: "rotate(40deg)",
                          left: "-2px",
                          top: "-0.5px",
                        }}
                      />
                    )}
                  </button>
                </div>
              </form>
            </div>

            {isEmpty && (
              <div className="chat-prompt-starters">
                {PROMPT_STARTERS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="chat-starter-chip"
                    onClick={() => {
                      setValue(item.prompt);
                      requestAnimationFrame(resizeTextarea);
                    }}
                  >
                    <span className="starter-icon">{item.icon}</span>
                    <span className="starter-label">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="chat-bottom-spacer" />
        </div>
      </div>

      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete this chat?"
          message="This will permanently delete the conversation and its messages. This can't be undone."
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {oversizeError && (
        <ConfirmDialog
          title="File too large"
          message={`${oversizeError.names.join(", ")} exceed${oversizeError.names.length === 1 ? "s" : ""} the 50MB limit and ${oversizeError.names.length === 1 ? "wasn't" : "weren't"} attached.`}
          onConfirm={() => setOversizeError(null)}
          onCancel={() => setOversizeError(null)}
        />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <PermissionModal
        request={permissionRequest}
        onDecide={respondToPermission}
      />

      {previewImage &&
        createPortal(
          <div
            className="chat-image-lightbox"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="chat-image-lightbox-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="chat-image-lightbox-close"
                onClick={() => setPreviewImage(null)}
                title="Close"
              >
                <X size={16} />
              </button>
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="chat-image-lightbox-img"
              />
              <div className="chat-image-lightbox-details">
                <span className="chat-image-lightbox-name">
                  {previewImage.name}
                </span>
                <span className="chat-image-lightbox-meta">Image</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}