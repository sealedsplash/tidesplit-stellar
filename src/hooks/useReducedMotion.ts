/**
 * Accessibility helper: honors the user's prefers-reduced-motion setting.
 * The initial value is read lazily so no setState fires inside an effect.
 */
import { useEffect, useState } from "react";

function readPreference(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readPreference);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}
