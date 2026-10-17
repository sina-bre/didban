/** An expected failure with a stable public code (spec §6.5 error body). */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Same body for "missing" and "not yours": existence hiding (spec §11). */
export const notFound = () => new AppError(404, "NOT_FOUND", "Resource not found");
