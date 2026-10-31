import type { ReactNode } from "react";

/** A small read-only label next to a name ("Cookieless", "Revoked", "Owner"). */
export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "down";
  children: ReactNode;
}) {
  const color = tone === "down" ? "bg-down-soft text-down" : "bg-subtle text-muted";
  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-caption ${color}`}>
      {children}
    </span>
  );
}
