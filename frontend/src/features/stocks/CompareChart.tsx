/**
 * % performance from a common start (US-3.10) on Lightweight Charts, loaded lazily like the price
 * chart. One line per stock and average; the 0% line is the common start. The crosshair (or ←/→
 * when the chart is focused) picks a day, which the legend beside it reads out.
 */
import {
  ColorType,
  createChart,
  CrosshairMode,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import type { CompareResponse } from "@/api/types";
import { seriesName, type LineStyleSpec } from "@/lib/compare";
import { useCssVars } from "@/lib/hooks";

const TOKENS = [
  "--chart-bg",
  "--chart-grid",
  "--chart-axis",
  "--chart-crosshair",
  "--chart-series-1",
  "--chart-series-2",
  "--chart-series-3",
  "--chart-series-4",
  "--font-mono",
] as const;

const DASH = { solid: LineStyle.Solid, dashed: LineStyle.Dashed, dotted: LineStyle.Dotted } as const;
const PCT = {
  type: "custom" as const,
  minMove: 0.01,
  formatter: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`,
};

export default function CompareChart({
  data,
  styles,
  index,
  onIndex,
  label,
}: {
  data: CompareResponse;
  styles: Map<string, LineStyleSpec>;
  /** The day the legend reads (null: the last) */
  index: number | null;
  onIndex: (i: number | null) => void;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const firstSeries = useRef<ISeriesApi<"Line"> | null>(null);
  const colors = useCssVars(TOKENS);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: colors["--chart-bg"] },
        textColor: colors["--chart-axis"],
        fontFamily: colors["--font-mono"] || "monospace",
        fontSize: 12,
        attributionLogo: true,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: colors["--chart-grid"] } },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: colors["--chart-crosshair"], labelBackgroundColor: colors["--chart-crosshair"] },
        horzLine: { color: colors["--chart-crosshair"], labelBackgroundColor: colors["--chart-crosshair"] },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
    });
    chartRef.current = chart;
    firstSeries.current = null;
    data.series.forEach((s) => {
      const style = styles.get(s.key);
      const color = (style && colors[style.token as (typeof TOKENS)[number]]) || colors["--chart-axis"];
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        lineStyle: DASH[style?.dash ?? "solid"],
        priceFormat: PCT,
        priceLineVisible: false,
        title: s.kind === "stock" ? seriesName(s) : "",
        crosshairMarkerVisible: s.kind === "stock",
      });
      line.setData(
        data.dates.flatMap((d, i) => {
          const v = s.values[i];
          return typeof v === "number" ? [{ time: d as Time, value: v }] : [];
        }),
      );
      if (!firstSeries.current) {
        firstSeries.current = line;
        line.createPriceLine({
          price: 0,
          color: colors["--chart-crosshair"],
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: false,
        });
      }
    });
    chart.timeScale().fitContent();
    const position = new Map(data.dates.map((d, i) => [d, i]));
    chart.subscribeCrosshairMove((param) => {
      onIndex(param.time ? (position.get(String(param.time)) ?? null) : null);
    });
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data, styles, colors, onIndex]);

  // keyboard: ←/→ walk the days, Home/End jump, Escape back to the latest
  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = data.dates.length - 1;
    const at = index ?? last;
    const next =
      e.key === "ArrowLeft"
        ? Math.max(0, at - 1)
        : e.key === "ArrowRight"
          ? Math.min(last, at + 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : e.key === "Escape"
                ? null
                : undefined;
    if (next === undefined) return;
    e.preventDefault();
    onIndex(next);
    const chart = chartRef.current;
    const s = firstSeries.current;
    const day = next === null ? undefined : data.dates[next];
    const v = next === null ? undefined : data.series[0]?.values[next];
    if (chart && s && day && typeof v === "number") chart.setCrosshairPosition(v, day as Time, s);
    else chart?.clearCrosshairPosition();
  };

  return (
    <div className="relative h-80 w-full md:h-96">
      {/* the canvases (and the library's attribution link) */}
      <div ref={box} className="absolute inset-0" />
      {/* keyboard + screen-reader layer: a sibling, so nothing interactive is nested in it;
          pointer-events pass through to the chart */}
      <div
        role="img"
        tabIndex={0}
        aria-label={label}
        aria-roledescription="comparison chart"
        aria-describedby="compare-keys"
        onKeyDown={onKeyDown}
        onBlur={() => {
          chartRef.current?.clearCrosshairPosition();
          onIndex(null);
        }}
        className="pointer-events-none absolute inset-0 rounded-md"
      />
    </div>
  );
}
