import { z } from "zod";

// Spec §3.1 + §11: a read-only public link to one project's reports, revocable, the token stored
// hashed (catalog 23.3: optional expiry). The token travels in a header, never in a URL, so it
// does not end up in access logs, browser history or Referer headers.
export const MAX_ACTIVE_SHARE_LINKS = 20;
export const SHARE_TOKEN_HEADER = "x-share-token";
export const SHARE_TOKEN_PATTERN = /^dsh_[A-Za-z0-9_-]{43}$/;

/** The only stats a share link reaches (spec §11: an enumerated set, never management). */
export const SHARED_REPORTS = [
  "overview",
  "timeseries",
  "pages",
  "sources",
  "geo",
  "devices",
  "events",
  "goals",
] as const;

export const createShareLinkRequestSchema = z.object({
  label: z.string().trim().min(1).max(100),
  expiresAt: z.iso
    .datetime({ offset: false })
    .refine((value) => Date.parse(value) > Date.now(), "must be in the future")
    .optional(),
});
export type CreateShareLinkRequest = z.infer<typeof createShareLinkRequestSchema>;

export type ShareLink = {
  id: string;
  label: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};
/** Returned once, at creation; only its SHA-256 is stored. */
export type CreatedShareLink = ShareLink & { token: string };
export type ShareLinkListResponse = { shareLinks: ShareLink[] };

/** `GET /share`: what the public view shows in its header. */
export type SharedProjectResponse = { projectName: string; label: string; timezone: string };
