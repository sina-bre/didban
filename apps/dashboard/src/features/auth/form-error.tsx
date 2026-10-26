import { ErrorState } from "../../shared/components";
import { ApiError } from "../../shared/lib/api-client";

interface Props {
  error: Error | null;
  /** A known answer ("wrong password"); anything else is the generic error with its request ID. */
  message?: string;
}

/** The form-level failure, announced (`role=alert`), above the first field. */
export function FormError({ error, message }: Props) {
  if (!error) return null;
  if (message) {
    return (
      <p role="alert" className="rounded-control bg-down-soft px-3 py-2 text-body text-down">
        {message}
      </p>
    );
  }
  return <ErrorState requestId={error instanceof ApiError ? error.requestId : undefined} />;
}
