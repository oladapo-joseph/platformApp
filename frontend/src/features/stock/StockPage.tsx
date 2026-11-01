/**
 * The stock page (US-3.2–3.9, US-3.11, US-9.1). `/app/stocks` without a symbol is the
 * "find a stock" start; an unknown ticker says so and opens the search.
 */
import { Search, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { ApiError } from "@/api/client";
import { useBars, useIndicators, useProfile, useSignals, useStrategies, useYearBars } from "@/api/stock";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/controls";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/Toast";
import { useMediaQuery } from "@/lib/hooks";
import { openSearch, POPULAR_FALLBACK, rememberStock } from "@/lib/search";
import { chartSummary, indicatorSet, rangeStart, shortHistory } from "@/lib/stock";

import { AiInsightCard } from "./AiInsightCard";
import { ChartCard } from "./ChartCard";
import { DataPanel } from "./DataPanel";
import { NewsPanel } from "./NewsPanel";
import { PeersPanel } from "./PeersPanel";
import { SignalsPanel } from "./SignalsPanel";
import { StockHeader } from "./StockHeader";
import { useStockView } from "./useStockView";

export default function StockPage() {
  const { symbol: raw } = useParams();
  return raw ? <Stock key={raw.toUpperCase()} symbol={raw.toUpperCase()} /> : <FindAStock />;
}

function FindAStock() {
  return (
    <>
      <PageHeader title="Stocks" />
      <Card>
        <EmptyState
          icon={Search}
          title="Find a stock"
          action={
            <Button onClick={openSearch} icon={<Search aria-hidden className="size-4" />}>
              Search stocks
            </Button>
          }
        >
          <p>Search by ticker or company name, or press “/” anywhere.</p>
          <p className="mt-3 flex flex-wrap justify-center gap-2">
            <span className="text-fg-muted">Popular:</span>
            {POPULAR_FALLBACK.slice(0, 4).map((s) => (
              <Link key={s} to={`/app/stocks/${s}`} className="num font-medium text-brand hover:underline">
                {s}
              </Link>
            ))}
          </p>
        </EmptyState>
      </Card>
    </>
  );
}

function Stock({ symbol }: { symbol: string }) {
  const v = useStockView();
  const profile = useProfile(symbol);
  const latest = profile.data?.latest_trade_date ?? null;
  const start = latest ? rangeStart(v.range, latest) : null;
  const range = { start, end: latest };
  const ready = !!latest;
  const bars = useBars(symbol, range, ready);
  const yearBars = useYearBars(symbol, latest);
  const set = indicatorSet(v.overlays, v.panes);
  const indicators = useIndicators(symbol, set, range, ready);
  const strategies = useStrategies();
  const signals = useSignals(symbol, v.strategy, range, ready);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, showToast] = useToast();
  const wide = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    if (profile.data) rememberStock(profile.data.symbol);
  }, [profile.data]);

  const notFound = profile.error instanceof ApiError && profile.error.status === 404;
  useEffect(() => {
    if (notFound) openSearch(); // US-3.2: unknown symbol → search open
  }, [notFound]);

  const barList = bars.data?.bars;
  const signalList = useMemo(() => signals.data?.signals ?? [], [signals.data]);
  const summary = chartSummary(symbol, v.range, bars.data?.stats?.pct_change, barList?.at(-1)?.close, signalList);

  if (notFound) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title={`We couldn't find “${symbol}”`}
          action={
            <Button onClick={openSearch} icon={<Search aria-hidden className="size-4" />}>
              Search stocks
            </Button>
          }
        >
          Check the ticker, or search by company name.
        </EmptyState>
      </Card>
    );
  }
  if (profile.error) {
    return (
      <Card>
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} title={`${symbol} didn't load`} />
      </Card>
    );
  }
  if (!profile.data) return <StockSkeleton />;

  const p = profile.data;
  const lastClose = barList?.at(-1)?.close;
  const signalsPanel = (
    <SignalsPanel
      data={signals.data}
      error={signals.error}
      onRetry={() => void signals.refetch()}
      strategies={strategies.data ?? []}
      strategy={v.strategy}
      onStrategy={(s) => {
        setSelected(null);
        v.setStrategy(s);
      }}
      range={v.range}
      latest={latest}
      lastClose={lastClose}
      selected={selected}
      onSelect={setSelected}
      symbol={symbol}
    />
  );
  const strategyLabel = strategies.data?.find((s) => s.slug === v.strategy)?.label ?? signals.data?.strategy.label;
  const aiCard = (
    <AiInsightCard
      key={`${v.strategy}-${v.range}`}
      symbol={symbol}
      strategy={v.strategy}
      strategyLabel={strategyLabel ?? v.strategy}
      range={v.range}
      start={start}
      end={latest}
      latest={latest}
      className={wide ? undefined : "mt-4"}
    />
  );
  const peers = <PeersPanel symbol={symbol} start={barList?.[0]?.date ?? start} end={latest} />;
  const data = barList ? <DataPanel symbol={symbol} bars={barList} maxHeight={520} /> : <Skeleton className="h-48" />;
  const news = <NewsPanel symbol={symbol} sector={p.sector} heading={wide} />;
  const tabs = wide
    ? [
        { value: "signals", label: "Signals", content: signalsPanel },
        { value: "peers", label: "Peers", content: peers },
        { value: "data", label: "Data", content: data },
      ]
    : [
        {
          value: "signals",
          label: "Signals",
          content: (
            <>
              {signalsPanel}
              {aiCard}
            </>
          ),
        },
        { value: "news", label: "News", content: news },
        { value: "peers", label: "Peers", content: peers },
        { value: "data", label: "Data", content: data },
      ];
  const tab = tabs.some((t) => t.value === v.tab) ? (v.tab as string) : "signals";

  return (
    <>
      <StockHeader profile={p} yearBars={yearBars.data?.bars ?? []} toast={showToast} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <ChartCard
            v={v}
            symbol={symbol}
            bars={barList}
            barsError={bars.error}
            onRetry={() => void bars.refetch()}
            indicators={indicators.data}
            signals={signalList}
            selectedSignal={selected}
            onSelectSignal={(date) => {
              if (signalList.some((s) => s.date === date)) {
                setSelected(date);
                v.setTab("signals");
              }
            }}
            summary={summary}
            note={barList ? shortHistory(v.range, start, barList) : null}
          />
          <Card className="p-4">
            <Tabs label={`${symbol} details`} track="stock.tab" value={tab} onChange={v.setTab} tabs={tabs} />
          </Card>
        </div>
        {wide && (
          <aside aria-label={`${symbol} AI reading and news`} className="flex flex-col gap-6">
            {aiCard}
            <Card className="sticky top-[calc(var(--layout-topbar-h)+16px)] p-4">{news}</Card>
          </aside>
        )}
      </div>
      {toast}
    </>
  );
}

function StockSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-[480px] w-full" />
    </div>
  );
}
