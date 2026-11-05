/**
 * The Stocks page logic (US-2.9, US-2.10), kept out of the components so it can be tested:
 * filters, sorting, the digest's "your stocks first" order, the 52-week position and the CSV.
 */
import { differenceInCalendarDays, parseISO } from "date-fns";

import type { LatestSignal, ScreenRow, StrategyInfo } from "@/api/types";

import { sectorName } from "./sectors";

export type CapBand = "large" | "mid" | "small";
export const CAP_BANDS: { value: CapBand; label: string; min: number; max: number }[] = [
  { value: "large", label: "Large · ₦1T and over", min: 1e12, max: Infinity },
  { value: "mid", label: "Mid · ₦100B to ₦1T", min: 1e11, max: 1e12 },
  { value: "small", label: "Small · under ₦100B", min: 0, max: 1e11 },
];

/** Minimum value traded in the session or period */
export const LIQUIDITY: { value: number; label: string }[] = [
  { value: 1e7, label: "₦10M or more" },
  { value: 1e8, label: "₦100M or more" },
  { value: 1e9, label: "₦1B or more" },
];

/** A signal filter looks this far back from the latest session. */
export const SIGNAL_DAYS = 30;

export interface ScreenFilters {
  q: string;
  sectors: string[];
  subsectors: string[];
  cap: CapBand | null;
  minValue: number | null;
  /** The latest signal of `strategy` was this side within SIGNAL_DAYS */
  signal: "buy" | "sell" | null;
  strategy: string;
  watchlist: boolean;
  traded: boolean;
}

export type ScreenSortKey =
  "symbol" | "close" | "pct" | "change" | "volume" | "value" | "trades" | "days" | "market_cap" | "range52" | "signal";
export const SCREEN_SORT_KEYS: ScreenSortKey[] = [
  "symbol",
  "close",
  "pct",
  "change",
  "volume",
  "value",
  "trades",
  "days",
  "market_cap",
  "range52",
  "signal",
];

/** `-pct` → { key: "pct", desc: true }. Unknown values fall back to value traded, largest first. */
export function parseScreenSort(raw: string | null): { key: ScreenSortKey; desc: boolean } {
  const desc = raw?.startsWith("-") ?? true;
  const key = (raw?.replace(/^-/, "") ?? "value") as ScreenSortKey;
  return SCREEN_SORT_KEYS.includes(key) ? { key, desc } : { key: "value", desc: true };
}

/** Short names for tight spaces: "▲ Bullish MACD". */
export const strategyShort = (slug: string, strategies: StrategyInfo[] | undefined) =>
  ({ macd_crossover: "MACD", rsi_reversal: "RSI", sma_golden_cross: "50/200-day" })[slug] ??
  strategies?.find((s) => s.slug === slug)?.label ??
  slug;

export const signalOf = (r: ScreenRow, strategy: string): LatestSignal | undefined =>
  r.signals.find((s) => s.strategy === strategy);

/** Calendar days from a signal to the latest session. */
export const signalAge = (s: LatestSignal, latest: string) =>
  differenceInCalendarDays(parseISO(latest), parseISO(s.date));

/** Where the close sits in the 52-week range: 0 at the low, 1 at the high. */
export function range52(r: ScreenRow): number | null {
  if (r.close === null || r.low_52w === null || r.high_52w === null) return null;
  if (r.high_52w <= r.low_52w) return 0.5;
  return Math.min(1, Math.max(0, (r.close - r.low_52w) / (r.high_52w - r.low_52w)));
}

export const capBand = (cap: number | null): CapBand | null =>
  cap === null ? null : (CAP_BANDS.find((b) => cap >= b.min && cap < b.max)?.value ?? null);

const traded = (r: ScreenRow) => (r.trades ?? r.volume ?? 0) > 0;

export function matchesScreenQuery(r: ScreenRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  return (
    !needle ||
    r.symbol.toLowerCase().includes(needle) ||
    (r.company ?? "").toLowerCase().includes(needle) ||
    (r.subsector ?? "").toLowerCase().includes(needle)
  );
}

export function filterRows(rows: ScreenRow[], f: ScreenFilters, watch: Set<string>, latest: string): ScreenRow[] {
  return rows.filter((r) => {
    if (f.sectors.length && !f.sectors.includes(r.sector ?? "")) return false;
    if (f.subsectors.length && !f.subsectors.includes(r.subsector ?? "")) return false;
    if (f.cap && capBand(r.market_cap) !== f.cap) return false;
    if (f.minValue !== null && (r.value ?? 0) < f.minValue) return false;
    if (f.watchlist && !watch.has(r.symbol)) return false;
    if (f.traded && !traded(r)) return false;
    if (f.signal) {
      const s = signalOf(r, f.strategy);
      if (!s || s.side !== f.signal || signalAge(s, latest) > SIGNAL_DAYS) return false;
    }
    return matchesScreenQuery(r, f.q);
  });
}

/** The number a column sorts by; null sorts last either way. */
function sortValue(r: ScreenRow, key: Exclude<ScreenSortKey, "symbol">, strategy: string): number | null {
  switch (key) {
    case "close":
      return r.close;
    case "pct":
      return r.pct_change;
    case "change":
      return r.change;
    case "volume":
      return r.volume;
    case "value":
      return r.value;
    case "trades":
      return r.trades;
    case "days":
      return r.days;
    case "market_cap":
      return r.market_cap;
    case "range52":
      return range52(r);
    case "signal": {
      const s = signalOf(r, strategy);
      return s ? parseISO(s.date).getTime() : null; // newest first when descending
    }
  }
}

export function sortScreen(rows: ScreenRow[], key: ScreenSortKey, desc: boolean, strategy: string): ScreenRow[] {
  const dir = desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (key === "symbol") return dir * a.symbol.localeCompare(b.symbol);
    const x = sortValue(a, key, strategy);
    const y = sortValue(b, key, strategy);
    if (x === null && y === null) return a.symbol.localeCompare(b.symbol);
    if (x === null) return 1;
    if (y === null) return -1;
    return dir * (x - y) || a.symbol.localeCompare(b.symbol);
  });
}

/**
 * The digest's order, as finance apps do it: your watchlist first, then everything else, each in
 * the chosen sort. Filtering to the watchlist leaves a single group.
 */
export function digestGroups(rows: ScreenRow[], watch: Set<string>): { mine: ScreenRow[]; rest: ScreenRow[] } {
  return { mine: rows.filter((r) => watch.has(r.symbol)), rest: rows.filter((r) => !watch.has(r.symbol)) };
}

/** Sectors and their subsectors in the data, by number of stocks. */
export function sectorTree(rows: ScreenRow[]): { sector: string; count: number; subsectors: string[] }[] {
  const tree = new Map<string, { count: number; subsectors: Set<string> }>();
  for (const r of rows) {
    if (!r.sector) continue;
    const node = tree.get(r.sector) ?? { count: 0, subsectors: new Set<string>() };
    node.count += 1;
    if (r.subsector && r.subsector !== "—") node.subsectors.add(r.subsector);
    tree.set(r.sector, node);
  }
  return [...tree.entries()]
    .map(([sector, n]) => ({ sector, count: n.count, subsectors: [...n.subsectors].sort() }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector));
}

/** Formula-safe CSV of the rows on screen: a leading = + - @ is quoted with an apostrophe. */
export function screenCsv(rows: ScreenRow[], period: boolean): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    const safe = /^[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = [
    "Symbol",
    "Company",
    "Sector",
    "Subsector",
    period ? "Close" : "Price",
    "% change",
    "Change",
    "Volume",
    "Value (NGN)",
    period ? "Trading days" : "Deals",
    "Market cap (NGN)",
    "52-week low",
    "52-week high",
  ];
  const lines = rows.map((r) =>
    [
      r.symbol,
      r.company,
      r.sector ? sectorName(r.sector) : "",
      r.subsector,
      r.close,
      r.pct_change === null ? null : r.pct_change.toFixed(2),
      r.change,
      r.volume,
      r.value,
      period ? r.days : r.trades,
      r.market_cap === null ? null : Math.round(r.market_cap),
      r.low_52w,
      r.high_52w,
    ]
      .map(cell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n");
}

/** Compare holds at most this many stocks (the API's limit). */
export const MAX_COMPARE = 4;

export function parseSymbols(raw: string | null): string[] {
  const seen = new Set<string>();
  for (const s of (raw ?? "").split(",")) {
    const sym = s.trim().toUpperCase();
    if (/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(sym)) seen.add(sym);
  }
  return [...seen].slice(0, MAX_COMPARE);
}
