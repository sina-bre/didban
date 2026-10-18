export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * localStorage with an in-memory fallback. Safari private mode, blocked cookies and sandboxed
 * iframes throw on access; every call is guarded and falls back to memory, never throws.
 */
export function createStore(): Store {
  const memory = new Map<string, string>();
  const attempt = <T>(run: (local: Storage) => T): T | undefined => {
    try {
      return run(window.localStorage);
    } catch {
      return undefined;
    }
  };
  return {
    get: (key) => attempt((local) => local.getItem(key)) ?? memory.get(key) ?? null,
    set(key, value) {
      memory.set(key, value);
      attempt((local) => local.setItem(key, value));
    },
    remove(key) {
      memory.delete(key);
      attempt((local) => local.removeItem(key));
    },
  };
}
