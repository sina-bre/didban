import { AppError } from "../../http/app-error.js";

/** Second gate behind `@Requires("platform")` (ADR 0019), so a new route cannot skip it. */
export function assertPlatformAdmin(actor: { isPlatformAdmin: boolean }): void {
  if (!actor.isPlatformAdmin) throw new AppError(403, "FORBIDDEN", "Not allowed");
}
