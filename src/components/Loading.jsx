import { useEffect, useRef, useState } from "react";
import "./Loading.css";

const FONT_SIZE = 15;
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ01#$%&*+=-/\\";
const WORDS = ["DEV", "RESEARCH", "COMMS", "DATA", "MONITOR", "FINANCE", "FILES", "SIGMA", "MESH", "VECTOR"];
const COLORS = ["#a78bfa", "#5ec9c0", "#f2617c", "#e8a33d", "#5fd97e", "#5b8def"];

const STATUSES = ["", " ", " ", "", ""];
const CIPHER_STATES = ["ACTIVE", "STABLE", "VERIFIED"];

// "#05060f" -> "5, 6, 15", used to build the canvas trail-fade rgba()
function hexToRgbTriplet(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

export default function Loading({
  onDone,
  minDuration = 2600,
  offlineExtraDuration = 2200,
  bgColor = "#05091a",
}) {
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const bgRgb = hexToRgbTriplet(bgColor);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [statusText, setStatusText] = useState(STATUSES[0]);
  const [cipherText, setCipherText] = useState(CIPHER_STATES[0]);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [fadingOut, setFadingOut] = useState(false);

  // matrix-style cipher rain, driven by canvas + rAF
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W, H, columns, rafId;
    let resolvedRef = 0;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const colCount = Math.ceil(W / FONT_SIZE);
      columns = Array.from({ length: colCount }, () => ({
        y: Math.random() * -H,
        speed: 3 + Math.random() * 5,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        word: Math.random() < 0.15 ? WORDS[(Math.random() * WORDS.length) | 0] : null,
        wordIdx: 0,
      }));
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      ctx.fillStyle = `rgba(${bgRgb}, 0.16)`;
      ctx.fillRect(0, 0, W, H);
      ctx.font = FONT_SIZE + 'px "SF Mono", Consolas, monospace';

      columns.forEach((col, i) => {
        const x = i * FONT_SIZE;
        let ch;
        if (col.word) {
          ch = col.word[col.wordIdx % col.word.length];
          ctx.fillStyle = "#f3f0ff";
          ctx.shadowColor = col.color;
          ctx.shadowBlur = 8;
        } else {
          ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          ctx.fillStyle = col.color;
          ctx.shadowColor = col.color;
          ctx.shadowBlur = 4;
          ctx.globalAlpha = 0.75;
        }
        ctx.fillText(ch, x, col.y);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        col.y += col.speed;
        col.wordIdx++;

        if (col.y > H && Math.random() > 0.975) {
          col.y = Math.random() * -200;
          col.speed = 3 + Math.random() * 5;
          col.color = COLORS[(Math.random() * COLORS.length) | 0];
          if (Math.random() < 0.15) {
            col.word = WORDS[(Math.random() * WORDS.length) | 0];
            col.wordIdx = 0;
            resolvedRef++;
            setResolvedCount(resolvedRef);
          } else {
            col.word = null;
          }
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

  // track connectivity live, so a status change mid-boot updates the UI
  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // cycling status readouts
  useEffect(() => {
    let si = 0;
    const id = setInterval(() => {
      si = (si + 1) % STATUSES.length;
      setStatusText(STATUSES[si]);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let ci = 0;
    const id = setInterval(() => {
      ci = (ci + 1) % CIPHER_STATES.length;
      setCipherText(CIPHER_STATES[ci]);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // decide how long to hold the screen: if we're offline when booting
  // starts, hold a bit longer so the "limited mode" state is legible
  // instead of flashing past
  useEffect(() => {
    const startedOffline = typeof navigator !== "undefined" && !navigator.onLine;
    const holdFor = minDuration + (startedOffline ? offlineExtraDuration : 0);
    const t = setTimeout(() => setFadingOut(true), holdFor);
    return () => clearTimeout(t);
  }, [minDuration, offlineExtraDuration]);

  // wait for the CSS opacity transition to actually finish before telling
  // the parent we're done, so the fade reads as one smooth motion instead
  // of an abrupt swap underneath it
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

  const displayStatus = isOnline ? statusText : "NO CONNECTION";
  const displayCipher = isOnline ? cipherText : "LIMITED";

  return (
    <div
      ref={rootRef}
      className={`cipher-screen${fadingOut ? " fade-out" : ""}`}
      style={{ "--cipher-bg": bgColor }}
    >
      <canvas ref={canvasRef} className="cipher-rain" />
      <div className="cipher-vignette" />
      <div className="cipher-grain" />

      <div className="cipher-bracket bl-top" />
      <div className="cipher-bracket bl-bottom" />
      <div className="cipher-bracket br-top" />
      <div className="cipher-bracket br-bottom" />

      <div className="cipher-corner tl">
      
        <br />
        <span className={`accent${!isOnline ? " warn" : ""}`}>{displayStatus}</span>
      </div>
      <div className="cipher-corner br">
        <h1>VECTOR</h1> 
      </div>



      {!isOnline && (
        <div className="cipher-offline-banner">
          <span className="dot" />
          Offline — some actions will be restricted
        </div>
      )}
    </div>
  );
}