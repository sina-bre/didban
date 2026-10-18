import type { Identity } from "./identity.js";
import { uuidv7 } from "./ids.js";
import { MAX_TITLE_LENGTH, MAX_URL_LENGTH } from "./limits.js";
import type { Properties, SdkEvent } from "./types.js";

export interface EventInput {
  type: SdkEvent["type"];
  name?: string;
  url?: string;
  referrer?: string;
  properties?: Properties;
}

/** The page URL without its fragment (hash routes pass their own `url`). */
export function currentUrl(): string {
  const { origin, pathname, search } = window.location;
  return origin + pathname + search;
}

export function httpUrlOrUndefined(value: string | undefined): string | undefined {
  if (!value || value.length > MAX_URL_LENGTH || !/^https?:\/\//i.test(value)) return undefined;
  return value;
}

/** Builds one event. Properties are copied so later mutation by the caller has no effect. */
export function buildEvent(input: EventInput, identity: Identity): SdkEvent {
  const title = document.title.slice(0, MAX_TITLE_LENGTH);
  const event: SdkEvent = {
    eventId: uuidv7(),
    type: input.type,
    occurredAt: new Date().toISOString(),
    url: (input.url ?? currentUrl()).slice(0, MAX_URL_LENGTH),
    properties: { ...input.properties },
    ...identity.fields(),
  };
  if (input.name) event.name = input.name;
  const referrer = httpUrlOrUndefined(input.referrer);
  if (referrer) event.referrer = referrer;
  if (title) event.title = title;
  return event;
}
