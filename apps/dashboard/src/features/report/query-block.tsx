import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Skeleton } from "../../shared/ui";
import { QueryFailure } from "./query-failure";

interface Props<T> {
  query: UseQueryResult<T>;
  /** Size of the loading placeholder, e.g. "h-96". */
  skeleton: string;
  children: (data: T) => ReactNode;
}

/** Data (kept while a new range loads), else the error with retry, else a skeleton. */
export function QueryBlock<T>({ query, skeleton, children }: Props<T>) {
  if (query.data !== undefined) return children(query.data);
  if (query.isError) return <QueryFailure query={query} />;
  return <Skeleton className={skeleton} />;
}
