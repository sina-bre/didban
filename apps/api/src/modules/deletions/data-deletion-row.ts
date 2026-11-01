import type { DataDeletion } from "@didban/contracts";

// Deletion request rows as stored (migration 0014) and as the API lists them.

export type Row = {
  id: string;
  kind: DataDeletion["kind"];
  fromAt: Date | null;
  toAt: Date | null;
  userId: string | null;
  status: DataDeletion["status"];
  eventsDeleted: string;
  visitsDeleted: string;
  createdAt: Date;
  finishedAt: Date | null;
};
export const COLUMNS = [
  "id",
  "kind",
  "from_at",
  "to_at",
  "user_id",
  "status",
  "events_deleted",
  "visits_deleted",
  "created_at",
  "finished_at",
];

export const toDeletion = (r: Row): DataDeletion => ({
  id: r.id,
  kind: r.kind,
  from: r.fromAt?.toISOString() ?? null,
  to: r.toAt?.toISOString() ?? null,
  userId: r.userId,
  status: r.status,
  eventsDeleted: Number(r.eventsDeleted),
  visitsDeleted: Number(r.visitsDeleted),
  createdAt: r.createdAt.toISOString(),
  finishedAt: r.finishedAt?.toISOString() ?? null,
});
