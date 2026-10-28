/** Symbol search ranking and the recent-stocks list (US-3.1). */
import type { DirectoryEntry } from "@/api/types";

/**
 * Exact ticker, then ticker prefix, then a company word starting with the query, then the
 * query anywhere. "dang" → DANGCEM, DANGSUGAR; "zenith" → ZENITHBANK.
 */
export function rankStocks(entries: DirectoryEntry[], query: string, limit = 8): DirectoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = (e: DirectoryEntry) => {
    const sym = e.symbol.toLowerCase();
    const name = e.company.toLowerCase();
    if (sym === q) return 0;
    if (sym.startsWith(q)) return 1;
    if (name.split(/[\s&.,()-]+/).some((w) => w.startsWith(q))) return 2;
    if (sym.includes(q) || name.includes(q)) return 3;
    return 9;
  };
  return entries
    .map((e) => ({ e, s: score(e) }))
    .filter((x) => x.s < 9)
    .sort((a, b) => a.s - b.s || a.e.symbol.localeCompare(b.e.symbol))
    .slice(0, limit)
    .map((x) => x.e);
}

/** Splits `text` around the first case-insensitive match, for <mark> highlighting. */
export function splitMatch(text: string, query: string): [string, string, string] {
  const q = query.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  return i < 0 ? [text, "", ""] : [text.slice(0, i), text.slice(i, i + q.length), text.slice(i + q.length)];
}

const RECENT_KEY = "el-recent-stocks";
const RECENT_MAX = 5;

export function recentStocks(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberStock(symbol: string): void {
  try {
    const next = [symbol, ...recentStocks().filter((s) => s !== symbol)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode: recents just aren't kept */
  }
}

/** Shown when nothing matches, or before any data loads (US-1.8's fallback list). */
export const POPULAR_FALLBACK = ["MTNN", "DANGCEM", "ZENITHBANK", "GTCO", "AIRTELAFRI"];

/** Dispatch on window to open the search palette from anywhere (e.g. an unknown ticker page). */
export const OPEN_SEARCH_EVENT = "el-open-search";

export function openSearch(): void {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
