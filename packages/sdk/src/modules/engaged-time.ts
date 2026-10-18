import type { Module } from "../types.js";

/**
 * `autoCapture: { engagedTime: engagedTime() }`. Counts time while the tab is visible and focused,
 * and sends `engaged_time` with `seconds` for the page when the visitor moves to the next page or
 * hides the tab (counting resumes on return). Under one second is not sent. No timers run.
 */
export function engagedTime(): Module {
  return (emit, on) => {
    let total = 0;
    let since = 0;
    let pageUrl: string | undefined;
    const update = () => {
      const now = Date.now();
      if (since) total += now - since;
      const engaged = document.visibilityState === "visible" && document.hasFocus();
      since = engaged ? now : 0;
    };
    const send = () => {
      update();
      const seconds = Math.round(total / 1000);
      total = 0;
      if (seconds > 0) {
        emit({ type: "track", name: "engaged_time", properties: { seconds }, url: pageUrl });
      }
    };
    on(window, "focus", update);
    on(window, "blur", update);
    on(document, "visibilitychange", () => {
      if (document.visibilityState === "hidden") send();
      else update();
    });
    update();
    return (url) => {
      send();
      pageUrl = url;
    };
  };
}
