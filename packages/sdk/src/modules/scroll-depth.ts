import type { Module } from "../types.js";

const THRESHOLDS = [25, 50, 75, 100];

/**
 * `autoCapture: { scrollDepth: scrollDepth() }`. Sends `scroll_depth` with `percent` (25, 50, 75,
 * 100) once per threshold per page view. The scroll listener is passive and only schedules one
 * measurement per animation frame, so the page's scrolling never waits for it.
 */
export function scrollDepth(): Module {
  return (emit, on) => {
    let reached = 0;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const height = document.documentElement.scrollHeight;
      if (!height) return;
      const percent = ((window.scrollY + window.innerHeight) / height) * 100;
      for (const threshold of THRESHOLDS) {
        if (threshold <= reached || percent < threshold - 1) continue;
        reached = threshold;
        emit({ type: "track", name: "scroll_depth", properties: { percent: threshold } });
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    on(window, "scroll", onScroll, { passive: true });
    return () => {
      reached = 0;
    };
  };
}
