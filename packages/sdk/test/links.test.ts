import { eventSchema } from "@didban/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileDownloads } from "../src/modules/file-downloads.js";
import { outboundLinks } from "../src/modules/outbound-links.js";
import { cleanup, idle, setup, stubFetch } from "./helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  document.body.innerHTML = "";
  cleanup();
});

function link(href: string, attrs: Record<string, string> = {}) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.innerHTML = "<span>Secret link text</span>";
  for (const [name, value] of Object.entries(attrs)) anchor.setAttribute(name, value);
  document.body.append(anchor);
  // Prevent jsdom from navigating; a listener added later than the SDK's still sees the event.
  anchor.addEventListener("click", (e) => e.preventDefault());
  return anchor.firstElementChild as HTMLElement;
}

type Sent = { type: string; name?: string; properties: Record<string, unknown> };

async function tracked(events: () => Sent[]) {
  await idle(10_000);
  return events().filter((e) => e.type === "track");
}

describe("outbound-links module", () => {
  it("sends outbound_click with origin + path only, for other hosts only", async () => {
    const { events } = stubFetch();
    setup({ autoCapture: { outboundLinks: outboundLinks() } });
    await idle();
    link("https://partner.example/offer?email=a@b.c#x").click();
    link("/pricing").click();
    link("mailto:hi@shop.example").click();
    link("https://other.example/mid").dispatchEvent(
      new MouseEvent("auxclick", { bubbles: true, button: 1 }),
    );
    link("https://other.example/right").dispatchEvent(
      new MouseEvent("auxclick", { bubbles: true, button: 2 }),
    );
    const sent = await tracked(events);
    expect(sent.map((e) => [e.name, e.properties])).toEqual([
      ["outbound_click", { url: "https://partner.example/offer" }],
      ["outbound_click", { url: "https://other.example/mid" }],
    ]);
    for (const event of sent) expect(eventSchema.safeParse(event).error).toBeUndefined();
    expect(JSON.stringify(sent)).not.toContain("Secret");
  });

  it("listens passively and stops after shutdown", async () => {
    const { events } = stubFetch();
    const spy = vi.spyOn(document, "addEventListener");
    const analytics = setup({ autoCapture: { outboundLinks: outboundLinks() } });
    await idle();
    expect(spy).toHaveBeenCalledWith("click", expect.any(Function), {
      capture: true,
      passive: true,
    });
    analytics.shutdown();
    link("https://partner.example/").click();
    expect(await tracked(events)).toEqual([]);
  });
});

describe("file-downloads module", () => {
  it("sends file_download for known extensions and download links", async () => {
    const { events } = stubFetch();
    setup({ autoCapture: { fileDownloads: fileDownloads() } });
    await idle();
    link("/files/report.PDF?token=abc").click();
    link("/export", { download: "" }).click();
    link("/about").click();
    const sent = await tracked(events);
    expect(sent.map((e) => e.properties.url)).toEqual([
      "https://shop.example/files/report.PDF",
      "https://shop.example/export",
    ]);
    expect(sent.every((e) => e.name === "file_download")).toBe(true);
  });

  it("uses a custom extension list instead of the default", async () => {
    const { events } = stubFetch();
    setup({ autoCapture: { fileDownloads: fileDownloads({ extensions: ["sketch"] }) } });
    await idle();
    link("/a.pdf").click();
    link("/b.sketch").click();
    const sent = await tracked(events);
    expect(sent.map((e) => e.properties.url)).toEqual(["https://shop.example/b.sketch"]);
  });
});
