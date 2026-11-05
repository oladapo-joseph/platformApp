/**
 * The digest (US-2.10): one card per stock, your watchlist first, then the rest in the chosen order
 * (most traded by default), as finance apps lay out a watchlist above "most active". Each card has
 * price and change, a sparkline, value traded, size, the 52-week position and the latest signal;
 * ☆ and "Compare" sit beside the link to the stock.
 */
import { GitCompareArrows } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import type { ScreenRow, StrategyInfo } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { PriceChange } from "@/components/ui/market";
import { Sparkline } from "@/components/ui/Sparkline";
import { WatchStar } from "@/components/ui/WatchStar";
import { cn } from "@/lib/cn";
import { money, price } from "@/lib/format";
import { digestGroups, MAX_COMPARE, range52, signalAge, signalOf, strategyShort } from "@/lib/screener";
import { sectorName } from "@/lib/sectors";

const PAGE = 24;

export function RangeBar({ row }: { row: ScreenRow }) {
  const at = range52(row);
  if (at === null) return <span className="text-xs text-fg-muted">52-week range not available</span>;
  return (
    <span className="flex items-center gap-2 text-xs text-fg-muted">
      <span className="num">{price(row.low_52w)}</span>
      <span
        role="img"
        aria-label={`${Math.round(at * 100)}% of the way from the 52-week low to the high`}
        className="relative h-1.5 flex-1 rounded-full bg-sunken"
      >
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-fg-2"
          style={{ left: `${at * 100}%` }}
        />
      </span>
      <span className="num">{price(row.high_52w)}</span>
    </span>
  );
}

export function SignalLine({
  row,
  strategy,
  strategies,
  latest,
}: {
  row: ScreenRow;
  strategy: string;
  strategies: StrategyInfo[] | undefined;
  latest: string;
}) {
  const s = signalOf(row, strategy);
  const name = strategyShort(strategy, strategies);
  if (!s) return <span className="text-xs text-fg-muted">No {name} signal yet</span>;
  const age = signalAge(s, latest);
  const when = age <= 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`;
  return (
    <span className={cn("text-xs", s.side === "buy" ? "text-gain" : "text-loss")}>
      <span aria-hidden>{s.side === "buy" ? "▲" : "▼"}</span> {s.side === "buy" ? "Bullish" : "Bearish"} {name}
      <span className="text-fg-muted"> · {when}</span>
    </span>
  );
}

export function CompareToggle({
  symbol,
  picked,
  onToggle,
}: {
  symbol: string;
  picked: string[];
  onToggle: (symbol: string) => void;
}) {
  const on = picked.includes(symbol);
  const full = !on && picked.length >= MAX_COMPARE;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={full}
      title={full ? `Compare holds up to ${MAX_COMPARE} stocks` : undefined}
      onClick={() => onToggle(symbol)}
      className={cn(
        "touch-target inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors duration-(--duration-instant)",
        on ? "border-brand bg-brand-subtle text-brand" : "border-line text-fg-2 hover:bg-hover hover:text-fg",
        full && "cursor-not-allowed opacity-50",
      )}
    >
      <GitCompareArrows aria-hidden className="size-3.5" />
      <span>{on ? "Comparing" : "Compare"}</span>
      <span className="sr-only"> {symbol}</span>
    </button>
  );
}

function StockCard({
  row,
  strategy,
  strategies,
  latest,
  period,
  picked,
  onCompare,
}: {
  row: ScreenRow;
  strategy: string;
  strategies: StrategyInfo[] | undefined;
  latest: string;
  period: boolean;
  picked: string[];
  onCompare: (symbol: string) => void;
}) {
  const up = (row.spark.at(-1) ?? 0) >= (row.spark[0] ?? 0);
  return (
    <li className="relative flex min-w-0 flex-col rounded-lg bg-surface shadow-elev-1 transition-shadow duration-(--duration-instant) hover:shadow-elev-2">
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <CompareToggle symbol={row.symbol} picked={picked} onToggle={onCompare} />
        <WatchStar symbol={row.symbol} />
      </div>
      <Link to={`/app/stocks/${row.symbol}`} className="flex flex-1 flex-col gap-3 rounded-lg p-4">
        <span className="min-w-0 pr-36">
          <span className="num block font-semibold text-fg">{row.symbol}</span>
          <span className="block truncate text-xs text-fg-muted" title={row.company ?? undefined}>
            {row.company}
            {row.sector && ` · ${sectorName(row.sector)}`}
          </span>
        </span>
        <span className="flex items-end justify-between gap-3">
          <span className="flex flex-col gap-1">
            <span className="num text-xl font-semibold text-fg">{price(row.close)}</span>
            <PriceChange pct={row.pct_change} variant="pill" className="self-start text-xs" />
          </span>
          <Sparkline values={row.spark} width={104} height={40} className={up ? "text-gain" : "text-loss"} />
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-2">
          <span>
            {period ? "Traded" : "Traded today"} <span className="num text-fg">{money(row.value)}</span>
          </span>
          <span>
            Cap <span className="num text-fg">{money(row.market_cap)}</span>
          </span>
        </span>
        <RangeBar row={row} />
        <SignalLine row={row} strategy={strategy} strategies={strategies} latest={latest} />
      </Link>
    </li>
  );
}

export function StockCards({
  rows,
  watch,
  groupWatchlist,
  restLabel,
  ...card
}: {
  rows: ScreenRow[];
  watch: Set<string>;
  groupWatchlist: boolean;
  restLabel: string;
  strategy: string;
  strategies: StrategyInfo[] | undefined;
  latest: string;
  period: boolean;
  picked: string[];
  onCompare: (symbol: string) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  const { mine, rest } = groupWatchlist ? digestGroups(rows, watch) : { mine: [], rest: rows };
  const shownRest = rest.slice(0, Math.max(0, limit - mine.length));
  const grid = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  return (
    <div className="flex flex-col gap-6">
      {mine.length > 0 && (
        <section aria-labelledby="digest-mine">
          <h2 id="digest-mine" className="mb-2 font-headline text-lg font-semibold text-fg">
            Your watchlist <span className="num text-sm font-normal text-fg-muted">{mine.length}</span>
          </h2>
          <ul className={grid}>
            {mine.map((r) => (
              <StockCard key={r.symbol} row={r} {...card} />
            ))}
          </ul>
        </section>
      )}
      {rest.length > 0 && (
        <section aria-labelledby="digest-rest">
          <h2 id="digest-rest" className="mb-2 font-headline text-lg font-semibold text-fg">
            {mine.length ? `Everything else · ${restLabel}` : restLabel.charAt(0).toUpperCase() + restLabel.slice(1)}
          </h2>
          <ul className={grid}>
            {shownRest.map((r) => (
              <StockCard key={r.symbol} row={r} {...card} />
            ))}
          </ul>
          {shownRest.length < rest.length && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
                Show more ({rest.length - shownRest.length} left)
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
