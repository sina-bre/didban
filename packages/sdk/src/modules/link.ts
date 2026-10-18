import type { ModuleEmit, ModuleOn } from "../types.js";
import { MAX_PROPERTY_STRING_LENGTH } from "./property.js";

/**
 * Shared by the outbound-links and file-downloads modules. Listens to left and middle clicks on
 * `<a href>` (capture phase, passive: it never delays or cancels the navigation) and hands the
 * resolved http(s) URL to `pick`. Link text and other DOM content are never read.
 */
export function onLinkClick(on: ModuleOn, pick: (link: URL, anchor: HTMLAnchorElement) => void) {
  const handler = (event: Event) => {
    if (event.type === "auxclick" && (event as MouseEvent).button !== 1) return;
    const target = event.target;
    const anchor = target instanceof Element ? target.closest("a[href]") : null;
    if (!(anchor instanceof HTMLAnchorElement)) return;
    try {
      const url = new URL(anchor.href);
      if (url.protocol === "http:" || url.protocol === "https:") pick(url, anchor);
    } catch {
      // An unparsable href is not a link we can report.
    }
  };
  const options = { capture: true, passive: true };
  on(document, "click", handler, options);
  on(document, "auxclick", handler, options);
}

/** Origin + path only: the query string and fragment may hold personal data (spec §23.4). */
export function sendLink(emit: ModuleEmit, name: string, url: URL): void {
  const value = (url.origin + url.pathname).slice(0, MAX_PROPERTY_STRING_LENGTH);
  emit({ type: "track", name, properties: { url: value } });
}
