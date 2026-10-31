import { type RefObject, useEffect, useState } from "react";

/**
 * True once the element has come into view, and from then on. Heavy below-the-fold parts (the
 * Recharts chunk) load on demand instead of competing with the first screen's data on a phone.
 * Without IntersectionObserver (old browsers, jsdom) it is true at once.
 */
export function useInView(ref: RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const element = ref.current;
    if (seen || !element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, seen]);
  return seen;
}
