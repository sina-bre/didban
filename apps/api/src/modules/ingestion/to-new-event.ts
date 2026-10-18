import { EVENT_TYPES } from "@didban/contracts";
import { toEventUuid } from "../../domain/event-id.js";
import type { NewEvent } from "../events/new-event.js";
import type { IdentifiedEvent } from "./identify-batch.js";

/** Ingestion's enriched event → the `EventWriter` row. Pure field mapping, no rules. */
export function toNewEvent(event: IdentifiedEvent): NewEvent {
  const { utm } = event;
  return {
    eventId: toEventUuid(event.eventId),
    type: EVENT_TYPES[event.type],
    occurredAt: event.occurredAt,
    visitorId: event.visitorId,
    userId: event.userId,
    name: event.name,
    hostname: event.hostname,
    pathname: event.pathname,
    route: event.route,
    revenue: event.revenue,
    currency: event.currency,
    referrerHost: event.referrerHost,
    referrerSource: event.referrerSource,
    channel: event.channel,
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    utmTerm: utm.term,
    utmContent: utm.content,
    country: event.country,
    region: event.region,
    city: event.city,
    browser: event.browser,
    browserMajor: event.browserMajor,
    os: event.os,
    deviceType: event.deviceType,
    screenClass: event.screenClass,
    language: event.language,
    properties: event.properties,
    title: event.title,
  };
}
