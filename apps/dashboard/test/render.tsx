import { type RenderResult, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import en from "../src/messages/en";
import fa from "../src/messages/fa";
import { dirOf, type Locale } from "../src/shared/lib/i18n";
import { LocaleProvider } from "../src/shared/lib/locale-context";

type Rendered = RenderResult & { router: ReturnType<typeof createMemoryRouter> };

/** Renders a widget inside the locale and a memory router, with `<html lang dir>` set. */

export function renderUi(ui: ReactNode, { locale = "en" as Locale, path = "/" } = {}): Rendered {
  document.documentElement.lang = locale;
  document.documentElement.dir = dirOf(locale);
  const router = createMemoryRouter([{ path: "*", element: ui }], { initialEntries: [path] });
  const result = render(
    <LocaleProvider initial={locale} messages={locale === "fa" ? fa : en}>
      <RouterProvider router={router} />
    </LocaleProvider>,
  );
  return { ...result, router };
}
