/**
 * Market Today logic, kept out of the components so it can be tested: one row shape for a
 * session and a period, the movers rules of US-2.2, the template headline of US-2.1, and the
 * period presets of US-2.5.
 */
import { format, parseISO, startOfYear, subMonths, subWeeks, subYears } from "date-fns";

import type { Quote, RangeRow } from "@/api/types";

import { money } from "./format";

export interface MarketRow {
  symbol: string;
  company: string;
  sector: string;
  close: number | null;
  change: number | null;
  pct: number | null;
  volume: number;
  value: number;
  /** Deals in a session; null for a period (the API reports trading days instead) */
  trades: number | null;
  /** Trading days with data, for a period; null for a session */
  days: number | null;
}

export function fromQuotes(quotes: Quote[]): MarketRow[] {
  return quotes.map((q) => ({
    symbol: q.symbol,
    company: q.company ?? q.symbol,
    sector: q.sector ?? "Other",
    close: q.close,
    change: q.change,
    pct: q.pct_change,
    volume: q.volume ?? 0,
    value: q.value ?? 0,
    trades: q.trades ?? 0,
    days: null,
  }));
}

export function fromRange(rows: RangeRow[]): MarketRow[] {
  return rows.map((r) => ({
    symbol: r.symbol,
    company: r.company ?? r.symbol,
    sector: r.sector ?? "Other",
    close: r.close,
    change: r.change,
    pct: r.pct_change,
    volume: r.volume,
    value: r.value,
    trades: null,
    days: r.days,
  }));
}

/** A move only counts if money changed hands (US-2.2: a price move on no trades is noise). */
const traded = (r: MarketRow) => (r.trades ?? r.volume) > 0;

export const MOVERS_N = 5;

export function movers(rows: MarketRow[]) {
  const moved = rows.filter((r) => traded(r) && r.pct !== null);
  return {
    gainers: moved
      .filter((r) => (r.pct ?? 0) > 0)
      .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
      .slice(0, MOVERS_N),
    losers: moved
      .filter((r) => (r.pct ?? 0) < 0)
      .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
      .slice(0, MOVERS_N),
    mostTraded: rows
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, MOVERS_N),
  };
}

export interface Totals {
  up: number;
  down: number;
  flat: number;
  value: number;
  volume: number;
  trades: number | null;
  days: number | null;
}

export function totals(rows: MarketRow[]): Totals {
  const up = rows.filter((r) => (r.pct ?? 0) > 0).length;
  const down = rows.filter((r) => (r.pct ?? 0) < 0).length;
  const session = rows.some((r) => r.trades !== null);
  return {
    up,
    down,
    flat: rows.length - up - down,
    value: rows.reduce((s, r) => s + r.value, 0),
    volume: rows.reduce((s, r) => s + r.volume, 0),
    trades: session ? rows.reduce((s, r) => s + (r.trades ?? 0), 0) : null,
    days: session ? null : Math.max(0, ...rows.map((r) => r.days ?? 0)),
  };
}

/** The newspaper standfirst of US-2.1: a template, never AI. */
export function headline(t: Totals, period: boolean): string {
  const when = period ? "over the period" : "today";
  const counts = `(${t.up} up, ${t.down} down)`;
  const lead =
    t.up === 0 && t.down === 0
      ? `No prices moved ${when}.`
      : t.up > t.down
        ? `More stocks rose than fell ${when} ${counts}.`
        : t.down > t.up
          ? `More stocks fell than rose ${when} ${counts}.`
          : `As many stocks rose as fell ${when} ${counts}.`;
  return `${lead} ${money(t.value)} traded.`;
}

export type Preset = "1W" | "1M" | "3M" | "YTD" | "1Y";
export const PRESETS: Preset[] = ["1W", "1M", "3M", "YTD", "1Y"];

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Preset periods ending on the latest trading day. */
export function presetRange(preset: Preset, latest: string): { start: string; end: string } {
  const end = parseISO(latest);
  const start = {
    "1W": () => subWeeks(end, 1),
    "1M": () => subMonths(end, 1),
    "3M": () => subMonths(end, 3),
    YTD: () => startOfYear(end),
    "1Y": () => subYears(end, 1),
  }[preset]();
  return { start: iso(start), end: latest };
}

/** Which preset (if any) a start/end pair is, so the control can show it selected. */
export function matchPreset(start: string, end: string, latest: string): Preset | null {
  if (end !== latest) return null;
  return PRESETS.find((p) => presetRange(p, latest).start === start) ?? null;
}

/** "1 Sep – 24 Oct 2026" (one year shown once), "3 Nov 2025 – 24 Oct 2026" across years. */
export function periodLabel(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${format(s, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(e, "d MMM yyyy")}`;
}

/** The API serves at most 3 years per period request. */
export function earliestStart(latest: string): string {
  return iso(subYears(parseISO(latest), 3));
}

export type SortKey = "symbol" | "close" | "change" | "pct" | "volume" | "value" | "trades" | "days";
export const SORT_KEYS: SortKey[] = ["symbol", "close", "change", "pct", "volume", "value", "trades", "days"];

/** `-pct` → { key: "pct", desc: true }. Unknown values fall back to value traded, largest first. */
export function parseSort(raw: string | null): { key: SortKey; desc: boolean } {
  const desc = raw?.startsWith("-") ?? true;
  const key = (raw?.replace(/^-/, "") ?? "value") as SortKey;
  return SORT_KEYS.includes(key) ? { key, desc } : { key: "value", desc: true };
}

export function matchesQuery(r: MarketRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  return !needle || r.symbol.toLowerCase().includes(needle) || r.company.toLowerCase().includes(needle);
}

/** Sort rows by a column; missing values always last, ties by ticker. */
export function sortRows(rows: MarketRow[], key: SortKey, desc: boolean): MarketRow[] {
  const dir = desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (key === "symbol") return dir * a.symbol.localeCompare(b.symbol);
    const x = a[key];
    const y = b[key];
    if (x === null && y === null) return a.symbol.localeCompare(b.symbol);
    if (x === null) return 1;
    if (y === null) return -1;
    return dir * (x - y) || a.symbol.localeCompare(b.symbol);
  });
}
