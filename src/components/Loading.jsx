import { useEffect, useRef, useState } from "react";
import { Sparkles, Cpu, Zap, CheckCircle2 } from "lucide-react";
import "./Loading.css";

const FONT_SIZE = 14;
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=-/\\";
const WORDS = ["ATLAS", "IGRIS", "SORA", "SHIRO", "JOHAN", "LIGHT", "ARMIN", "REIGEN", "VECTOR"];
const COLORS = ["#f472b6", "#ec4899", "#db2777", "#fbcfe8", "#ffffff"];

const BOOT_STAGES = [
  "Initializing Neural Runtime...",
  "Connecting Agent Mesh Router...",
  "Loading Encryption & Security Layer...",
  "Syncing Workspace State...",
  "Vector Ready",
];

function hexToRgbTriplet(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

export default function Loading({
  onDone,
  minDuration = 2200,
  bgColor = "#0a090e",
}) {
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const bgRgb = hexToRgbTriplet(bgColor);

  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Matrix-style pink cipher rain
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H, columns, rafId;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const colCount = Math.ceil(W / FONT_SIZE);
      columns = Array.from({ length: colCount }, () => ({
        y: Math.random() * -H,
        speed: 2.5 + Math.random() * 4,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        word: Math.random() < 0.18 ? WORDS[(Math.random() * WORDS.length) | 0] : null,
        wordIdx: 0,
      }));
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      ctx.fillStyle = `rgba(${bgRgb}, 0.18)`;
      ctx.fillRect(0, 0, W, H);
      ctx.font = FONT_SIZE + 'px "JetBrains Mono", Consolas, monospace';

      columns.forEach((col, i) => {
        const x = i * FONT_SIZE;
        let ch;
        if (col.word) {
          ch = col.word[col.wordIdx % col.word.length];
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = col.color;
          ctx.shadowBlur = 10;
        } else {
          ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          ctx.fillStyle = col.color;
          ctx.shadowColor = col.color;
          ctx.shadowBlur = 4;
          ctx.globalAlpha = 0.65;
        }
        ctx.fillText(ch, x, col.y);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        col.y += col.speed;
        col.wordIdx++;

        if (col.y > H && Math.random() > 0.975) {
          col.y = Math.random() * -200;
          col.speed = 2.5 + Math.random() * 4;
          col.color = COLORS[(Math.random() * COLORS.length) | 0];
          col.word = Math.random() < 0.18 ? WORDS[(Math.random() * WORDS.length) | 0] : null;
          col.wordIdx = 0;
        }
      });

      rafId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [bgRgb]);

  // Smooth Progress Bar counter
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / minDuration) * 100));
      setProgress(pct);

      const stage = Math.min(
        BOOT_STAGES.length - 1,
        Math.floor((pct / 100) * BOOT_STAGES.length)
      );
      setStageIndex(stage);

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => setFadingOut(true), 200);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [minDuration]);

  // Smooth fade-out finish
  useEffect(() => {
    if (!fadingOut) return;
    const node = rootRef.current;
    if (!node) return;
    function handleEnd(e) {
      if (e.propertyName === "opacity") onDone && onDone();
    }
    node.addEventListener("transitionend", handleEnd);
    return () => node.removeEventListener("transitionend", handleEnd);
  }, [fadingOut, onDone]);

  return (
    <div
      ref={rootRef}
      className={`vector-loading-screen${fadingOut ? " fade-out" : ""}`}
      style={{ "--loading-bg": bgColor }}
    >
      <canvas ref={canvasRef} className="loading-canvas" />
      <div className="loading-vignette" />
      <div className="loading-grid-overlay" />

      {/* Outer corner brackets */}
      <div className="loading-bracket tl" />
      <div className="loading-bracket tr" />
      <div className="loading-bracket bl" />
      <div className="loading-bracket br" />

      {/* Center glowing brand & progress box */}
      <div className="loading-center">
        <div className="loading-logo-wrap">
          <div className="loading-logo-icon">
            <Sparkles size={28} />
          </div>
          <h1 className="loading-wordmark">VECTOR</h1>
        </div>

        <p className="loading-subheading">NEURAL AGENT EXECUTION SYSTEM</p>

        {/* Progress bar container */}
        <div className="loading-progress-box">
          <div className="loading-bar-track">
            <div
              className="loading-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="loading-progress-row">
            <span className="loading-stage-text">
              {BOOT_STAGES[stageIndex]}
            </span>
            <span className="loading-pct-text">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Footer status readout */}
      <div className="loading-footer-row">
        <div className="loading-status-badge">
          <span className="status-dot" />
          <span>SYS_STATUS: ONLINE</span>
        </div>
        <span className="loading-ver">v2.4.0</span>
      </div>
    </div>
  );
}