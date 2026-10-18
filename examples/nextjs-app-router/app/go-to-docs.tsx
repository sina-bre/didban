"use client";

import { useAnalytics } from "@didban/react";
import { useRouter } from "next/navigation";

// router.push needs no analytics code: the SDK sees the History API change.
export function GoToDocs() {
  const router = useRouter();
  const analytics = useAnalytics();
  return (
    <button
      type="button"
      onClick={() => {
        analytics.track("docs_opened", { from: "home" });
        router.push("/docs");
      }}
    >
      Open docs (router.push)
    </button>
  );
}
