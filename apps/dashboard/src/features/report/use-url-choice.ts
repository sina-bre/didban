import { useSearchParams } from "react-router";

/**
 * One of `choices` kept in the URL as `?<param>=` (report views and dimensions, so a shared link
 * opens the same table). The first choice is the default and is not written.
 */
export function useUrlChoice<T extends string>(param: string, choices: readonly T[]) {
  const [params, setParams] = useSearchParams();
  const raw = params.get(param) as T | null;
  const value = raw && choices.includes(raw) ? raw : (choices[0] as T);
  const choose = (next: T) => {
    const search = new URLSearchParams(params);
    if (next === choices[0]) search.delete(param);
    else search.set(param, next);
    setParams(search);
  };
  return [value, choose] as const;
}
