import type { DataDeletion } from "@didban/contracts";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { apiError, type Call, fakeApi } from "./fake-api";
import { PROJECT, project, signedIn } from "./fixtures";
import { renderApp } from "./render-app";
import { AT, settingsApi } from "./settings-fixtures";

// Stage 6a data deletion on the Data page in real Chrome (native dialog): days in the project's
// zone, sent only after the confirmation.
const path = `/projects/${PROJECT}/deletions`;
const wait = { timeout: 8000 };
const done: DataDeletion = {
  id: "00000000-0000-4000-8000-0000000000a9",
  kind: "user",
  from: null,
  to: null,
  userId: "customer-42",
  status: "done",
  eventsDeleted: 1200,
  visitsDeleted: 30,
  createdAt: AT,
  finishedAt: AT,
};
const api = (extra = {}) =>
  fakeApi({
    ...signedIn(),
    ...settingsApi(),
    [`GET /projects/${PROJECT}`]: { ...project(), reportingTimezone: "Asia/Tehran" },
    ...extra,
  });
const posted = (calls: Call[]) =>
  calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith(path));
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("a range is whole days in the project's zone, sent only after the confirmation", async () => {
  const calls = api({ [`POST ${path}`]: () => ({ status: 201, body: done }) });
  renderApp(`/projects/${PROJECT}/settings/data`);
  await screen.findByText("No deletions yet", {}, wait);
  fill("First day", "2026-10-01");
  fill("Last day", "2026-10-07");
  fireEvent.click(screen.getByRole("button", { name: "Delete data" }));
  const dialog = await screen.findByRole("dialog", { name: "Delete this data?" });
  expect(posted(calls)).toHaveLength(0);
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete for good" }));
  await vi.waitFor(() => expect(posted(calls)).toHaveLength(1));
  // Tehran is UTC+03:30: its midnight is 20:30 UTC the day before; the last day is included.
  expect(posted(calls)[0]?.body).toEqual({
    kind: "range",
    from: "2026-09-30T20:30:00.000Z",
    to: "2026-10-07T20:30:00.000Z",
  });
});

it("a last day before the first day is refused in the browser", async () => {
  const calls = api();
  renderApp(`/projects/${PROJECT}/settings/data`);
  await screen.findByText("No deletions yet", {}, wait);
  fill("First day", "2026-10-07");
  fill("Last day", "2026-10-01");
  fireEvent.click(screen.getByRole("button", { name: "Delete data" }));
  expect(await screen.findByText("Pick a first day on or before the last day.")).toBeTruthy();
  expect(posted(calls)).toHaveLength(0);
});

it("a user ID request; the limit error stays in the dialog; the list shows progress", async () => {
  const calls = api({
    [`GET ${path}`]: { deletions: [done] },
    [`POST ${path}`]: () => apiError(409, "DELETION_LIMIT_REACHED"),
  });
  renderApp(`/projects/${PROJECT}/settings/data`);
  expect(await screen.findByText("customer-42", {}, wait)).toBeTruthy();
  expect(screen.getByText("1,200 events · 30 visits")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "User ID" }));
  fireEvent.change(screen.getByRole("textbox", { name: "User ID" }), {
    target: { value: "customer-7" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Delete data" }));
  const dialog = await screen.findByRole("dialog", { name: "Delete this data?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete for good" }));
  expect(await within(dialog).findByRole("alert")).toHaveProperty(
    "textContent",
    "This project already has 10 open deletions. Wait for them to finish.",
  );
  expect(posted(calls)[0]?.body).toEqual({ kind: "user", userId: "customer-7" });
});
