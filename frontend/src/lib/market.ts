/**
 * Market Today logic, kept out of the components so it can be tested: one row shape for a
 * session and a period, the movers rules of US-2.2, the template headline of US-2.1, and the
 * period presets of US-2.5.
 */
import { format, parseISO, startOfYear, subMonths, subWeeks, subYears } from "date-fns";

import type { Quote, RangeRow } from "@/api/types";

import { sectorName } from "./sectors";
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

/**
 * The page headline of US-2.1, in the display serif: chosen from fixed wording by how lopsided
 * breadth was. A template, never AI, so it costs nothing and reads the same for everyone.
 */
export function marketTitle(t: Totals, period: boolean): string {
  const moved = t.up + t.down;
  if (moved === 0) return period ? "A flat stretch." : "A quiet session.";
  if (t.up === t.down) return "A split market.";
  const share = Math.max(t.up, t.down) / moved;
  const bulls = t.up > t.down;
  if (share >= 0.7) return bulls ? "A broad rally." : "Sellers in control.";
  if (share >= 0.55) return bulls ? "Buyers had the edge." : "Sellers had the edge.";
  const span = period ? "stretch" : "day";
  return bulls ? `A narrow ${span} for the bulls.` : `A narrow ${span} for the bears.`;
}

export interface SectorMove {
  sector: string;
  avg_pct_change: number | null;
}

/** "ICT" stays upper case; anything else reads lower case mid-sentence. */
const midSentence = (sector: string) => {
  const name = sectorName(sector);
  return name === name.toUpperCase() ? name : name.charAt(0).toLowerCase() + name.slice(1);
};

/**
 * The standfirst under the headline (US-2.1): breadth, how trading compared with the session
 * before, and which sectors led and dragged. "More stocks rose than fell, 19 to 18, but trading
 * thinned: ₦8.4B changed hands, 44% less than the session before. ICT led; oil & gas dragged."
 */
export function standfirst(t: Totals, prev: Totals | null, sectors: SectorMove[], period: boolean): string {
  const breadth =
    t.up === 0 && t.down === 0
      ? `No prices moved${period ? " over the period" : ""}`
      : t.up > t.down
        ? `More stocks rose than fell, ${t.up} to ${t.down}`
        : t.down > t.up
          ? `More stocks fell than rose, ${t.down} to ${t.up}`
          : `As many stocks rose as fell, ${t.up} each`;
  let trading = `. ${money(t.value)} traded${period ? " over the period" : ""}.`;
  if (!period && prev?.value) {
    const change = ((t.value - prev.value) / prev.value) * 100;
    const pct = `${Math.round(Math.abs(change))}%`;
    trading =
      change <= -10
        ? `, but trading thinned: ${money(t.value)} changed hands, ${pct} less than the session before.`
        : change >= 10
          ? `, and trading picked up: ${money(t.value)} changed hands, ${pct} more than the session before.`
          : `. ${money(t.value)} changed hands, about the same as the session before.`;
  }
  const ranked = sectors
    .filter((x): x is SectorMove & { avg_pct_change: number } => x.avg_pct_change !== null)
    .sort((x, y) => y.avg_pct_change - x.avg_pct_change);
  const best = ranked[0];
  const worst = ranked.at(-1);
  let lead = "";
  if (best && best.avg_pct_change > 0 && worst && worst.avg_pct_change < 0 && best !== worst) {
    lead = ` ${sectorName(best.sector)} led; ${midSentence(worst.sector)} dragged.`;
  } else if (best && best.avg_pct_change > 0) {
    lead = ` ${sectorName(best.sector)} led.`;
  } else if (worst && worst.avg_pct_change < 0) {
    lead = ` ${sectorName(worst.sector)} fell the most.`;
  }
  return breadth + trading + lead;
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
