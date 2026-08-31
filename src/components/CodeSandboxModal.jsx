import React, { useState, useRef, useEffect } from "react";
import { X, Play, Code2, RefreshCw, Copy, Check, Monitor, Terminal } from "lucide-react";
import "./CodeSandboxModal.css";
import ReactDOM from "react-dom";

const RENDERABLE_LANGS = ["html", "svg", "css", "javascript", "js", "jsx", "typescript", "ts"];

function buildSrcDoc(code, language) {
  const isHtml = language === "html" || code.includes("<!DOCTYPE") || code.includes("<html");

  if (isHtml) return code;

  if (language === "css") {
    return `<!DOCTYPE html><html><head><style>
      body { background: #0d0b14; color: #f3f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; margin: 0; }
      ${code}
    </style></head><body><div class="preview-box" id="app"><h2>CSS Preview</h2><p>Your styles are applied to this page.</p><button>Sample Button</button><input placeholder="Sample input"/></div></body></html>`;
  }

  // JS/TS
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d0b14; color: #f3f2f5; padding: 20px; margin: 0; font-size: 13.5px;
    }
    #output { white-space: pre-wrap; }
    .log-line { padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.04); line-height: 1.55; }
    .log-error { color: #f87171; }
    .log-warn  { color: #fbbf24; }
    .log-info  { color: #a78bfa; }
    .log-ok    { color: #4ade80; }
    .empty-msg { color: #8b85a3; font-style: italic; margin-top: 12px; }
  </style>
</head>
<body>
  <div id="output"></div>
  <script>
    const output = document.getElementById('output');
    const addLine = (text, cls) => {
      const d = document.createElement('div');
      d.className = 'log-line ' + (cls || '');
      d.textContent = text;
      output.appendChild(d);
    };
    const origLog   = console.log;
    const origWarn  = console.warn;
    const origError = console.error;
    const origInfo  = console.info;
    const fmt = (args) => args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ');
    console.log   = (...a) => { addLine('▶ ' + fmt(a), 'log-ok');    origLog(...a); };
    console.warn  = (...a) => { addLine('⚠ ' + fmt(a), 'log-warn');  origWarn(...a); };
    console.error = (...a) => { addLine('✖ ' + fmt(a), 'log-error'); origError(...a); };
    console.info  = (...a) => { addLine('ℹ ' + fmt(a), 'log-info');  origInfo(...a); };
    try {
      ${code}
      if (output.children.length === 0) {
        addLine('✓ Script executed with no console output.', 'log-info');
      }
    } catch(err) {
      addLine('✖ ' + err.toString(), 'log-error');
    }
  </script>
</body>
</html>`;
}

export default function CodeSandboxModal({ isOpen, onClose, code, language }) {
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState(0); // bump to re-run
  const [activeTab, setActiveTab] = useState("preview");
  const iframeRef = useRef(null);

  const lang = (language || "html").toLowerCase();
  const canRender = RENDERABLE_LANGS.includes(lang);
  const srcDoc = canRender ? buildSrcDoc(code, lang) : null;

  useEffect(() => {
    if (isOpen) setKey((k) => k + 1);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRerun = () => setKey((k) => k + 1);

    return ReactDOM.createPortal (
    <div className="sandbox-backdrop" onClick={onClose}>
      <div className="sandbox-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sandbox-header">
          <div className="sandbox-title">
            <div className="sandbox-title-icon">
              <Play size={13} />
            </div>
            <span className="sandbox-title-text">Live Code Sandbox</span>
            <span className="sandbox-lang-tag">{lang}</span>
          </div>

          <div className="sandbox-header-actions">
            {canRender && (
              <button
                type="button"
                className="sandbox-header-btn"
                onClick={handleRerun}
                title="Re-run"
              >
                <RefreshCw size={13} />
                <span>Re-run</span>
              </button>
            )}
            <button
              type="button"
              className="sandbox-header-btn"
              onClick={handleCopy}
              title="Copy code"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
            <button
              type="button"
              className="sandbox-close"
              onClick={onClose}
              aria-label="Close Sandbox"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab bar — only show when we have preview */}
        {canRender && (
          <div className="sandbox-tabs">
            <button
              type="button"
              className={`sandbox-tab ${activeTab === "preview" ? "active" : ""}`}
              onClick={() => setActiveTab("preview")}
            >
              <Monitor size={12} />
              Preview
            </button>
            <button
              type="button"
              className={`sandbox-tab ${activeTab === "code" ? "active" : ""}`}
              onClick={() => setActiveTab("code")}
            >
              <Code2 size={12} />
              Code
            </button>
          </div>
        )}

        {/* Body */}
        <div className="sandbox-body">
          {!canRender ? (
            /* Non-web language: show the code nicely */
            <div className="sandbox-non-renderable">
              <div className="sandbox-nr-banner">
                <Terminal size={16} />
                <span>
                  <strong>{lang}</strong> can't be run in the browser — showing the source below.
                  Copy it and run it in your local environment.
                </span>
              </div>
              <pre className="sandbox-code-view"><code>{code}</code></pre>
            </div>
          ) : activeTab === "preview" ? (
            <iframe
              key={key}
              ref={iframeRef}
              title="Live Code Preview"
              className="sandbox-iframe"
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-modals allow-forms"
            />
          ) : (
            /* Code view tab */
            <div className="sandbox-code-panel">
              <pre className="sandbox-code-view"><code>{code}</code></pre>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="sandbox-statusbar">
          <span className="statusbar-dot" style={{ background: canRender ? "#4ade80" : "#fbbf24" }} />
          <span>{canRender ? "Rendered in sandboxed iframe" : "Source only — server-side language"}</span>
          <span className="statusbar-sep" />
          <span>{code.split("\n").length} lines</span>
        </div>
      </div>
    </div>,
      document.body
  );
}
