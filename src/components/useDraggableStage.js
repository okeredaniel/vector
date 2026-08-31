import { useRef, useState, useCallback, useEffect } from "react";

// how far (in px) you can pan the stage from center before hitting the
// "soft wall" - past this, dragging still moves it but with resistance
const PAN_LIMIT = 220;

// 0 = rigid wall (no give at all), 1 = no resistance (pans forever).
// 0.3-0.4 is the "stretchy but still feels bounded" Google Maps zone
const PAN_ELASTIC = 0.35;

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 0.7;
const ZOOM_ELASTIC = 0.4;

// how long after the last wheel tick before we consider zooming "done"
// and snap any elastic overshoot back to the hard min/max
const ZOOM_SETTLE_DELAY = 160;

// pushes a value that's past `limit` closer to `limit`, scaled by `elastic` -
// this is the actual rubber-band math: linear until the limit, then a
// dampened response past it instead of a hard stop
function withElasticResistance(value, limit, elastic) {
  if (Math.abs(value) <= limit) return value;
  const over = Math.abs(value) - limit;
  const eased = limit + over * elastic;
  return value < 0 ? -eased : eased;
}

function clampHard(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function useDraggableStage() {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.7);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  const dragRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });
  const zoomSettleTimer = useRef(null);

  const onPointerDown = useCallback(
    (e) => {
      setIsSettling(false);
      setIsDragging(true);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: pan.x,
        originY: pan.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pan.x, pan.y]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const rawX = dragRef.current.originX + dx;
      const rawY = dragRef.current.originY + dy;
      // elastic resistance applied LIVE while dragging - this is what
      // gives the "stretchy" feel instead of just stopping dead at the edge
      setPan({
        x: withElasticResistance(rawX, PAN_LIMIT, PAN_ELASTIC),
        y: withElasticResistance(rawY, PAN_LIMIT, PAN_ELASTIC),
      });
    },
    [isDragging]
  );

  const onPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    // isSettling turns on the CSS transition (see .stage.settling in
    // Dashboard.css) so this hard clamp animates back instead of snapping
    setIsSettling(true);
    setPan((p) => ({
      x: clampHard(p.x, -PAN_LIMIT, PAN_LIMIT),
      y: clampHard(p.y, -PAN_LIMIT, PAN_LIMIT),
    }));
  }, [isDragging]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setIsSettling(false);
    clearTimeout(zoomSettleTimer.current);

    setZoom((z) => {
      const next = z - e.deltaY * 0.0012;
      // same elastic trick, applied around 1.0 as the "rest" point isn't
      // right - elastic is measured from ZOOM_MAX/ZOOM_MIN directly
      if (next > ZOOM_MAX) {
        return ZOOM_MAX + (next - ZOOM_MAX) * ZOOM_ELASTIC;
      }
      if (next < ZOOM_MIN) {
        return ZOOM_MIN - (ZOOM_MIN - next) * ZOOM_ELASTIC;
      }
      return next;
    });

    // wheel events fire rapidly while scrolling - wait for a gap before
    // treating the gesture as "finished" and snapping overshoot back
    zoomSettleTimer.current = setTimeout(() => {
      setIsSettling(true);
      setZoom((z) => clampHard(z, ZOOM_MIN, ZOOM_MAX));
    }, ZOOM_SETTLE_DELAY);
  }, []);

  useEffect(() => () => clearTimeout(zoomSettleTimer.current), []);

  return {
    pan,
    zoom,
    isDragging,
    isSettling,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave: onPointerUp,
      onWheel,
    },
  };
}