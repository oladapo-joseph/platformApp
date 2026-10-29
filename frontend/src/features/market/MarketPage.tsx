/**
 * Market Today (US-2.1–2.6, US-9.3): the session or a period, as a plain-language headline,
 * stat tiles, movers, sectors, top stories and every stock. View state lives in the URL.
 */
import { useEffect, useMemo } from "react";
import { useLocation } from "react-router";

import { useMarketHistory, useMarketStatus, usePreviousSnapshot, useRange, useSnapshot } from "@/api/market";
import type { SectorAggregate } from "@/api/types";
import { Card, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PriceChange } from "@/components/ui/market";
import { StatTile } from "@/components/ui/StatTile";
import { isoDay, weekday } from "@/lib/dates";
import { money, volume } from "@/lib/format";
import { fromQuotes, fromRange, marketTitle, movers, periodLabel, standfirst, totals, type Totals } from "@/lib/market";
import { sectorName } from "@/lib/sectors";

import { BreadthRing } from "./BreadthRing";
import { Movers } from "./Movers";
import { PeriodControls } from "./PeriodControls";
import { Sectors } from "./Sectors";
import { StockTable } from "./StockTable";
import { TopStories } from "./TopStories";
import { useMarketParams } from "./useMarketParams";

const pctDelta = (now: number, before: number | null | undefined) => (before ? ((now - before) / before) * 100 : null);

export default function MarketPage() {
  const p = useMarketParams();
  const status = useMarketStatus();
  const snapshot = useSnapshot();
  const range = useRange(p.start, p.end);
  const latest = snapshot.data?.trade_date ?? status.data?.latest_trade_date ?? null;
  const previous = usePreviousSnapshot(p.period ? undefined : snapshot.data?.trade_date);
  const source = p.period ? range : snapshot;

  const rows = useMemo(
    () => (p.period ? fromRange(range.data?.stocks ?? []) : fromQuotes(snapshot.data?.stocks ?? [])),
    [p.period, range.data, snapshot.data],
  );
  const t = useMemo(() => totals(rows), [rows]);
  const prevTotals = useMemo(() => (previous.data ? totals(fromQuotes(previous.data.stocks)) : null), [previous.data]);
  const lists = useMemo(() => movers(rows), [rows]);

  useScrollToHash(!!source.data);

  const today = isoDay(new Date());
  const heading = p.period
    ? `Market · ${periodLabel(p.start ?? "", p.end ?? "")}`
    : !latest || latest === today
      ? "Market today"
      : `Market · ${weekday(latest)}`;

  const history = useMarketHistory(20);
  const trend = (key: "total_value" | "total_volume" | "total_trades") =>
    p.period ? undefined : history.data?.sessions.map((s) => s[key]);

  return (
    <>
      {source.isFetching && !source.isPending && (
        <div aria-hidden className="fixed inset-x-0 top-0 z-(--z-toast) h-0.5 animate-pulse bg-brand" />
      )}
      {source.error && !source.data ? (
        <Card>
          <ErrorState error={source.error} onRetry={() => void source.refetch()} title="The market didn't load" />
        </Card>
      ) : !source.data ? (
        <MarketSkeleton heading={heading} />
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="market-title" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-6">
            <Card className="flex flex-col gap-4 rounded-xl p-6 shadow-elev-2 md:p-8">
              <p className="eyebrow text-fg-muted">{heading}</p>
              <h1
                id="market-title"
                className="font-headline text-4xl leading-[1.05] font-semibold tracking-tight text-fg md:text-5xl"
              >
                <span className="sr-only">{heading}: </span>
                {marketTitle(t, p.period)}
              </h1>
              <p className="max-w-3xl text-base text-fg-2 md:text-lg">
                {standfirst(t, p.period ? null : prevTotals, source.data.summary.sectors, p.period)}
              </p>
              {latest && (
                <div className="mt-1">
                  <PeriodControls p={p} latest={latest} />
                </div>
              )}
            </Card>
            <Card className="flex items-center justify-center rounded-xl p-6 shadow-elev-2">
              <BreadthRing t={t} hrefWith={p.hrefWith} />
            </Card>
          </section>
          <Tiles t={t} prev={p.period ? null : prevTotals} sectors={source.data.summary.sectors} trend={trend} />
          <Movers lists={lists} hrefWith={p.hrefWith} period={p.period} />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Sectors
                sectors={source.data.summary.sectors}
                selected={p.sector}
                onSelect={(sector) => p.update({ sector })}
              />
            </div>
            <TopStories sector={p.sector} />
          </div>
          <StockTable rows={rows} p={p} />
        </div>
      )}
    </>
  );
}

function Tiles({
  t,
  prev,
  sectors,
  trend,
}: {
  t: Totals;
  prev: Totals | null;
  sectors: SectorAggregate[];
  trend: (key: "total_value" | "total_volume" | "total_trades") => number[] | undefined;
}) {
  const vs = "vs previous session";
  const best = [...sectors]
    .filter((x) => x.avg_pct_change !== null)
    .sort((x, y) => (y.avg_pct_change ?? 0) - (x.avg_pct_change ?? 0))[0];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <StatTile
        label="Value traded"
        value={money(t.value)}
        delta={prev ? pctDelta(t.value, prev.value) : undefined}
        deltaLabel={vs}
        trend={trend("total_value")}
      />
      <StatTile
        label="Volume"
        value={volume(t.volume)}
        delta={prev ? pctDelta(t.volume, prev.volume) : undefined}
        deltaLabel={vs}
        trend={trend("total_volume")}
      />
      {t.trades !== null ? (
        <StatTile
          label="Deals"
          value={t.trades.toLocaleString("en-NG")}
          delta={prev?.trades ? pctDelta(t.trades, prev.trades) : undefined}
          deltaLabel={vs}
          trend={trend("total_trades")}
        />
      ) : (
        <StatTile label="Trading days" value={t.days ?? "—"} />
      )}
      <StatTile label="Strongest sector" value={best ? sectorName(best.sector) : "—"}>
        {best?.avg_pct_change != null && (
          <p className="text-xs text-fg-2">
            <PriceChange pct={best.avg_pct_change} /> average move
          </p>
        )}
      </StatTile>
    </div>
  );
}

/** "See all" links land on #all-stocks: scroll there once the list exists. */
function useScrollToHash(ready: boolean) {
  const { hash, search } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ready, hash, search]);
}

function MarketSkeleton({ heading }: { heading: string }) {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <h1 className="sr-only">{heading}</h1>
      <span className="sr-only">Loading the market</span>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl max-lg:hidden" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
