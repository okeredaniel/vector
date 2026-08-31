import { memo, useEffect, useState, useRef } from "react";
import {
  FileText,
  FileImage,
  FileVideo,
  Copy,
  Check,
  Pencil,
  X,
  RefreshCw,
  Bookmark,
} from "lucide-react";
import { useChat } from "../context/ChatContext.jsx";
import StatusIndicator from "./StatusIndicator.jsx";
import MarkdownMessage from "./MarkdownMessage.jsx";
import "./ChatBubble.css";
import { createPortal } from "react-dom";

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startTs, endTs) {
  if (!startTs || !endTs) return null;
  const seconds = Math.round((endTs - startTs) / 1000);
  return seconds < 1 ? "under a second" : `${seconds}s`;
}

function formatVideoTime(t) {
  if (!t || isNaN(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function VideoAttachment({ src }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
    setCurrentTime(v.currentTime);
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (v) setDuration(v.duration);
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  };

  return (
    <div className="chat-video-wrap" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={src}
        className="chat-bubble-video-player"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="chat-video-controls" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="chat-video-play-btn" onClick={togglePlay}>
          {isPlaying ? (
            <span className="chat-video-pause-icon" />
          ) : (
            <span className="chat-video-play-icon" />
          )}
        </button>
        <div className="chat-video-bar" onClick={handleSeek}>
          <div className="chat-video-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="chat-video-time">
          {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
        </span>
      </div>
    </div>
  );
}

function ChatBubble({ msg, agentId, sessionId, useFallback = false }) {
  const { editAndResend, regenerate, consumeFreshFlag } = useChat();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.text || "");
  const [displayText, setDisplayText] = useState(msg.text || "");
  const [previewImage, setPreviewImage] = useState(null); // { url, name }
  const hasAnimatedRef = useRef(false);
  const isPending = msg.status === "pending";
  const isUser = msg.sender === "user";
  const canCopy = !isPending && msg.text;
  const hasAttachments = msg.attachments && msg.attachments.length > 0;
const hasTypedText = msg.text && msg.text.trim().length > 0;
const showBubble = !(isUser && !isPending && !isEditing && !hasTypedText && hasAttachments);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(msg.text || "");
    }
  }, [msg.text, isEditing]);

  useEffect(() => {
    if (isPending || isUser) return;

    if (hasAnimatedRef.current) {
      setDisplayText(msg.text || "");
      return;
    }
    hasAnimatedRef.current = true;

    const fullText = msg.text || "";
    const shouldAnimate = fullText.length > 0 && consumeFreshFlag(msg.id);

    if (!shouldAnimate) {
      setDisplayText(fullText);
      return;
    }

    setDisplayText("");
    const intervalMs = 16;
    const maxDurationMs = 900;
    const totalTicks = Math.max(1, Math.round(maxDurationMs / intervalMs));
    const chunkSize = Math.max(1, Math.ceil(fullText.length / totalTicks));

    let i = 0;
    const interval = setInterval(() => {
      i += chunkSize;
      if (i >= fullText.length) {
        setDisplayText(fullText);
        clearInterval(interval);
      } else {
        setDisplayText(fullText.slice(0, i));
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPending, isUser, msg.id, msg.text, consumeFreshFlag]);

  const handleCopy = () => {
    if (!canCopy) return;
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleEditSave = () => {
    if (!editValue.trim()) return;
    editAndResend(msg.id, editValue.trim(), agentId, useFallback);
    setIsEditing(false);
  };

  const duration =
    !isPending && msg.doneTime ? formatDuration(msg.time, msg.doneTime) : null;

  return (
    <div className={`chat-bubble-row ${msg.sender}`}>
      {msg.attachments && msg.attachments.length > 0 && (
        <div className="chat-bubble-attachments">
          {msg.attachments.map((attachment) => (
            <div key={attachment.id} className="chat-paste-chip">
              {attachment.kind === "video" ? (
                <VideoAttachment src={attachment.previewUrl} />
              ) : attachment.kind === "image" ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className="chat-paste-chip-thumb"
                  onClick={() =>
                    setPreviewImage({
                      url: attachment.previewUrl,
                      name: attachment.name,
                    })
                  }
                />
              ) : (
                <div className="chat-paste-chip-icon">
                  {attachment.kind === "text" ? (
                    <FileText size={14} />
                  ) : (
                    <FileImage size={14} />
                  )}
                </div>
              )}
              {attachment.kind !== "image" && attachment.kind !== "video" && (
                <div className="chat-paste-chip-body">
                  <span className="chat-paste-chip-snippet">
                    {attachment.kind === "text"
                      ? attachment.snippet
                      : attachment.name}
                  </span>
                  <span className="chat-paste-chip-meta2">
                    {attachment.kind === "text"
                      ? `Pasted • ${attachment.words} words`
                      : attachment.kind}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      
      {showBubble && (
  <div className={`chat-bubble ${msg.sender}`}>
    {isPending ? (
      <StatusIndicator
        label={msg.statusLabel || "Contemplating"}
        iconKey={msg.statusIcon || "sparkle"}
        steps={msg.steps || []}
      />
    ) : isEditing ? (
      <div className="chat-bubble-edit">
        <textarea
          className="chat-bubble-edit-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          rows={3}
        />
        <div className="chat-bubble-edit-actions">
          <button type="button" className="chat-bubble-edit-save" onClick={handleEditSave}>
            Save & resend
          </button>
          <button type="button" className="chat-bubble-edit-cancel" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <>
        {duration && msg.sender !== "user" && (
          <div className="chat-bubble-thought-time">Thought for {duration}</div>
        )}
        {displayText && <MarkdownMessage text={displayText} />}
      </>
    )}

    {!isPending && !isUser && (
      <div className="chat-bubble-footer assistant">
        <span className="chat-bubble-time">{formatTime(msg.time)}</span>
        <button type="button" className="chat-bubble-copy" onClick={handleCopy} title="Copy message">
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        {msg.status !== "error" && (
          <button
            type="button"
            className="chat-bubble-regen-btn"
            onClick={() => regenerate(msg.id, agentId, useFallback)}
            title="Regenerate response"
          >
            <RefreshCw size={12} />
          </button>
        )}
        {msg.status === "error" && (
          <button type="button" className="chat-bubble-retry-btn" onClick={() => regenerate(msg.id, agentId, useFallback)}>
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>
    )}
  </div>
)}

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

export default memo(ChatBubble);