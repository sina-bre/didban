import type { ComponentType } from "react";
import { Navigate, type RouteObject } from "react-router";
import { NotFoundPage } from "../features/not-found/page";
import { HomePage } from "../features/projects/home-page";
import { ProjectsPage } from "../features/projects/page";
import { AppShell } from "./app-shell";
import { ProjectLayout } from "./project-layout";
import { RequireAuth } from "./require-auth";
import { accountRoutes, projectSettings, shareRoute } from "./settings-routes";

// Spec §13.3. Auth pages are public and lazy (forms + Zod load only there); everything else
// needs a session. Every report is its own lazy chunk; an unknown section is "not found".
const page = (path: string, load: () => Promise<ComponentType>): RouteObject => ({
  path,
  lazy: { Component: load },
});

const reports: RouteObject[] = [
  page("overview", async () => (await import("../features/overview/page")).OverviewPage),
  page("realtime", async () => (await import("../features/realtime/page")).RealtimePage),
  page("pages", async () => (await import("../features/pages/page")).PagesPage),
  page("pages/detail", async () => (await import("../features/pages/detail-page")).PageDetailPage),
  page("sources", async () => (await import("../features/sources/page")).SourcesPage),
  page("geo", async () => (await import("../features/geo/page")).GeoPage),
  page("devices", async () => (await import("../features/devices/page")).DevicesPage),
  page("events", async () => (await import("../features/events/page")).EventsPage),
  page("goals", async () => (await import("../features/goals/page")).GoalsPage),
  page("data-health", async () => (await import("../features/data-health/page")).DataHealthPage),
];

export const routes: RouteObject[] = [
  page("login", async () => (await import("../features/auth/login-page")).LoginPage),
  page(
    "set-password",
    async () => (await import("../features/auth/set-password-page")).SetPasswordPage,
  ),
  shareRoute,
  {
    Component: RequireAuth,
    children: [
      {
        Component: AppShell,
        children: [
          { index: true, Component: HomePage },
          { path: "projects", Component: ProjectsPage },
          ...accountRoutes,
          {
            path: "projects/:projectId",
            Component: ProjectLayout,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              ...reports,
              projectSettings,
            ],
          },
          { path: "*", Component: NotFoundPage },
        ],
      },
    ],
  },
];
