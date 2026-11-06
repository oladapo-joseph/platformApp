/**
 * Stock page logic, testable without a browser: the chart ranges and view options kept in the
 * URL (US-3.3–3.5, US-3.9), indicator explainers, descriptive signal wording, the chart's
 * accessible summary (US-3.11), and the CSV export (US-3.8).
 */
import { differenceInCalendarDays, format, parseISO, startOfYear, subMonths, subYears } from "date-fns";

import type { Bar, SignalEvent } from "@/api/types";

import { percent, price, spokenChange } from "./format";

export const RANGES = ["1M", "3M", "6M", "YTD", "1Y", "ALL"] as const;
export type ChartRange = (typeof RANGES)[number];

const RANGE_WORDS: Record<ChartRange, string> = {
  "1M": "1 month",
  "3M": "3 months",
  "6M": "6 months",
  YTD: "this year",
  "1Y": "1 year",
  ALL: "all history",
};

export const rangeWords = (r: ChartRange) => RANGE_WORDS[r];

/** First trade date of a range ending on `latest`; null = full history. */
export function rangeStart(range: ChartRange, latest: string): string | null {
  const end = parseISO(latest);
  const start = {
    "1M": () => subMonths(end, 1),
    "3M": () => subMonths(end, 3),
    "6M": () => subMonths(end, 6),
    YTD: () => startOfYear(end),
    "1Y": () => subYears(end, 1),
    ALL: () => null,
  }[range]();
  return start ? format(start, "yyyy-MM-dd") : null;
}

/** "Showing 34 trading days" when a stock has less history than the range asks for. */
export function shortHistory(range: ChartRange, requestedStart: string | null, bars: Bar[]): string | null {
  const first = bars[0]?.date;
  if (range === "ALL" || !requestedStart || !first) return null;
  return differenceInCalendarDays(parseISO(first), parseISO(requestedStart)) > 7
    ? `Showing ${bars.length} trading day${bars.length === 1 ? "" : "s"}`
    : null;
}

export const OVERLAYS = ["sma50", "sma200", "ema12", "ema26", "bb20"] as const;
export type Overlay = (typeof OVERLAYS)[number];
export const PANES = ["volume", "rsi14", "macd"] as const;
export type Pane = (typeof PANES)[number];

export const STRATEGY_ALIASES: Record<string, string> = {
  macd: "macd_crossover",
  rsi: "rsi_reversal",
  sma: "sma_golden_cross",
};
export const DEFAULT_STRATEGY = "macd_crossover";

interface IndicatorInfo {
  label: string;
  explainer: string;
}

/** One-line explainers (US-3.4); calm and descriptive, never advice. */
export const INDICATORS: Record<Overlay | Pane, IndicatorInfo> = {
  sma50: {
    label: "SMA 50",
    explainer: "The average close of the last 50 sessions: a price above it often means an uptrend.",
  },
  sma200: { label: "SMA 200", explainer: "The long-term trend line: the average close of the last 200 sessions." },
  ema12: {
    label: "EMA 12",
    explainer: "A 12-day average weighted towards recent days, so it turns sooner than a plain average.",
  },
  ema26: { label: "EMA 26", explainer: "A 26-day weighted average; with EMA 12 it forms the MACD." },
  bb20: {
    label: "Bollinger 20",
    explainer:
      "A band two standard deviations either side of the 20-day average: touching an edge means an unusually large move.",
  },
  volume: {
    label: "Volume",
    explainer: "Shares traded each day. Moves on high volume carry more weight than moves on thin trading.",
  },
  rsi14: {
    label: "RSI 14",
    explainer: "RSI above 70 often means a stock has risen quickly and may cool off; below 30, it may be oversold.",
  },
  macd: {
    label: "MACD 12/26/9",
    explainer: "The gap between the 12- and 26-day EMAs and its 9-day signal line; crossings mark changes in momentum.",
  },
};

/** The `set` query for /indicators: only what's switched on. */
export function indicatorSet(overlays: Overlay[], panes: Pane[]): string {
  return [...overlays, ...panes.filter((p) => p !== "volume")].join(",");
}

function parseList<T extends string>(raw: string | null, allowed: readonly T[], fallback: T[]): T[] {
  if (raw === null) return fallback;
  if (raw === "none") return [];
  return raw.split(",").filter((x): x is T => (allowed as readonly string[]).includes(x));
}

export interface StockView {
  range: ChartRange;
  type: "candle" | "line";
  overlays: Overlay[];
  panes: Pane[];
  strategy: string;
  table: boolean;
  /** News markers under the chart (US-9.2); on unless the URL says news=off */
  news: boolean;
}

/** Reads the URL. Defaults: 6M candles with the volume pane, MACD crossover (US-3.3, US-3.4). */
export function parseView(params: URLSearchParams): StockView {
  const range = params.get("range")?.toUpperCase() as ChartRange | undefined;
  const strategy = params.get("strategy") ?? DEFAULT_STRATEGY;
  return {
    range: range && RANGES.includes(range) ? range : "6M",
    type: params.get("type") === "line" ? "line" : "candle",
    overlays: parseList(params.get("overlays"), OVERLAYS, []),
    panes: parseList(params.get("panes"), PANES, ["volume"]),
    strategy: STRATEGY_ALIASES[strategy] ?? strategy,
    table: params.get("view") === "table",
    news: params.get("news") !== "off",
  };
}

/** Lists are written as a comma list; an empty list as "none" so it's distinguishable from "default". */
export const writeList = (items: string[]) => (items.length ? items.join(",") : "none");

const WORDING: Record<string, { buy: string; sell: string }> = {
  macd_crossover: { buy: "MACD crossed above its signal line", sell: "MACD crossed below its signal line" },
  rsi_reversal: {
    buy: "RSI rose back above 30, recovering from oversold",
    sell: "RSI fell back below 70, cooling from overbought",
  },
  sma_golden_cross: {
    buy: "The 50-day average crossed above the 200-day (golden cross)",
    sell: "The 50-day average crossed below the 200-day (death cross)",
  },
};

/** What happened, never what to do (US-3.5). */
export function signalWording(strategy: string, side: "buy" | "sell"): string {
  return WORDING[strategy]?.[side] ?? (side === "buy" ? "Bullish signal" : "Bearish signal");
}

/** % move from the signal's price to the latest close in the range. */
export function sinceSignal(s: SignalEvent, lastClose: number | null | undefined): number | null {
  return lastClose && s.price ? ((lastClose - s.price) / s.price) * 100 : null;
}

export function signalSummary(signals: SignalEvent[], range: ChartRange, latest: string | null | undefined): string {
  const bulls = signals.filter((s) => s.side === "buy").length;
  const bears = signals.length - bulls;
  const span = range === "ALL" ? "in all history" : range === "YTD" ? "this year" : `in ${RANGE_WORDS[range]}`;
  const counts = `${bulls} bullish and ${bears} bearish signal${bears === 1 ? "" : "s"} ${span}`;
  const last = signals.at(-1);
  if (!last || !latest) return counts;
  const days = differenceInCalendarDays(parseISO(latest), parseISO(last.date));
  const ago = days === 0 ? "on the latest session" : days === 1 ? "1 day ago" : `${days} days ago`;
  return `${counts}. Latest: ${last.side === "buy" ? "bullish" : "bearish"}, ${ago}.`;
}

/** "MTNN, 6 months, down 19.03 percent, last ₦201.05, 1 bullish and 2 bearish signals" (US-3.11). */
export function chartSummary(
  symbol: string,
  range: ChartRange,
  pct: number | null | undefined,
  last: number | null | undefined,
  signals: SignalEvent[],
): string {
  const bulls = signals.filter((s) => s.side === "buy").length;
  const parts = [symbol, RANGE_WORDS[range], spokenChange(null, pct ?? null), `last ${price(last)}`];
  parts.push(`${bulls} bullish and ${signals.length - bulls} bearish signals`);
  return parts.join(", ");
}

export function barSentence(b: Bar): string {
  return `${b.date}: open ${price(b.open)}, high ${price(b.high)}, low ${price(b.low)}, close ${price(b.close)}, ${percent(b.pct_change)}`;
}

/** The selected range as CSV, dates as WAT trade dates (US-3.8). */
export function barsCsv(bars: Bar[]): string {
  const cell = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const rows = [...bars]
    .reverse()
    .map((b) =>
      [
        b.date,
        b.open,
        b.high,
        b.low,
        b.close,
        b.pct_change === null ? null : b.pct_change.toFixed(4),
        b.volume,
        b.value,
        b.trades,
      ]
        .map(cell)
        .join(","),
    );
  return ["Date,Open,High,Low,Close,Change %,Volume,Value,Deals", ...rows].join("\n") + "\n";
}

export function csvFilename(symbol: string, bars: Bar[]): string {
  return `${symbol}_${bars[0]?.date ?? "start"}_${bars.at(-1)?.date ?? "end"}.csv`;
}

/** 52-week range, only when there's close to a year of sessions. */
export function yearRange(bars: Bar[]): { low: number; high: number } | null {
  if (bars.length < 200) return null;
  const lows = bars.map((b) => b.low).filter((v): v is number => v !== null && v > 0);
  const highs = bars.map((b) => b.high).filter((v): v is number => v !== null && v > 0);
  return lows.length && highs.length ? { low: Math.min(...lows), high: Math.max(...highs) } : null;
}
