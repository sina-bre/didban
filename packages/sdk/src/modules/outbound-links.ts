import type { Module } from "../types.js";
import { onLinkClick, sendLink } from "./link.js";

/**
 * `autoCapture: { outboundLinks: outboundLinks() }`. Sends `outbound_click` with `url` (origin +
 * path) when a visitor clicks a link to another host. Link text is never captured.
 */
export function outboundLinks(): Module {
  return (emit, on) => {
    onLinkClick(on, (url) => {
      if (url.host !== window.location.host) sendLink(emit, "outbound_click", url);
    });
  };
}
