"use client";

import { notFound } from "@didban/analytics";
import { useAnalytics } from "@didban/react";
import { useEffect, useRef } from "react";

// Feature catalog §23.1: the SDK never sees HTTP status codes, so the 404 page reports itself.
// The ref keeps StrictMode's second development effect from sending a second event.
export default function NotFound() {
  const analytics = useAnalytics();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    notFound(analytics);
  }, [analytics]);
  return <h1>Page not found</h1>;
}
