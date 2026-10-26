import { Navigate, Outlet, useLocation } from "react-router";
import { useMe } from "../features/auth/use-me";
import { QueryFailure } from "../features/report/query-failure";
import { ApiError } from "../shared/lib/api-client";
import { Skeleton } from "../shared/ui";

/**
 * Everything but the auth pages needs a session. No session: the api-client already sends the
 * browser to /login. A temporary password: /set-password first (ADR 0024).
 */
export function RequireAuth() {
  const me = useMe();
  const { pathname, search } = useLocation();
  if (me.isPending) return <Skeleton className="m-4 h-16" />;
  if (me.isError) {
    const lost = me.error instanceof ApiError && me.error.status === 401;
    return lost ? null : <QueryFailure query={me} />; // lost: the redirect to /login is under way
  }
  if (me.data.user.mustChangePassword) {
    return <Navigate to={`/set-password?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return <Outlet />;
}
