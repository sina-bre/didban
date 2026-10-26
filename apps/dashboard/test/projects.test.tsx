import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi } from "./fake-api";
import { orgs, signedIn } from "./fixtures";
import { renderApp } from "./render-app";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const noProjects = (role: "owner" | "admin" | "member") => ({
  ...signedIn(),
  "GET /organizations": { organizations: orgs.organizations.map((org) => ({ ...org, role })) },
  "GET /projects": { projects: [] },
});

describe("/projects with nothing to open", () => {
  it.each(["owner", "admin"] as const)("%s: the organization has no projects", async (role) => {
    fakeApi(noProjects(role));
    renderApp("/projects");
    expect(await screen.findByText("No projects yet", {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText("Your organization has no projects yet.")).toBeTruthy();
    expect(screen.queryByText(/Ask an owner or admin/)).toBeNull();
  });

  it("member: ask an owner or admin for access", async () => {
    fakeApi(noProjects("member"));
    renderApp("/projects");
    expect(await screen.findByText(/Ask an owner or admin/, {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByText("Your organization has no projects yet.")).toBeNull();
  });
});
