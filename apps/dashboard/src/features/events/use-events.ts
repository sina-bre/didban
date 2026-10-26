import { EVENT_NAME_PATTERN, type EventRow, PROPERTY_KEY_PATTERN } from "@didban/contracts";
import { useSearchParams } from "react-router";
import { useBreakdown } from "../report/use-breakdown";

/** `?event=` and `?prop=` when they are a valid event name and property key (contracts rules). */
export function readSelection(params: URLSearchParams) {
  const event = params.get("event");
  const prop = params.get("prop");
  const validEvent = event !== null && EVENT_NAME_PATTERN.test(event) ? event : null;
  return {
    event: validEvent,
    prop: validEvent && prop !== null && PROPERTY_KEY_PATTERN.test(prop) ? prop : null,
  };
}

/**
 * Custom events by name, and for the selected event its property keys, or the values of the
 * selected key (spec §3.1 "property key/value breakdown for a selected event").
 */
export function useEvents() {
  const [params] = useSearchParams();
  const { event, prop } = readSelection(params);
  const events = useBreakdown<EventRow>("events");
  const properties = useBreakdown<EventRow>(
    `events/${encodeURIComponent(event ?? "-")}/properties`,
    prop ? { key: prop } : {},
    event !== null,
  );
  return { event, prop, events, properties };
}
