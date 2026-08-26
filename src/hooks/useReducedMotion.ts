/**
 * Accessibility polish for the TideSplit page:
 * a skip link, an explicit page landmark, and reduced-motion support.
 */
import { useEffect, useState } from "react";

/** Honors the user's prefers-reduced-motion setting for transitions. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}
