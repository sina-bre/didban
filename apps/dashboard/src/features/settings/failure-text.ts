import { ApiError } from "../../shared/lib/api-client";
import type { MessageKey, Translate } from "../../shared/lib/i18n";

/** Management errors the UI explains; anything else is the generic failure with retry advice. */
const KNOWN = new Set([
  "EMAIL_TAKEN",
  "ENVIRONMENT_EXISTS",
  "FORBIDDEN",
  "INVALID_ORGANIZATION_NAME",
  "KEY_LIMIT_REACHED",
  "LAST_OWNER",
  "RESET_NEEDS_OPERATOR",
  "ROUTE_TEMPLATE_EXISTS",
  "ROUTE_TEMPLATE_LIMIT",
  "SHARE_LINK_LIMIT_REACHED",
  "VALIDATION_FAILED",
]);

/** A failed change as one sentence for the form or dialog that sent it. */
export function failureText(t: Translate, error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return KNOWN.has(code) ? t(`error.${code}` as MessageKey) : t("state.error.body");
}
