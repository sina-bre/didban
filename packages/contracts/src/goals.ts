import { z } from "zod";
import { EVENT_NAME_PATTERN } from "./limits.js";
import type { StatsMeta } from "./stats.js";

// Spec §3.1 goals: a named conversion on an event name or on a page path pattern (route template
// syntax: `/pricing`, `/products/:id`, `/blog/*`; the API checks it fully). ≤ 50 per project.
export const MAX_GOALS = 50;

const name = z.string().trim().min(1).max(100);
const eventName = z.string().regex(EVENT_NAME_PATTERN);
const pathPattern = z.string().min(1).max(200).startsWith("/");

export const createGoalRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event"), name, eventName }),
  z.object({ kind: z.literal("page"), name, pathPattern }),
]);
export type CreateGoalRequest = z.infer<typeof createGoalRequestSchema>;

/** The kind is fixed at creation; the matching field must fit the goal's kind. */
export const updateGoalRequestSchema = z
  .object({ name, eventName, pathPattern })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Nothing to update");
export type UpdateGoalRequest = z.infer<typeof updateGoalRequestSchema>;

export type Goal = {
  id: string;
  name: string;
  kind: "event" | "page";
  eventName: string | null;
  pathPattern: string | null;
  createdAt: string;
};
export type GoalListResponse = { goals: Goal[] };

/** Spec §4: counts and revenue include server events; the rate uses browser visitors only. */
export type GoalStats = Goal & {
  conversions: number;
  visitors: number;
  conversionRate: number | null;
  revenue: { currency: string; amount: string }[];
};
export type GoalStatsResponse = { meta: StatsMeta; goals: GoalStats[] };
