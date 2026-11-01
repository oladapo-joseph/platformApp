/**
 * Price chart (docs/06 §6 PriceChart, US-3.3–3.5, US-3.11) on TradingView Lightweight Charts
 * (Apache-2.0; its attribution logo stays on). Loaded lazily as its own chunk.
 *
 * Panes: price (+ overlays, signal markers) · volume · RSI · MACD. Colours come from the chart
 * tokens and follow the theme; overlays differ by colour *and* dash style. The chart is a
 * focusable figure: ←/→ walk the crosshair day by day and the day's prices are announced.
 */
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Bar, IndicatorsResponse, NewsDay, SignalEvent } from "@/api/types";
import { day } from "@/lib/dates";
import { change, percent, price, volume } from "@/lib/format";
import { useCssVars } from "@/lib/hooks";
import { barSentence, INDICATORS, type Overlay, type Pane } from "@/lib/stock";

import { NewsStrip, type Headline, type NewsPick, type NewsSpot } from "./NewsStrip";

const TOKENS = [
  "--chart-bg",
  "--chart-grid",
  "--chart-axis",
  "--chart-crosshair",
  "--chart-up",
  "--chart-down",
  "--chart-line",
  "--chart-volume-up",
  "--chart-volume-down",
  "--chart-sma-50",
  "--chart-sma-200",
  "--chart-ema-12",
  "--chart-ema-26",
  "--chart-bollinger",
  "--chart-signal-buy",
  "--chart-signal-sell",
  "--font-mono",
] as const;

type Colors = Record<(typeof TOKENS)[number], string>;

/** Overlay colour + dash: SMA solid, EMA dashed, Bollinger dotted (docs/06 §2.3). */
/** Prices: 2 decimals; volume keeps the library's compact format (4M, 250K). */
const PRICE = { type: "price" as const, precision: 2, minMove: 0.01 };

const OVERLAY_STYLE: Record<Overlay, { token: keyof Colors; style: LineStyle }> = {
  sma50: { token: "--chart-sma-50", style: LineStyle.Solid },
  sma200: { token: "--chart-sma-200", style: LineStyle.Solid },
  ema12: { token: "--chart-ema-12", style: LineStyle.Dashed },
  ema26: { token: "--chart-ema-26", style: LineStyle.Dashed },
  bb20: { token: "--chart-bollinger", style: LineStyle.Dotted },
};

function series(ind: IndicatorsResponse | undefined, key: string, column: string) {
  const s = ind?.indicators.find((i) => i.key === key);
  const values = s?.values[column] ?? [];
  return (ind?.dates ?? [])
    .map((d, i) => ({ time: d as Time, value: values[i] }))
    .filter((p): p is { time: Time; value: number } => typeof p.value === "number");
}

export interface PriceChartProps {
  bars: Bar[];
  indicators: IndicatorsResponse | undefined;
  type: "candle" | "line";
  overlays: Overlay[];
  panes: Pane[];
  signals: SignalEvent[];
  selectedSignal: string | null;
  onSelectSignal: (date: string) => void;
  summary: string;
  height: number;
  /** Days with news (US-9.2); undefined hides the markers */
  news?: NewsDay[];
  newsPick?: NewsPick;
}

const MIN_GAP = 28; // px between news markers; closer days share one (24 px targets, WCAG 2.5.8)
const MAX_HEADLINES = 5;

/** News days moved onto the trading day they belong to (weekend news → the next session). */
function newsByBar(news: NewsDay[] | undefined, bars: Bar[]) {
  const out = new Map<string, { count: number; headlines: Headline[] }>();
  const last = bars.at(-1)?.date;
  if (!news?.length || !last) return out;
  for (const d of news) {
    const target = bars.find((b) => b.date >= d.date)?.date ?? (d.date > last ? last : undefined);
    if (!target) continue;
    const slot = out.get(target) ?? { count: 0, headlines: [] };
    slot.count += d.count;
    slot.headlines.push(...d.headlines);
    out.set(target, slot);
  }
  return out;
}

export default function PriceChart(props: PriceChartProps) {
  const { bars, indicators, type, overlays, panes, signals, selectedSignal, onSelectSignal, summary, height } = props;
  const { news, newsPick } = props;
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<"Candlestick" | "Line"> | null>(null);
  const colors = useCssVars(TOKENS) as Colors;
  const [hover, setHover] = useState<number | null>(null); // index into bars
  const [announce, setAnnounce] = useState("");
  const [spots, setSpots] = useState<NewsSpot[]>([]);
  const newsDays = useMemo(() => newsByBar(news, bars), [news, bars]);
  const index = useMemo(() => new Map(bars.map((b, i) => [b.date, i])), [bars]);
  const selectRef = useRef(onSelectSignal);
  useEffect(() => {
    selectRef.current = onSelectSignal;
  }, [onSelectSignal]);

  // build the chart; rebuilt when its structure or theme changes (cheap at a few hundred bars)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const font = colors["--font-mono"] || "monospace";
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: colors["--chart-bg"] },
        textColor: colors["--chart-axis"],
        fontFamily: font,
        fontSize: 12,
        attributionLogo: true,
        panes: { separatorColor: colors["--chart-grid"], separatorHoverColor: colors["--chart-crosshair"] },
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

    const priced = bars.filter((b) => b.close !== null);
    const main =
      type === "candle"
        ? chart.addSeries(CandlestickSeries, {
            upColor: colors["--chart-up"],
            downColor: colors["--chart-down"],
            wickUpColor: colors["--chart-up"],
            wickDownColor: colors["--chart-down"],
            borderVisible: false,
            priceLineVisible: false,
            priceFormat: PRICE,
          })
        : chart.addSeries(LineSeries, {
            color: colors["--chart-line"],
            lineWidth: 2,
            priceLineVisible: false,
            priceFormat: PRICE,
          });
    if (type === "candle") {
      (main as ISeriesApi<"Candlestick">).setData(
        priced.map((b) => ({
          time: b.date as Time,
          open: b.open ?? b.close ?? 0,
          high: b.high ?? b.close ?? 0,
          low: b.low ?? b.close ?? 0,
          close: b.close ?? 0,
        })),
      );
    } else {
      (main as ISeriesApi<"Line">).setData(priced.map((b) => ({ time: b.date as Time, value: b.close ?? 0 })));
    }
    mainRef.current = main;

    for (const o of overlays) {
      const { token, style } = OVERLAY_STYLE[o];
      const opts = {
        color: colors[token],
        lineStyle: style,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      };
      if (o === "bb20") {
        for (const col of ["upper", "middle", "lower"]) {
          chart.addSeries(LineSeries, { ...opts, lineWidth: 1 }).setData(series(indicators, "bb20", col));
        }
      } else {
        chart.addSeries(LineSeries, { ...opts, lineWidth: 2 }).setData(series(indicators, o, "value"));
      }
    }

    let pane = 1;
    if (panes.includes("volume")) {
      chart
        .addSeries(
          HistogramSeries,
          { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false },
          pane,
        )
        .setData(
          bars.map((b) => ({
            time: b.date as Time,
            value: b.volume ?? 0,
            color: (b.change ?? 0) >= 0 ? colors["--chart-volume-up"] : colors["--chart-volume-down"],
          })),
        );
      pane += 1;
    }
    if (panes.includes("rsi14")) {
      const rsi = chart.addSeries(
        LineSeries,
        { color: colors["--chart-ema-12"], lineWidth: 2, priceLineVisible: false },
        pane,
      );
      rsi.setData(series(indicators, "rsi14", "value"));
      for (const level of [70, 30]) {
        rsi.createPriceLine({
          price: level,
          color: colors["--chart-crosshair"],
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: "",
        });
      }
      pane += 1;
    }
    if (panes.includes("macd")) {
      const hist = series(indicators, "macd", "histogram");
      chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane).setData(
        hist.map((p) => ({
          ...p,
          color: p.value >= 0 ? colors["--chart-volume-up"] : colors["--chart-volume-down"],
        })),
      );
      chart
        .addSeries(LineSeries, { color: colors["--chart-ema-26"], lineWidth: 2, priceLineVisible: false }, pane)
        .setData(series(indicators, "macd", "macd"));
      chart
        .addSeries(
          LineSeries,
          { color: colors["--chart-sma-50"], lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false },
          pane,
        )
        .setData(series(indicators, "macd", "signal"));
    }
    // price pane gets most of the height; each lower pane a fixed share
    chart.panes().forEach((p, i) => p.setStretchFactor(i === 0 ? 3 : 1));
    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      const i = param.time ? index.get(String(param.time)) : undefined;
      setHover(i ?? null);
    });
    chart.subscribeClick((param) => {
      if (param.time) selectRef.current(String(param.time));
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      mainRef.current = null;
    };
  }, [bars, indicators, type, overlays, panes, colors, index]);

  // signal markers: ▲ below the bar for buy, ▼ above for sell; the selected one is larger
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const markers: SeriesMarker<Time>[] = signals
      .filter((s) => index.has(s.date))
      .map((s) => ({
        time: s.date as Time,
        position: s.side === "buy" ? "belowBar" : "aboveBar",
        shape: s.side === "buy" ? "arrowUp" : "arrowDown",
        color: s.side === "buy" ? colors["--chart-signal-buy"] : colors["--chart-signal-sell"],
        size: s.date === selectedSignal ? 2 : 1,
        id: s.date,
      }));
    const chart = chartRef.current;
    const plugin = createSeriesMarkers(main, markers);
    return () => {
      // when the chart itself is being rebuilt it's already removed, markers included
      if (chartRef.current === chart) plugin.detach();
    };
  }, [signals, selectedSignal, colors, index, bars, type, overlays, panes, indicators]);

  // news markers follow the chart as it pans, zooms and resizes (US-9.2)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const scale = chart.timeScale();
    const place = () => {
      const width = scale.width();
      const placed: NewsSpot[] = [];
      for (const [date, { count, headlines }] of [...newsDays].sort(([a], [b]) => a.localeCompare(b))) {
        const x = scale.timeToCoordinate(date as Time);
        if (x === null || x < 0 || x > width) continue;
        const prev = placed.at(-1);
        if (prev && x - prev.x < MIN_GAP) {
          prev.dates.push(date);
          prev.count += count;
          prev.headlines = [...prev.headlines, ...headlines].slice(0, MAX_HEADLINES);
        } else {
          placed.push({ key: date, x, dates: [date], count, headlines: headlines.slice(0, MAX_HEADLINES) });
        }
      }
      setSpots(placed);
    };
    place();
    scale.subscribeVisibleLogicalRangeChange(place);
    scale.subscribeSizeChange(place);
    return () => {
      if (chartRef.current !== chart) return; // rebuilt: the old chart is gone with its listeners
      scale.unsubscribeVisibleLogicalRangeChange(place);
      scale.unsubscribeSizeChange(place);
    };
  }, [newsDays, bars, type, overlays, panes, indicators, colors, index]);

  // a selected signal row moves the crosshair to its day (US-3.5)
  useEffect(() => {
    const i = selectedSignal ? index.get(selectedSignal) : undefined;
    const b = i !== undefined ? bars[i] : undefined;
    if (b?.close != null && chartRef.current && mainRef.current) {
      chartRef.current.setCrosshairPosition(b.close, b.date as Time, mainRef.current);
      setHover(i ?? null);
    }
  }, [selectedSignal, index, bars]);

  const moveBy = (step: number) => {
    const from = hover ?? bars.length - 1;
    const i = Math.min(Math.max(from + step, 0), bars.length - 1);
    const b = bars[i];
    if (!b || b.close == null || !chartRef.current || !mainRef.current) return;
    chartRef.current.setCrosshairPosition(b.close, b.date as Time, mainRef.current);
    setHover(i);
    setAnnounce(barSentence(b));
  };

  const shown = bars[hover ?? bars.length - 1];
  return (
    <figure className="m-0">
      <Readout bar={shown} />
      <div className="relative w-full" style={{ height }}>
        {/* the canvases (and the library's attribution link) */}
        <div ref={box} className="absolute inset-0" />
        {/* keyboard + screen-reader layer: a sibling, so nothing interactive is nested in it;
            pointer-events pass through to the chart */}
        <div
          role="img"
          tabIndex={0}
          aria-label={`${summary}. Use the left and right arrow keys to read each day.`}
          aria-roledescription="price chart"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              moveBy(e.key === "ArrowLeft" ? -1 : 1);
            } else if (e.key === "Home" || e.key === "End") {
              e.preventDefault();
              moveBy(e.key === "Home" ? -bars.length : bars.length);
            }
          }}
          onBlur={() => chartRef.current?.clearCrosshairPosition()}
          className="pointer-events-none absolute inset-0 rounded-md"
        />
      </div>
      {news && newsPick && <NewsStrip spots={spots} pick={newsPick} />}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      {overlays.length > 0 && (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-2">
          {overlays.map((o) => (
            <span key={o} className="inline-flex items-center gap-1.5">
              <svg aria-hidden width="18" height="4">
                <line
                  x1="0"
                  y1="2"
                  x2="18"
                  y2="2"
                  stroke={`var(${OVERLAY_STYLE[o].token})`}
                  strokeWidth="2"
                  strokeDasharray={
                    OVERLAY_STYLE[o].style === LineStyle.Dashed
                      ? "5 3"
                      : OVERLAY_STYLE[o].style === LineStyle.Dotted
                        ? "1.5 2.5"
                        : undefined
                  }
                />
              </svg>
              {INDICATORS[o].label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

/** The crosshair's day: date, O/H/L/C, change and volume (US-3.3). Text tokens, never series colours. */
function Readout({ bar }: { bar: Bar | undefined }) {
  if (!bar) return <div className="h-5" />;
  const cell = (label: string, value: string) => (
    <span className="whitespace-nowrap">
      <span className="text-fg-muted">{label} </span>
      <span className="num text-fg">{value}</span>
    </span>
  );
  return (
    <div className="mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" aria-hidden>
      <span className="font-medium text-fg">{day(bar.date)}</span>
      {cell("O", price(bar.open))}
      {cell("H", price(bar.high))}
      {cell("L", price(bar.low))}
      {cell("C", price(bar.close))}
      {cell("Chg", `${change(bar.change)} (${percent(bar.pct_change)})`)}
      {cell("Vol", volume(bar.volume))}
    </div>
  );
}
