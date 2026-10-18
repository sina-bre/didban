import type { SdkEvent } from "./types.js";

export interface Queue {
  push(event: SdkEvent): void;
  take(count: number): SdkEvent[];
  clear(): void;
  readonly size: number;
}

/** Bounded in-memory queue (spec §8.2 maxQueueSize): the oldest event is dropped and counted. */
export function createQueue(max: number, onDrop: (dropped: number) => void): Queue {
  const items: SdkEvent[] = [];
  return {
    push(event) {
      items.push(event);
      if (items.length > max) onDrop(items.splice(0, items.length - max).length);
    },
    take: (count) => items.splice(0, count),
    clear() {
      items.length = 0;
    },
    get size() {
      return items.length;
    },
  };
}
