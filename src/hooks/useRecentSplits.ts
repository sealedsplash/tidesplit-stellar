import { useCallback, useEffect, useState } from "react";

export interface RecentSplit {
  id: string;
  totalXlm: string;
  participants: number;
  shareXlm: string;
  recipient: string;
  recordedAt: string;
}

const STORAGE_KEY = "tidesplit.recent-calculations";
const LIMIT = 5;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Load saved calculations once; tolerate corrupted or missing storage. */
function load(): RecentSplit[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentSplit =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RecentSplit).shareXlm === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Local-only history of recent split calculations.
 * Nothing leaves the browser; clearing site data clears the list.
 */
export function useRecentSplits() {
  const [recent, setRecent] = useState<RecentSplit[]>([]);

  useEffect(() => {
    setRecent(load());
  }, []);

  const record = useCallback((entry: Omit<RecentSplit, "id" | "recordedAt">) => {
    const next: RecentSplit[] = [
      { ...entry, id: crypto.randomUUID(), recordedAt: new Date().toISOString() },
      ...load(),
    ].slice(0, LIMIT);
    if (isBrowser()) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage full or blocked; keep in-memory only.
      }
    }
    setRecent(next);
  }, []);

  const clearAll = useCallback(() => {
    if (isBrowser()) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage failures on clear.
      }
    }
    setRecent([]);
  }, []);

  return { recent, record, clearAll };
}
