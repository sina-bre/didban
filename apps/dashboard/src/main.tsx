import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/vazirmatn/wght.css";
import "./styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { prefetchFirstScreen } from "./app/prefetch";
import { createQueryClient } from "./app/query-client";
import { routes } from "./app/routes";
import { applyLocale, preferredLocale } from "./shared/lib/document-locale";
import { loadMessages } from "./shared/lib/i18n";
import { LocaleProvider } from "./shared/lib/locale-context";

// Direction and messages are settled before the first paint, so RTL never flashes as LTR. The
// router (lazy route code) and the first reads start first, so they load alongside the messages.
const locale = preferredLocale();
applyLocale(locale);
const queryClient = createQueryClient();
prefetchFirstScreen(queryClient, window.location);
const router = createBrowserRouter(routes);
const messages = await loadMessages(locale);

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");
createRoot(root).render(
  <StrictMode>
    <LocaleProvider initial={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </LocaleProvider>
  </StrictMode>,
);
