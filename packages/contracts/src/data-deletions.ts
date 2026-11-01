import { z } from "zod";
import { LIMITS } from "./limits.js";

// Spec §3.1 + §12: delete a project's events and visits by date range, by visitor (the SDK's
// persistent `anonymousId`) or by user ID. A background job does the work in chunks; the request
// row is its progress record. Cookieless visitors cannot be named: their IDs are unrecoverable.
export const MAX_OPEN_DELETIONS = 10;

const id = z.string().trim().min(1).max(LIMITS.maxIdLength);
const instant = z.iso.datetime({ offset: true });

export const createDataDeletionRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("range"), from: instant, to: instant })
    .refine((body) => Date.parse(body.from) < Date.parse(body.to), {
      message: "from must be before to",
      path: ["to"],
    }),
  z.object({ kind: z.literal("visitor"), anonymousId: id }),
  z.object({ kind: z.literal("user"), userId: id }),
]);
export type CreateDataDeletionRequest = z.infer<typeof createDataDeletionRequestSchema>;

export const DATA_DELETION_STATUSES = ["pending", "running", "done", "failed"] as const;
export type DataDeletionStatus = (typeof DATA_DELETION_STATUSES)[number];

/** The visitor's anonymous ID is never stored or returned; a user ID is (the operator typed it). */
export type DataDeletion = {
  id: string;
  kind: "range" | "visitor" | "user";
  from: string | null;
  to: string | null;
  userId: string | null;
  status: DataDeletionStatus;
  eventsDeleted: number;
  visitsDeleted: number;
  createdAt: string;
  finishedAt: string | null;
};
export type DataDeletionListResponse = { deletions: DataDeletion[] };
