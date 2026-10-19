import { createAnalytics } from "./create.js";
import { engagedTime } from "./modules/engaged-time.js";
import { fileDownloads } from "./modules/file-downloads.js";
import { notFound } from "./modules/not-found.js";
import { outboundLinks } from "./modules/outbound-links.js";
import { scrollDepth } from "./modules/scroll-depth.js";
import type { Analytics, AnalyticsOptions, SpaMode } from "./types.js";

// Script-tag build (spec §8.5): `<script defer src=".../didban.js" data-endpoint="/a/e"
// data-write-key="wk_…">`. All settings come from data attributes, so a strict CSP without
// 'unsafe-inline' works. Exposes `window.analytics` (the core instance plus `notFound()`).
// Script evaluation only reads the attributes: the instance is created in its own task, or by the
// first call, so no single task gets long (addendum A2).

declare global {
  interface Window {
    analytics?: Analytics & { notFound(path?: string): void };
  }
}

const METHODS = [
  "page",
  "track",
  "identify",
  "reset",
  "setConsent",
  "optOut",
  "optIn",
  "flush",
  "shutdown",
] as const;

const MODULES = {
  "outbound-links": outboundLinks,
  "file-downloads": fileDownloads,
  "scroll-depth": scrollDepth,
  "engaged-time": engagedTime,
};

function readOptions(data: DOMStringMap): AnalyticsOptions {
  const words = (value?: string) => (value ?? "").split(/[\s,]+/).filter(Boolean);
  const autoCapture: NonNullable<AnalyticsOptions["autoCapture"]> = {
    pageviews: data.pageviews !== "false",
    spa: (data.spa as SpaMode | undefined) ?? "auto",
  };
  for (const name of words(data.modules)) {
    const start = MODULES[name as keyof typeof MODULES];
    if (start) Object.assign(autoCapture, { [name]: start() });
  }
  return {
    endpoint: data.endpoint ?? "",
    writeKey: data.writeKey ?? "",
    identity: data.identity === "persistent" ? "persistent" : "cookieless",
    requireConsent: data.requireConsent === "true",
    trackLocalhost: data.trackLocalhost === "true",
    hostAllowlist: data.hostAllowlist ? words(data.hostAllowlist) : undefined,
    excludePaths: words(data.excludePaths),
    debug: data.debug === "true",
    autoCapture,
  };
}

const script = document.currentScript as HTMLScriptElement | null;
if (script && !window.analytics) {
  const options = readOptions(script.dataset);
  let instance: Analytics | undefined;
  const get = () => (instance ??= createAnalytics(options));
  const forward = (name: (typeof METHODS)[number]) => [
    name,
    (...args: unknown[]) => (get()[name] as (...a: unknown[]) => unknown)(...args),
  ];
  window.analytics = Object.assign(Object.fromEntries(METHODS.map(forward)) as Analytics, {
    notFound: (path?: string) => notFound(get(), path),
  });
  setTimeout(get, 0);
}
