import { z } from "zod";
import { EVENT_NAME_PATTERN, LIMITS } from "./limits.js";
import { propertiesSchema } from "./properties.js";

const httpUrl = z.url({ protocol: /^https?$/ }).max(LIMITS.maxUrlLength);
const id = z.string().min(1).max(LIMITS.maxIdLength);

export const eventIdSchema = z.union([z.uuid({ version: "v7" }), z.ulid()]);

const baseEvent = {
  eventId: eventIdSchema,
  occurredAt: z.iso.datetime({ offset: true }),
  url: httpUrl,
  referrer: httpUrl.optional(),
  title: z.string().max(LIMITS.maxTitleLength).optional(),
  anonymousId: id.optional(),
  userId: id.optional(),
  properties: propertiesSchema.default({}),
};

export const pageEventSchema = z.object({ ...baseEvent, type: z.literal("page") });
export const trackEventSchema = z.object({
  ...baseEvent,
  type: z.literal("track"),
  name: z.string().regex(EVENT_NAME_PATTERN),
});
export const identifyEventSchema = z.object({
  ...baseEvent,
  type: z.literal("identify"),
  userId: id,
});

const encoder = new TextEncoder();
const fitsSizeLimit = (event: unknown) =>
  encoder.encode(JSON.stringify(event)).length <= LIMITS.maxEventBytes;

/** One event of a batch. Unknown fields are stripped (the server counts them). */
export const eventSchema = z
  .discriminatedUnion("type", [pageEventSchema, trackEventSchema, identifyEventSchema])
  .refine(fitsSizeLimit, { message: `event larger than ${LIMITS.maxEventBytes} bytes` });

export type AnalyticsEvent = z.infer<typeof eventSchema>;
export type PageEvent = z.infer<typeof pageEventSchema>;
export type TrackEvent = z.infer<typeof trackEventSchema>;
export type IdentifyEvent = z.infer<typeof identifyEventSchema>;
