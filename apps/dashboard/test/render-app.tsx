import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, type RouteObject, RouterProvider } from "react-router";
import { createQueryClient } from "../src/app/query-client";
import { routes } from "../src/app/routes";
import en from "../src/messages/en";
import fa from "../src/messages/fa";
import { dirOf, type Locale } from "../src/shared/lib/i18n";
import { LocaleProvider } from "../src/shared/lib/locale-context";

/** A fresh copy per router: React Router writes resolved `lazy` parts back into route objects. */
const fresh = (list: RouteObject[]): RouteObject[] =>
  list.map((route) => ({
    ...route,
    ...(typeof route.lazy === "object" ? { lazy: { ...route.lazy } } : {}),
    ...(route.children ? { children: fresh(route.children) } : {}),
  })) as RouteObject[];

/** The whole app (real routes, real query client) at `path`, against the stubbed fetch. */
export function renderApp(path: string, { locale = "en" as Locale } = {}) {
  document.documentElement.lang = locale;
  document.documentElement.dir = dirOf(locale);
  const router = createMemoryRouter(fresh(routes), { initialEntries: [path] });
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  render(
    <LocaleProvider initial={locale} messages={locale === "fa" ? fa : en}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </LocaleProvider>,
  );
  return { router, client };
}
