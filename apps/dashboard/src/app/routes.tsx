import { Navigate, type RouteObject } from "react-router";
import { NotFoundPage } from "../features/not-found/page";
import { ReportPage } from "../features/report/page";
import { AppShell } from "./app-shell";

// Spec §13.3. Stage 5a: the project report frame; auth, project list and settings come in 5c–5e.
export const routes: RouteObject[] = [
  {
    Component: AppShell,
    children: [
      { path: "projects/:projectId", element: <Navigate to="overview" replace /> },
      { path: "projects/:projectId/:section", Component: ReportPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
];
