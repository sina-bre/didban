"use client";

import { type Analytics, type AnalyticsOptions, createAnalytics } from "@didban/analytics";
import { createContext, createElement, type ReactNode, useContext, useState } from "react";

// Spec §8.8: wiring only. The core singleton per (endpoint, writeKey) absorbs StrictMode double
// renders and HMR re-runs; on the server createAnalytics returns a no-op without touching globals.

const noop = () => {};
const fallback: Analytics = {
  page: noop,
  track: noop,
  identify: noop,
  reset: noop,
  setConsent: noop,
  optOut: noop,
  optIn: noop,
  flush: () => Promise.resolve(),
  shutdown: noop,
};

const AnalyticsContext = createContext<Analytics>(fallback);

export type AnalyticsProviderProps = AnalyticsOptions & { children?: ReactNode };

/**
 * Creates the instance once, during the first render, so children can track from their own
 * mount effects. Options are read once; later prop changes are ignored.
 */
export function AnalyticsProvider({ children, ...options }: AnalyticsProviderProps) {
  const [analytics] = useState(() => createAnalytics(options));
  return createElement(AnalyticsContext.Provider, { value: analytics }, children);
}

/** The provider's instance, or a no-op instance outside a provider (it never throws). */
export function useAnalytics(): Analytics {
  return useContext(AnalyticsContext);
}
