/**
 * Compare logic (US-3.10), kept out of the components so it can be tested: periods, series
 * names and styles, the summary sentence and plain words for a correlation.
 */
import { format, parseISO, subYears } from "date-fns";

import type { CompareResponse, CompareSeries } from "@/api/types";

import { percent } from "./format";
import { sectorName } from "./sectors";
import { rangeStart } from "./stock";

export const COMPARE_RANGES = ["1M", "3M", "6M", "YTD", "1Y", "3Y"] as const;
export type CompareRange = (typeof COMPARE_RANGES)[number];
export const DEFAULT_COMPARE_RANGE: CompareRange = "1Y";

export function compareStart(range: CompareRange, latest: string): string {
  if (range === "3Y") return format(subYears(parseISO(latest), 3), "yyyy-MM-dd");
  return rangeStart(range, latest) ?? latest;
}

export const BENCHMARK_OPTIONS = [
  { value: "sector", label: "Sector average" },
  { value: "market", label: "All-stock average" },
] as const;
export type Benchmark = (typeof BENCHMARK_OPTIONS)[number]["value"];

/** Colour token and dash per line: stocks solid in series order; a sector average dashed in the colour of
 * the first stock from that sector; the all-stock average dotted grey. Never colour alone: the legend
 * and the axis labels name every line. */
export interface LineStyleSpec {
  token: string;
  dash: "solid" | "dashed" | "dotted";
}

export function seriesStyles(series: CompareSeries[]): Map<string, LineStyleSpec> {
  const styles = new Map<string, LineStyleSpec>();
  const stocks = series.filter((s) => s.kind === "stock");
  stocks.forEach((s, i) => styles.set(s.key, { token: `--chart-series-${i + 1}`, dash: "solid" }));
  for (const s of series) {
    if (s.kind === "sector") {
      const owner = stocks.find((x) => x.sector === s.sector);
      styles.set(s.key, {
        token: owner ? (styles.get(owner.key)?.token ?? "--chart-axis") : "--chart-axis",
        dash: "dashed",
      });
    } else if (s.kind === "market") {
      styles.set(s.key, { token: "--chart-axis", dash: "dotted" });
    }
  }
  return styles;
}

export function seriesName(s: CompareSeries): string {
  if (s.kind === "stock") return s.symbol ?? s.key;
  if (s.kind === "sector") return `${sectorName(s.sector ?? "")} average`;
  return "All-stock average";
}

/** For the chart's accessible name: "1 Nov 2025 to 4 Nov 2026: GTCO +38.2%, ZENITHBANK +21.0%, …". */
export function compareSummary(c: CompareResponse): string {
  const parts = c.series.map((s) => `${seriesName(s)} ${percent(s.values.at(-1) ?? null)}`);
  return `% change from ${format(parseISO(c.from_date), "d MMM yyyy")} to ${format(parseISO(c.to_date), "d MMM yyyy")}: ${parts.join(", ")}`;
}

/** Plain words for a daily-return correlation (−1 to 1). */
export function correlationWords(v: number | null): string {
  if (v === null) return "Not enough shared trading days";
  if (v >= 0.7) return "Move closely together";
  if (v >= 0.4) return "Often move together";
  if (v >= 0.15) return "Move together a little";
  if (v > -0.15) return "Largely independent";
  return "Tend to move in opposite directions";
}

/** Percentage points between a stock's return and its sector average's. */
export function vsSector(c: CompareResponse, symbol: string): number | null {
  const stock = c.stocks.find((s) => s.symbol === symbol);
  const bench = c.benchmarks.find((b) => b.kind === "sector" && b.sector === stock?.sector);
  return stock?.return_pct != null && bench?.return_pct != null ? stock.return_pct - bench.return_pct : null;
}
