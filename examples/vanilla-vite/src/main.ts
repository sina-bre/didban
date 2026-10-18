import { createAnalytics } from "@didban/analytics";
import { engagedTime } from "@didban/analytics/engaged-time";
import { fileDownloads } from "@didban/analytics/file-downloads";
import { outboundLinks } from "@didban/analytics/outbound-links";
import { scrollDepth } from "@didban/analytics/scroll-depth";

// Initialize once. Page views need no router code: the SDK follows history.pushState.
const analytics = createAnalytics({
  endpoint: "/a/e", // same-origin proxy, see vite.config.ts
  writeKey: import.meta.env.VITE_DIDBAN_WRITE_KEY ?? "",
  trackLocalhost: true, // this example runs on localhost; leave it off in production
  autoCapture: {
    outboundLinks: outboundLinks(),
    fileDownloads: fileDownloads(),
    scrollDepth: scrollDepth(),
    engagedTime: engagedTime(),
  },
});

const title = document.querySelector<HTMLElement>("#title");
const render = () => {
  if (title) title.textContent = window.location.pathname.slice(1) || "Home";
};

// A minimal client-side router: links marked data-route change the URL without a reload.
for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-route]")) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    history.pushState({}, "", link.href);
    render();
  });
}
window.addEventListener("popstate", render);
render();

document.querySelector("#signup")?.addEventListener("click", () => {
  analytics.track("signup_clicked", { plan: "free" });
});
// Keep the demo page in place when the outbound/download links are clicked.
for (const id of ["#outbound", "#download"]) {
  document.querySelector(id)?.addEventListener("click", (event) => event.preventDefault());
}
