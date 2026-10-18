import { DEVICE_TYPES, type DeviceType } from "@didban/contracts";
import Bowser from "bowser";
import { isbot } from "isbot";

// Spec §7 step 6: normalized browser / OS / device only; the raw UA is never stored (ADR 0026:
// bowser, MIT). Bot filter: isbot's pattern list (includes headless markers such as
// HeadlessChrome, PhantomJS, Puppeteer) plus "no user agent at all".

export type Device = {
  browser: string | null;
  browserMajor: number | null;
  os: string | null;
  deviceType: DeviceType | null;
};

const PLATFORMS: Record<string, DeviceType> = {
  desktop: DEVICE_TYPES.desktop,
  mobile: DEVICE_TYPES.mobile,
  tablet: DEVICE_TYPES.tablet,
  tv: DEVICE_TYPES.tv,
};
// bowser leaves the platform empty for some desktop systems (Chrome OS).
const DESKTOP_OS = new Set(["Windows", "macOS", "Linux", "Chrome OS"]);
const MAX_NAME_LENGTH = 50;

const name = (value: string | undefined) => value?.slice(0, MAX_NAME_LENGTH) || null;

function major(version: string | undefined): number | null {
  const value = Number.parseInt(version ?? "", 10);
  return Number.isInteger(value) && value >= 0 && value <= 32_767 ? value : null;
}

export function isBotUserAgent(userAgent: string | undefined): boolean {
  return !userAgent || isbot(userAgent);
}

export function parseUserAgent(userAgent: string): Device {
  const { browser, os, platform } = Bowser.parse(userAgent);
  const fallback = os.name && DESKTOP_OS.has(os.name) ? DEVICE_TYPES.desktop : null;
  return {
    browser: name(browser.name),
    browserMajor: major(browser.version),
    os: name(os.name),
    deviceType: (platform.type && PLATFORMS[platform.type]) || fallback,
  };
}
