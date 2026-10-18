import { CHANNELS, DEVICE_TYPES, SCREEN_CLASSES } from "@didban/contracts";

// Stored small-integer codes → the names the API and filters use (`organicSearch`, `mobile`, ...).
const reverse = (codes: Record<string, number>) => {
  const names = new Map(Object.entries(codes).map(([name, code]) => [String(code), name]));
  return (raw: string | null) => (raw === null ? null : (names.get(raw) ?? raw));
};

export const channelName = reverse(CHANNELS);
export const deviceTypeName = reverse(DEVICE_TYPES);
export const screenName = reverse(Object.fromEntries(SCREEN_CLASSES.map((s) => [s.name, s.code])));
