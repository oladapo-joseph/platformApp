/**
 * Watchlist (US-5.2, US-5.4, US-9.4): my stocks with price, day and period change, trend and the
 * latest signal; and the news that mentions them. Tab, period, sort and strategy live in the URL.
 */
import { Newspaper, Search, Star } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";

import { useStrategies } from "@/api/stock";
import type { SignalEvent, WatchlistPeriod, WatchlistRow } from "@/api/types";
import { useWatchlist, useWatchlistNews, useWatchlistOverview } from "@/api/watchlist";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { SegmentedControl, Tabs } from "@/components/ui/controls";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PriceChange } from "@/components/ui/market";
import { NewsItem } from "@/components/ui/NewsItem";
import { Sparkline } from "@/components/ui/Sparkline";
import { WatchStar } from "@/components/ui/WatchStar";
import { cn } from "@/lib/cn";
import { day, isoDay, weekday } from "@/lib/dates";
import { price } from "@/lib/format";
import { openSearch, POPULAR_FALLBACK } from "@/lib/search";

const PERIODS: { value: WatchlistPeriod; label: string }[] = [
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "YTD", label: "YTD" },
];

const SORTS = [
  { value: "added", label: "Order added" },
  { value: "day", label: "Day change" },
  { value: "period", label: "Period change" },
  { value: "symbol", label: "Ticker A–Z" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

function sorted(rows: WatchlistRow[], sort: Sort): WatchlistRow[] {
  if (sort === "added") return rows;
  if (sort === "symbol") return [...rows].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const key = sort === "day" ? "pct_change" : "period_pct_change";
  // largest rise first; stocks without a figure last
  return [...rows].sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity));
}

function useView() {
  const [params, setParams] = useSearchParams();
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const v = params.get(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  };
  const set = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  return {
    tab: pick("tab", ["stocks", "news"] as const, "stocks"),
    period: pick(
      "period",
      PERIODS.map((p) => p.value),
      "1M",
    ),
    sort: pick(
      "sort",
      SORTS.map((s) => s.value),
      "added",
    ),
    strategy: params.get("strategy") ?? undefined,
    set,
  };
}

function SignalNote({ signal }: { signal: SignalEvent | null | undefined }) {
  if (!signal) return <span className="text-xs text-fg-muted">No signal yet</span>;
  const up = signal.side === "buy";
  return (
    <span className="text-xs whitespace-nowrap">
      <span className={cn("font-medium", up ? "text-gain" : "text-loss")}>
        <span aria-hidden>{up ? "▲ " : "▼ "}</span>
        {up ? "Bullish" : "Bearish"} signal
      </span>
      <span className="text-fg-muted"> · {day(signal.date)}</span>
    </span>
  );
}

function Row({ r, period, asOf }: { r: WatchlistRow; period: WatchlistPeriod; asOf: string | null | undefined }) {
  const stale = r.trade_date && asOf && r.trade_date !== asOf;
  const trend = (r.period_pct_change ?? 0) >= 0 ? "text-gain" : "text-loss";
  return (
    <li className="flex items-center gap-2 py-3 sm:gap-4">
      <WatchStar symbol={r.symbol} undoable />
      <Link to={`/app/stocks/${r.symbol}`} className="min-w-0 flex-1 hover:text-brand">
        <span className="num block font-medium text-fg">{r.symbol}</span>
        <span className="block truncate text-xs text-fg-muted" title={r.company ?? undefined}>
          {r.company ?? r.symbol}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 sm:hidden">
          <span className="text-xs text-fg-2">
            {period} <PriceChange pct={r.period_pct_change} />
          </span>
          <SignalNote signal={r.signal} />
        </span>
      </Link>
      <Sparkline values={r.spark} width={96} height={32} className={cn("max-sm:hidden", trend)} />
      <span className="flex w-24 flex-col items-end gap-1 sm:w-28">
        <span className="num text-sm text-fg">{price(r.close)}</span>
        <PriceChange pct={r.pct_change} variant="solid" className="text-xs" />
        {stale && <span className="text-xs text-fg-muted">Last traded {weekday(r.trade_date)}</span>}
      </span>
      <span className="w-24 text-right max-sm:hidden">
        <span className="block text-xs text-fg-muted">{period}</span>
        <PriceChange pct={r.period_pct_change} className="text-sm" />
      </span>
      <span className="w-36 text-right max-md:hidden">
        <SignalNote signal={r.signal} />
      </span>
    </li>
  );
}

function Stocks({ symbols }: { symbols: string[] }) {
  const v = useView();
  const strategies = useStrategies();
  const overview = useWatchlistOverview(v.period, v.strategy);
  // a star just removed hides its row at once (the overview refetches behind it)
  const rows = useMemo(() => {
    const keep = new Set(symbols);
    return sorted(overview.data?.stocks.filter((r) => keep.has(r.symbol)) ?? [], v.sort);
  }, [overview.data, symbols, v.sort]);

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Period"
          track="watchlist.period"
          value={v.period}
          onChange={(period) => v.set({ period })}
          options={PERIODS}
        />
        <label className="flex items-center gap-2 text-sm text-fg-2">
          Sort
          <select
            value={v.sort}
            onChange={(e) => v.set({ sort: e.target.value === "added" ? null : e.target.value })}
            className="touch-target h-9 rounded-md border border-line-input bg-surface px-2 text-sm text-fg"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {strategies.data && (
          <label className="flex items-center gap-2 text-sm text-fg-2 md:ml-auto">
            Signals
            <select
              value={overview.data?.strategy.slug ?? v.strategy ?? ""}
              onChange={(e) => v.set({ strategy: e.target.value })}
              className="touch-target h-9 rounded-md border border-line-input bg-surface px-2 text-sm text-fg"
            >
              {strategies.data.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {overview.isPending ? (
        <div aria-busy className="mt-2 flex flex-col divide-y divide-line-subtle">
          <span className="sr-only">Loading your stocks</span>
          {symbols.slice(0, 6).map((s) => (
            <div key={s} className="flex items-center gap-4 py-3">
              <Skeleton className="size-9" />
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
        </div>
      ) : overview.error && !overview.data ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} title="Your stocks didn't load" />
      ) : (
        <ul
          aria-label="Your stocks"
          aria-busy={overview.isPlaceholderData || undefined}
          className={cn("mt-2 divide-y divide-line-subtle", overview.isPlaceholderData && "opacity-60")}
        >
          {rows.map((r) => (
            <Row key={r.symbol} r={r} period={v.period} asOf={overview.data?.as_of} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function News({ symbols }: { symbols: string[] }) {
  const news = useWatchlistNews();
  const mine = new Set(symbols);
  if (news.isPending) {
    return (
      <Card aria-busy className="flex flex-col gap-5 p-5">
        <span className="sr-only">Loading news</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </Card>
    );
  }
  if (news.error) {
    return (
      <Card>
        <ErrorState error={news.error} onRetry={() => void news.refetch()} title="News didn't load" />
      </Card>
    );
  }
  if (!news.data.articles.length) {
    return (
      <Card>
        <EmptyState
          icon={Newspaper}
          title="No news for your stocks this week"
          action={
            <Link
              to="/app/news?sort=importance"
              className="text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              Read the top stories instead
            </Link>
          }
        />
      </Card>
    );
  }
  return (
    <Card className="px-4">
      <ul className="divide-y divide-line-subtle">
        {news.data.articles.map((a) => (
          <li key={a.id} className="pt-3">
            <p className="num text-xs font-medium text-brand">
              <span className="sr-only">About </span>
              {a.symbols.filter((s) => mine.has(s)).join(" · ")}
            </p>
            <NewsItem article={a} showDate />
          </li>
        ))}
      </ul>
      <p className="py-3 text-xs text-fg-muted">
        The last 7 days. News is collected automatically and may be incomplete.
      </p>
    </Card>
  );
}

/** US-5.4: what to do with an empty watchlist. */
function Empty() {
  return (
    <Card>
      <EmptyState
        icon={Star}
        title="Star stocks to follow them here"
        action={
          <Button variant="secondary" onClick={openSearch} icon={<Search aria-hidden className="size-4" />}>
            Search stocks
          </Button>
        }
      >
        Tap ☆ on any stock, or start with a popular one:
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {POPULAR_FALLBACK.map((s) => (
            <li key={s}>
              <WatchStar symbol={s} label={s} />
            </li>
          ))}
        </ul>
      </EmptyState>
    </Card>
  );
}

function Summary({ symbols }: { symbols: string[] }) {
  const v = useView();
  const { data } = useWatchlistOverview(v.period, v.strategy);
  if (!data || !symbols.length) return null;
  const keep = new Set(symbols);
  const rows = data.stocks.filter((r) => keep.has(r.symbol));
  const up = rows.filter((r) => r.trade_date === data.as_of && (r.pct_change ?? 0) > 0).length;
  const when = !data.as_of || data.as_of === isoDay(new Date()) ? "today" : `on ${weekday(data.as_of)}`;
  return (
    <>
      {up} of {rows.length} up {when}
    </>
  );
}

export default function WatchlistPage() {
  const v = useView();
  const list = useWatchlist();
  const symbols = list.data?.symbols ?? [];
  return (
    <>
      <PageHeader title="Watchlist" description={symbols.length ? <Summary symbols={symbols} /> : undefined} />
      {list.isPending ? (
        <Skeleton className="h-96" />
      ) : list.error ? (
        <Card>
          <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Your watchlist didn't load" />
        </Card>
      ) : !symbols.length ? (
        <Empty />
      ) : (
        <Tabs
          label="Watchlist"
          track="watchlist.tab"
          value={v.tab}
          onChange={(tab) => v.set({ tab: tab === "stocks" ? null : tab })}
          tabs={[
            {
              value: "stocks",
              label: `Stocks (${symbols.length})`,
              content: <Stocks symbols={symbols} />,
            },
            { value: "news", label: "News", content: <News symbols={symbols} /> },
          ]}
        />
      )}
    </>
  );
}
