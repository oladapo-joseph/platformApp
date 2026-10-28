/**
 * Market Today (US-2.1–2.6, US-9.3): the session or a period, as a plain-language headline,
 * stat tiles, movers, sectors, top stories and every stock. View state lives in the URL.
 */
import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router";

import { useMarketStatus, usePreviousSnapshot, useRange, useSnapshot } from "@/api/market";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, ErrorState, Skeleton } from "@/components/ui/feedback";
import { StatTile } from "@/components/ui/StatTile";
import { isoDay, weekday } from "@/lib/dates";
import { money, volume } from "@/lib/format";
import { fromQuotes, fromRange, headline, movers, periodLabel, totals, type Totals } from "@/lib/market";

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

  return (
    <>
      <PageHeader title={heading} actions={latest && <PeriodControls p={p} latest={latest} />} />
      {source.isFetching && !source.isPending && (
        <div aria-hidden className="fixed inset-x-0 top-0 z-(--z-toast) h-0.5 animate-pulse bg-brand" />
      )}
      {source.error && !source.data ? (
        <Card>
          <ErrorState error={source.error} onRetry={() => void source.refetch()} title="The market didn't load" />
        </Card>
      ) : !source.data ? (
        <MarketSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <p className="max-w-3xl text-lg text-fg-2">{headline(t, p.period)}</p>
          <Tiles t={t} prev={p.period ? null : prevTotals} hrefWith={p.hrefWith} />
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
  hrefWith,
}: {
  t: Totals;
  prev: Totals | null;
  hrefWith: (patch: Record<string, string | null>) => string;
}) {
  const vs = "vs previous session";
  const link = "font-medium underline-offset-2 hover:underline";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <StatTile
        label="Breadth"
        value={
          <span className="flex gap-3">
            <Link to={{ search: hrefWith({ sort: "-pct" }), hash: "all-stocks" }} className={`${link} text-gain`}>
              <span aria-hidden>▲ </span>
              {t.up}
              <span className="sr-only"> up</span>
            </Link>
            <Link to={{ search: hrefWith({ sort: "pct" }), hash: "all-stocks" }} className={`${link} text-loss`}>
              <span aria-hidden>▼ </span>
              {t.down}
              <span className="sr-only"> down</span>
            </Link>
          </span>
        }
      >
        <p className="text-xs text-fg-2">
          {t.flat} unchanged · {t.up + t.down + t.flat} stocks
        </p>
      </StatTile>
      <StatTile
        label="Value traded"
        value={money(t.value)}
        delta={prev ? pctDelta(t.value, prev.value) : undefined}
        deltaLabel={vs}
      />
      <StatTile
        label="Volume"
        value={volume(t.volume)}
        delta={prev ? pctDelta(t.volume, prev.volume) : undefined}
        deltaLabel={vs}
      />
      {t.trades !== null ? (
        <StatTile
          label="Deals"
          value={t.trades.toLocaleString("en-NG")}
          delta={prev?.trades ? pctDelta(t.trades, prev.trades) : undefined}
          deltaLabel={vs}
        />
      ) : (
        <StatTile label="Trading days" value={t.days ?? "—"} />
      )}
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

function MarketSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <span className="sr-only">Loading the market</span>
      <Skeleton className="h-6 w-full max-w-2xl" />
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
