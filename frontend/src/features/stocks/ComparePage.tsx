/**
 * Compare (US-3.10): up to 4 stocks over one period, rebased to 0% on the first day they all have a
 * price, with each one's sector average and the all-stock average as optional lines. Beside the
 * chart: a legend that reads the hovered day, the chart as a table, a side-by-side table of returns,
 * risk, trading, size, indicators and signals, how closely the stocks move together, and the AI
 * overview (US-4.7). Stocks, period and averages are in the URL.
 */
import { GitCompareArrows, Plus, Search, X } from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import { useDirectory, useMarketStatus } from "@/api/market";
import { useCompare } from "@/api/screener";
import { useStrategies } from "@/api/stock";
import type { CompareResponse, CompareStock, StrategyInfo } from "@/api/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { SegmentedControl } from "@/components/ui/controls";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PriceChange } from "@/components/ui/market";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import {
  BENCHMARK_OPTIONS,
  COMPARE_RANGES,
  compareStart,
  compareSummary,
  correlationWords,
  DEFAULT_COMPARE_RANGE,
  seriesName,
  seriesStyles,
  vsSector,
  type Benchmark,
  type CompareRange,
  type LineStyleSpec,
} from "@/lib/compare";
import { day } from "@/lib/dates";
import { money, percent, price, volume } from "@/lib/format";
import { useCssVars } from "@/lib/hooks";
import { MAX_COMPARE, parseSymbols, strategyShort } from "@/lib/screener";
import { POPULAR_FALLBACK, rankStocks } from "@/lib/search";
import { sectorName } from "@/lib/sectors";

import { CompareAiCard } from "./CompareAiCard";

const CompareChart = lazy(() => import("./CompareChart"));
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function useCompareParams(latest: string | null) {
  const [params, setParams] = useSearchParams();
  const symbols = parseSymbols(params.get("symbols"));
  const rawStart = params.get("start");
  const rawEnd = params.get("end");
  const custom = !!rawStart && !!rawEnd && DAY.test(rawStart) && DAY.test(rawEnd) && rawStart <= rawEnd;
  const rawRange = params.get("range") as CompareRange | null;
  const range = custom ? null : rawRange && COMPARE_RANGES.includes(rawRange) ? rawRange : DEFAULT_COMPARE_RANGE;
  const start = custom ? rawStart : latest && range ? compareStart(range, latest) : null;
  const end = custom ? rawEnd : latest;
  const benchRaw = params.get("bench");
  const benchmarks: Benchmark[] =
    benchRaw === "none"
      ? []
      : benchRaw
        ? BENCHMARK_OPTIONS.map((b) => b.value).filter((b) => benchRaw.split(",").includes(b))
        : ["sector"];
  const update = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === "") next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  );
  return { symbols, range, start, end, benchmarks, update };
}

function Swatch({ spec, colors }: { spec: LineStyleSpec | undefined; colors: Record<string, string> }) {
  const dash = spec?.dash === "dashed" ? "6 4" : spec?.dash === "dotted" ? "2 3" : undefined;
  return (
    <svg aria-hidden width={24} height={10} className="shrink-0">
      <line
        x1={1}
        x2={23}
        y1={5}
        y2={5}
        stroke={(spec && colors[spec.token]) || "currentColor"}
        strokeWidth={2.5}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

function AddStock({ symbols, onAdd }: { symbols: string[]; onAdd: (symbol: string) => void }) {
  const { data } = useDirectory();
  const [q, setQ] = useState("");
  const results = useMemo(
    () => rankStocks(data ?? [], q, 6).filter((e) => !symbols.includes(e.symbol)),
    [data, q, symbols],
  );
  const full = symbols.length >= MAX_COMPARE;
  const add = (symbol: string) => {
    onAdd(symbol);
    setQ("");
  };
  return (
    <div className="relative w-full sm:w-64">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
      />
      <input
        type="search"
        value={q}
        disabled={full}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            e.preventDefault();
            add(results[0].symbol);
          }
        }}
        placeholder={full ? `Up to ${MAX_COMPARE} stocks` : "Add a stock"}
        aria-label="Add a stock to compare"
        aria-controls={q ? "compare-add-results" : undefined}
        className="touch-target h-10 w-full rounded-md border border-line-input bg-surface pr-3 pl-9 text-sm text-fg placeholder:text-fg-muted disabled:opacity-60"
      />
      {q && (
        <ul
          id="compare-add-results"
          aria-label="Matching stocks"
          className="absolute inset-x-0 top-11 z-(--z-dropdown) overflow-hidden rounded-lg border border-line bg-raised shadow-md"
        >
          {results.length ? (
            results.map((e) => (
              <li key={e.symbol}>
                <button
                  type="button"
                  onClick={() => add(e.symbol)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-hover"
                >
                  <Plus aria-hidden className="size-4 text-fg-muted" />
                  <span className="num font-medium text-fg">{e.symbol}</span>
                  <span className="truncate text-xs text-fg-muted">{e.company}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-fg-2">No stocks match “{q}”</li>
          )}
        </ul>
      )}
    </div>
  );
}

function Legend({
  data,
  styles,
  colors,
  index,
}: {
  data: CompareResponse;
  styles: Map<string, LineStyleSpec>;
  colors: Record<string, string>;
  index: number | null;
}) {
  const at = index ?? data.dates.length - 1;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-fg-muted" aria-live="polite">
        {index === null ? `Latest, ${day(data.to_date)}` : day(data.dates[at] ?? data.to_date)}
      </p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {data.series.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <Swatch spec={styles.get(s.key)} colors={colors} />
            <span className={cn(s.kind === "stock" ? "num font-medium text-fg" : "text-fg-2")}>{seriesName(s)}</span>
            <PriceChange pct={s.values[at] ?? null} className="text-sm" />
            {s.kind !== "stock" && <span className="text-xs text-fg-muted">{s.members} stocks</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartTable({ data }: { data: CompareResponse }) {
  return (
    <div className="relative max-h-96 overflow-auto rounded-md border border-line-subtle">
      <table className="w-full text-sm">
        <caption className="sr-only">% change from {day(data.from_date)}, by trading day</caption>
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line-subtle text-xs text-fg-muted">
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Date
            </th>
            {data.series.map((s) => (
              <th key={s.key} scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">
                {seriesName(s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {[...data.dates].reverse().map((d, r) => {
            const i = data.dates.length - 1 - r;
            return (
              <tr key={d}>
                <th scope="row" className="num px-3 py-1.5 text-left font-normal whitespace-nowrap text-fg-2">
                  {day(d)}
                </th>
                {data.series.map((s) => (
                  <td key={s.key} className="num px-3 py-1.5 text-right text-fg">
                    {percent(s.values[i] ?? null)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Row = { label: ReactNode; hint?: string; cell: (s: CompareStock) => ReactNode };

/** A change, or a plain dash when there isn't one (no ■ for "no data"). */
const Pct = ({ pct }: { pct: number | null }) => (pct === null ? <>—</> : <PriceChange pct={pct} />);

function signalCell(s: CompareStock, slug: string) {
  const sig = s.signals.find((x) => x.strategy === slug);
  if (!sig) return <span className="text-fg-muted">None yet</span>;
  return (
    <span className={sig.side === "buy" ? "text-gain" : "text-loss"}>
      <span aria-hidden>{sig.side === "buy" ? "▲" : "▼"}</span> {sig.side === "buy" ? "Bullish" : "Bearish"}
      <span className="block text-xs text-fg-muted">{day(sig.date)}</span>
    </span>
  );
}

function MetricsTable({ data, strategies }: { data: CompareResponse; strategies: StrategyInfo[] | undefined }) {
  const sectorAvg = data.benchmarks.some((b) => b.kind === "sector");
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "Performance",
      rows: [
        { label: "Return", cell: (s) => <Pct pct={s.return_pct} /> },
        ...(sectorAvg
          ? [
              {
                label: "Against its sector average",
                hint: "Percentage points above or below the equal-weight average of its sector",
                cell: (s: CompareStock) => {
                  const v = vsSector(data, s.symbol);
                  return v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} pts`;
                },
              },
            ]
          : []),
        { label: "First close", cell: (s) => price(s.first_close) },
        { label: "Last close", cell: (s) => price(s.last_close) },
        { label: "Period high", cell: (s) => price(s.high) },
        { label: "Period low", cell: (s) => price(s.low) },
        {
          label: "Best day",
          cell: (s) =>
            s.best_day ? (
              <>
                <Pct pct={s.best_day.pct} />
                <span className="block text-xs text-fg-muted">{day(s.best_day.date)}</span>
              </>
            ) : (
              "—"
            ),
        },
        {
          label: "Worst day",
          cell: (s) =>
            s.worst_day ? (
              <>
                <Pct pct={s.worst_day.pct} />
                <span className="block text-xs text-fg-muted">{day(s.worst_day.date)}</span>
              </>
            ) : (
              "—"
            ),
        },
        { label: "Days up · down · unchanged", cell: (s) => `${s.up_days} · ${s.down_days} · ${s.flat_days}` },
      ],
    },
    {
      title: "Risk",
      rows: [
        {
          label: "Volatility",
          hint: "How much the price swings day to day, scaled to a year",
          cell: (s) => (s.volatility_pct === null ? "—" : `${s.volatility_pct.toFixed(1)}%`),
        },
        {
          label: "Deepest fall",
          hint: "The largest drop from a high within the period",
          cell: (s) => <Pct pct={s.max_drawdown_pct} />,
        },
      ],
    },
    {
      title: "Trading",
      rows: [
        { label: "Typical day's value traded", cell: (s) => money(s.avg_daily_value) },
        { label: "Value traded", cell: (s) => money(s.total_value) },
        { label: "Volume", cell: (s) => volume(s.total_volume) },
        { label: "Days with trades", cell: (s) => `${s.days_traded} of ${data.dates.length}` },
      ],
    },
    {
      title: "Size and range",
      rows: [
        { label: "Market cap", cell: (s) => money(s.market_cap) },
        { label: "52-week low", cell: (s) => price(s.low_52w) },
        { label: "52-week high", cell: (s) => price(s.high_52w) },
      ],
    },
    {
      title: "Indicators",
      rows: [
        { label: "RSI (14)", cell: (s) => (s.rsi14 === null ? "—" : s.rsi14.toFixed(1)) },
        { label: "Against its 50-day average", cell: (s) => <Pct pct={s.pct_vs_sma50} /> },
        { label: "Against its 200-day average", cell: (s) => <Pct pct={s.pct_vs_sma200} /> },
      ],
    },
    {
      title: "Latest signals",
      rows: (strategies ?? []).map((st) => ({
        label: strategyShort(st.slug, strategies),
        hint: st.description,
        cell: (s: CompareStock) => signalCell(s, st.slug),
      })),
    },
  ];
  return (
    <div className="relative -mx-4 overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <caption className="sr-only">The stocks side by side</caption>
        <thead>
          <tr className="border-b border-line-subtle">
            <th scope="col" className="sticky left-0 bg-surface px-4 py-2 text-left text-xs font-medium text-fg-muted">
              <span className="sr-only">Measure</span>
            </th>
            {data.stocks.map((s) => (
              <th key={s.symbol} scope="col" className="px-4 py-2 text-right">
                <Link to={`/app/stocks/${s.symbol}`} className="num font-semibold text-fg hover:text-brand">
                  {s.symbol}
                </Link>
                <span className="block text-xs font-normal text-fg-muted">
                  {s.subsector ?? (s.sector ? sectorName(s.sector) : "")}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.title} className="divide-y divide-line-subtle border-b border-line-subtle">
            <tr>
              <th
                scope="rowgroup"
                colSpan={data.stocks.length + 1}
                className="sticky left-0 bg-surface px-4 pt-4 pb-1 text-left"
              >
                <span className="eyebrow text-fg-muted">{g.title}</span>
              </th>
            </tr>
            {g.rows.map((r, i) => (
              <tr key={i}>
                <th scope="row" className="sticky left-0 bg-surface px-4 py-2 text-left font-normal text-fg-2">
                  {r.label}
                  {r.hint && <span className="block text-xs text-fg-muted">{r.hint}</span>}
                </th>
                {data.stocks.map((s) => (
                  <td key={s.symbol} className="num px-4 py-2 text-right whitespace-nowrap text-fg">
                    {r.cell(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function Correlations({ data }: { data: CompareResponse }) {
  if (!data.correlations.length) return null;
  return (
    <Card className="p-4">
      <h2 className="font-headline text-lg font-semibold text-fg">Do they move together?</h2>
      <p className="mt-1 text-sm text-fg-2">
        How closely their daily moves line up, from −1 (opposite) through 0 (unrelated) to 1 (in step), on the days both
        traded.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.correlations.map((c) => (
          <li key={`${c.a}-${c.b}`} className="flex items-center justify-between gap-3 rounded-md bg-sunken px-3 py-2">
            <span>
              <span className="num font-medium text-fg">
                {c.a} · {c.b}
              </span>
              <span className="block text-xs text-fg-2">{correlationWords(c.value)}</span>
            </span>
            <span className="num text-right text-fg">
              {c.value === null ? "—" : c.value.toFixed(2)}
              <span className="block text-xs text-fg-muted">{c.sessions} days</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const CHART_TOKENS = [
  "--chart-series-1",
  "--chart-series-2",
  "--chart-series-3",
  "--chart-series-4",
  "--chart-axis",
] as const;

export default function ComparePage() {
  const status = useMarketStatus();
  const latest = status.data?.latest_trade_date ?? null;
  const p = useCompareParams(latest);
  const compare = useCompare(p.symbols, p.start, p.end, p.benchmarks);
  const strategies = useStrategies();
  const colors = useCssVars(CHART_TOKENS);
  const [index, setIndex] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const data = compare.data;
  const styles = useMemo(() => seriesStyles(data?.series ?? []), [data]);

  const setSymbols = (next: string[]) => p.update({ symbols: next.slice(0, MAX_COMPARE).join(",") || null });
  const toggleBench = (b: Benchmark) => {
    const next = p.benchmarks.includes(b) ? p.benchmarks.filter((x) => x !== b) : [...p.benchmarks, b];
    track("compare.benchmark", { benchmark: b, on: !p.benchmarks.includes(b) });
    p.update({ bench: next.length ? next.join(",") : "none" });
  };

  return (
    <>
      <PageHeader
        title="Compare"
        description={`Up to ${MAX_COMPARE} stocks, from the same starting point. Past moves don't predict future ones.`}
        actions={
          <Link to="/app/stocks" className="text-sm font-medium text-brand underline-offset-2 hover:underline">
            All stocks
          </Link>
        }
      />
      <Card className="mb-4 flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2" aria-label="Stocks compared">
          {p.symbols.map((s, i) => (
            <span
              key={s}
              className="num inline-flex items-center gap-2 rounded-full border border-line bg-sunken py-1 pr-1 pl-3 text-sm text-fg"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: colors[`--chart-series-${i + 1}` as (typeof CHART_TOKENS)[number]] }}
              />
              <Link to={`/app/stocks/${s}`} className="font-medium hover:text-brand">
                {s}
              </Link>
              <button
                type="button"
                onClick={() => setSymbols(p.symbols.filter((x) => x !== s))}
                aria-label={`Remove ${s}`}
                className="touch-target flex size-6 items-center justify-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          ))}
          <AddStock
            symbols={p.symbols}
            onAdd={(s) => {
              track("compare.add", { symbol: s, from: "compare" });
              setSymbols([...p.symbols, s]);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl<CompareRange>
            label="Period"
            track="compare.range"
            value={p.range}
            onChange={(range) =>
              p.update({ range: range === DEFAULT_COMPARE_RANGE ? null : range, start: null, end: null })
            }
            options={COMPARE_RANGES.map((r) => ({ value: r, label: r }))}
          />
          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="sr-only">Averages to show</legend>
            {BENCHMARK_OPTIONS.map((b) => (
              <label key={b.value} className="flex items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={p.benchmarks.includes(b.value)}
                  onChange={() => toggleBench(b.value)}
                  className="size-4 accent-(--color-brand)"
                />
                {b.label}
              </label>
            ))}
          </fieldset>
        </div>
        {!p.range && p.start && p.end && (
          <p className="text-xs text-fg-muted">
            {day(p.start)} to {day(p.end)}, from the Stocks page.{" "}
            <button
              type="button"
              onClick={() => p.update({ start: null, end: null })}
              className="font-medium text-brand hover:underline"
            >
              Use 1 year
            </button>
          </p>
        )}
      </Card>

      {!p.symbols.length ? (
        <Card>
          <EmptyState
            icon={GitCompareArrows}
            title="Pick stocks to compare"
            action={
              <Link to="/app/stocks" className="text-sm font-medium text-brand underline-offset-2 hover:underline">
                Choose from all stocks
              </Link>
            }
          >
            <p>Add up to {MAX_COMPARE} stocks above, or tick “Compare” on the Stocks page.</p>
            <p className="mt-3 flex flex-wrap justify-center gap-2">
              <span className="text-fg-muted">Try:</span>
              <button
                type="button"
                onClick={() => setSymbols(["GTCO", "ZENITHBANK"])}
                className="num font-medium text-brand hover:underline"
              >
                GTCO and ZENITHBANK
              </button>
              <button
                type="button"
                onClick={() => setSymbols(POPULAR_FALLBACK.slice(0, 3))}
                className="num font-medium text-brand hover:underline"
              >
                {POPULAR_FALLBACK.slice(0, 3).join(", ")}
              </button>
            </p>
          </EmptyState>
        </Card>
      ) : compare.error && !data ? (
        <Card>
          <ErrorState error={compare.error} onRetry={() => void compare.refetch()} title="The comparison didn't load" />
        </Card>
      ) : !data ? (
        <div aria-busy className="flex flex-col gap-4">
          <span className="sr-only">Loading the comparison</span>
          <Skeleton className="h-[28rem]" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-headline text-lg font-semibold text-fg">% change from {day(data.from_date)}</h2>
                <p id="compare-keys" className="text-xs text-fg-muted">
                  {data.dates.length} trading days. Focus the chart and use ← → to read each day.
                </p>
              </div>
              <button
                type="button"
                aria-pressed={asTable}
                onClick={() => setAsTable((v) => !v)}
                className="text-sm font-medium text-brand underline-offset-2 hover:underline"
              >
                {asTable ? "View as chart" : "View as table"}
              </button>
            </div>
            <Legend data={data} styles={styles} colors={colors} index={index} />
            {asTable ? (
              <ChartTable data={data} />
            ) : (
              <Suspense fallback={<Skeleton className="h-80 md:h-96" />}>
                <CompareChart
                  data={data}
                  styles={styles}
                  index={index}
                  onIndex={setIndex}
                  label={compareSummary(data)}
                />
              </Suspense>
            )}
            {data.from_date > (p.start ?? data.from_date) && (
              <p className="text-xs text-fg-muted">
                Starts on {day(data.from_date)}, the first day every stock had a price in this period.
              </p>
            )}
            <p className="text-xs text-fg-muted">
              Averages weight every stock equally and count daily price moves only (no dividends). NGX's All-Share Index
              isn't in our data yet.
            </p>
          </Card>
          <CompareAiCard symbols={data.stocks.map((s) => s.symbol)} start={p.start} end={p.end} latest={latest} />
          <Card className="p-4">
            <h2 className="mb-2 font-headline text-lg font-semibold text-fg">Side by side</h2>
            <MetricsTable data={data} strategies={strategies.data} />
          </Card>
          <Correlations data={data} />
        </div>
      )}
    </>
  );
}
