const METHODS = ["pushState", "replaceState"] as const;

/**
 * Wraps `history.pushState/replaceState`, calling whatever was there before (other libraries'
 * patches keep working). The returned function restores the previous method when ours is still
 * on top; if another library patched over us, our wrapper stays in their chain but goes inert.
 */
export function patchHistory(onChange: () => void): () => void {
  const history = window.history;
  let active = true;
  const restores = METHODS.map((method) => {
    const previous = history[method];
    const patched = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = previous.apply(this, args);
      if (active) {
        try {
          onChange();
        } catch {
          // Never break the host's navigation.
        }
      }
      return result;
    };
    history[method] = patched;
    return () => {
      if (history[method] === patched) history[method] = previous;
    };
  });
  return () => {
    active = false;
    for (const restore of restores) restore();
  };
}
