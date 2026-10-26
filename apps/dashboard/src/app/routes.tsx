import { Navigate, type RouteObject } from "react-router";
import { NotFoundPage } from "../features/not-found/page";
import { ProjectsPage } from "../features/projects/page";
import { ReportPage } from "../features/report/page";
import { AppShell } from "./app-shell";
import { ProjectLayout } from "./project-layout";
import { RequireAuth } from "./require-auth";

// Spec §13.3. Auth pages are public and lazy (forms + Zod load only there); everything else
// needs a session. Overview and Realtime have bodies; other reports keep the 5a frame until 5d.
export const routes: RouteObject[] = [
  {
    path: "login",
    lazy: { Component: async () => (await import("../features/auth/login-page")).LoginPage },
  },
  {
    path: "set-password",
    lazy: {
      Component: async () => (await import("../features/auth/set-password-page")).SetPasswordPage,
    },
  },
  {
    Component: RequireAuth,
    children: [
      {
        Component: AppShell,
        children: [
          { index: true, element: <Navigate to="/projects" replace /> },
          { path: "projects", Component: ProjectsPage },
          {
            path: "projects/:projectId",
            Component: ProjectLayout,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              {
                path: "overview",
                lazy: {
                  Component: async () => (await import("../features/overview/page")).OverviewPage,
                },
              },
              {
                path: "realtime",
                lazy: {
                  Component: async () => (await import("../features/realtime/page")).RealtimePage,
                },
              },
              { path: ":section", Component: ReportPage },
            ],
          },
          { path: "*", Component: NotFoundPage },
        ],
      },
    ],
  },
];
