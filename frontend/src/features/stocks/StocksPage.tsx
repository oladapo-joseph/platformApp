/**
 * Stocks (US-2.9, US-2.10, US-2.6): every listed stock for the session or a period, as digest
 * cards (your watchlist first, then most traded) or a table. Filter by sector and subsector, size,
 * liquidity and the latest signal; tick up to 4 for Compare (US-3.10). All of it is in the URL,
 * and Market's "See all" links land here.
 */
import { Download, GitCompareArrows, LayoutGrid, Search, Table2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { useMarketStatus } from "@/api/market";
import { useScreener } from "@/api/screener";
import { useStrategies } from "@/api/stock";
import { useWatchlist } from "@/api/watchlist";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonClass } from "@/components/ui/buttonClass";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/controls";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { track } from "@/lib/analytics";
import { day } from "@/lib/dates";
import { useDebounced } from "@/lib/hooks";
import { periodLabel } from "@/lib/market";
import { filterRows, MAX_COMPARE, screenCsv, sortScreen, type ScreenSortKey } from "@/lib/screener";

import { PeriodControls } from "../market/PeriodControls";
import { FilterChips, FilterControls } from "./StockFilters";
import { ScreenTable } from "./ScreenTable";
import { StockCards } from "./StockCards";
import { useStocksParams } from "./useStocksParams";

const SORTS: { value: string; label: string; rest: string }[] = [
  { value: "-value", label: "Most traded", rest: "most traded first" },
  { value: "-pct", label: "Biggest risers", rest: "biggest risers first" },
  { value: "pct", label: "Biggest fallers", rest: "biggest fallers first" },
  { value: "-market_cap", label: "Largest", rest: "largest first" },
  { value: "-signal", label: "Newest signal", rest: "newest signal first" },
  { value: "-range52", label: "Near 52-week high", rest: "nearest their 52-week high first" },
  { value: "range52", label: "Near 52-week low", rest: "nearest their 52-week low first" },
  { value: "symbol", label: "Ticker A–Z", rest: "A to Z" },
];

function download(csv: string, name: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export default function StocksPage() {
  const p = useStocksParams();
  const status = useMarketStatus();
  const screen = useScreener(p.start, p.end);
  const strategies = useStrategies();
  const watchlist = useWatchlist();
  const latest = screen.data?.trade_date ?? status.data?.latest_trade_date ?? null;
  const watch = useMemo(() => new Set(watchlist.data?.symbols ?? []), [watchlist.data]);

  const [text, setText] = useState(p.filters.q);
  const q = useDebounced(text, 200);
  const { update } = p;
  useEffect(() => {
    update({ q: q.trim() || null });
  }, [q, update]);

  const f = p.filters;
  const all = screen.data?.stocks;
  const shown = useMemo(() => {
    if (!all || !latest) return [];
    return sortScreen(filterRows(all, { ...f, q }, watch, latest), p.sort.key, p.sort.desc, f.strategy);
  }, [all, f, q, watch, latest, p.sort]);

  // a session has deals, a period has trading days: map a sort on the other one across
  const sortKey: ScreenSortKey =
    p.period && p.sort.key === "trades" ? "days" : !p.period && p.sort.key === "days" ? "trades" : p.sort.key;
  const onSort = (key: ScreenSortKey) => {
    const nextDesc = key === sortKey ? !p.sort.desc : key !== "symbol";
    update({ sort: `${nextDesc ? "-" : ""}${key}` });
  };
  const sortValue = `${p.sort.desc && p.sort.key !== "symbol" ? "-" : ""}${p.sort.key}`;
  const sortChoice = SORTS.find((s) => s.value === sortValue);

  const toggleCompare = (symbol: string) => {
    const next = p.compare.includes(symbol) ? p.compare.filter((s) => s !== symbol) : [...p.compare, symbol];
    if (!p.compare.includes(symbol)) track("compare.add", { symbol });
    update({ cmp: next.slice(0, MAX_COMPARE).join(",") || null });
  };
  const clearAll = () => {
    setText("");
    update({ q: null, sector: null, sub: null, cap: null, liq: null, sig: null, watch: null, traded: null });
  };
  const compareHref = `/app/stocks/compare?${new URLSearchParams({
    symbols: p.compare.join(","),
    ...(p.period && p.start && p.end ? { start: p.start, end: p.end } : {}),
  }).toString()}`;

  const scope =
    p.period && p.start && p.end ? periodLabel(p.start, p.end) : latest ? `the session of ${day(latest)}` : "";

  return (
    <>
      <PageHeader
        title="Stocks"
        description={
          all
            ? `${all.length} NGX stocks${scope ? `, ${scope}` : ""}. Filter, sort, and tick up to ${MAX_COMPARE} to compare.`
            : "Every NGX stock: filter, sort and compare."
        }
      />
      {screen.isFetching && !screen.isPending && (
        <div aria-hidden className="fixed inset-x-0 top-0 z-(--z-toast) h-0.5 animate-pulse bg-brand" />
      )}
      <Card className="mb-4 flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
            />
            <input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ticker, company or subsector"
              aria-label="Filter stocks by ticker, company name or subsector"
              className="touch-target h-10 w-full rounded-md border border-line-input bg-surface pr-3 pl-9 text-sm text-fg placeholder:text-fg-muted"
            />
          </div>
          {latest && <PeriodControls p={p} latest={latest} scope="stocks" />}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {all ? <FilterControls rows={all} p={p} strategies={strategies.data} /> : <Skeleton className="h-10 w-64" />}
          <div className="flex flex-wrap items-center gap-2">
            {p.view === "cards" && (
              <label className="flex items-center gap-2 text-sm text-fg-2">
                Sort
                <select
                  value={sortChoice?.value ?? ""}
                  onChange={(e) => update({ sort: e.target.value })}
                  className="touch-target h-10 rounded-md border border-line-input bg-surface px-2 text-sm text-fg"
                >
                  {!sortChoice && <option value="">By the table's column</option>}
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <SegmentedControl
              label="Layout"
              track="stocks.layout"
              value={p.view}
              onChange={(view) => update({ view: view === "cards" ? null : view })}
              options={[
                { value: "cards", label: <LayoutGrid aria-hidden className="size-4" />, ariaLabel: "Cards" },
                { value: "table", label: <Table2 aria-hidden className="size-4" />, ariaLabel: "Table" },
              ]}
            />
            <Button
              variant="ghost"
              disabled={!shown.length}
              icon={<Download aria-hidden className="size-4" />}
              onClick={() => {
                track("stocks.export", { rows: shown.length });
                download(screenCsv(shown, p.period), `ngx-stocks-${p.end ?? latest ?? "latest"}.csv`);
              }}
            >
              CSV
            </Button>
          </div>
        </div>
        <FilterChips p={p} strategies={strategies.data} onClear={clearAll} />
        {all && (
          <p role="status" className="text-xs text-fg-muted">
            {shown.length === all.length ? `${all.length} stocks` : `${shown.length} of ${all.length} stocks`}
          </p>
        )}
      </Card>

      {screen.error && !screen.data ? (
        <Card>
          <ErrorState error={screen.error} onRetry={() => void screen.refetch()} title="Stocks didn't load" />
        </Card>
      ) : !all || !latest || watchlist.isPending ? (
        <div aria-busy className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <span className="sr-only">Loading stocks</span>
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title={q ? `No stocks match “${q}”` : "No stocks match these filters"}
            action={
              <Button variant="secondary" onClick={clearAll}>
                Clear all filters
              </Button>
            }
          >
            Try removing a filter, or search by company name.
          </EmptyState>
        </Card>
      ) : p.view === "table" ? (
        <Card className="p-4">
          <ScreenTable
            rows={shown}
            period={p.period}
            sort={{ key: sortKey, desc: p.sort.desc }}
            onSort={onSort}
            strategy={f.strategy}
            strategies={strategies.data}
            latest={latest}
            picked={p.compare}
            onCompare={toggleCompare}
          />
        </Card>
      ) : (
        <StockCards
          rows={shown}
          watch={watch}
          groupWatchlist={!f.watchlist}
          restLabel={sortChoice?.rest ?? "in the order chosen"}
          strategy={f.strategy}
          strategies={strategies.data}
          latest={latest}
          period={p.period}
          picked={p.compare}
          onCompare={toggleCompare}
        />
      )}

      {p.compare.length > 0 && (
        <div className="sticky bottom-[calc(var(--layout-bottomnav-h)+12px)] z-(--z-sticky) mt-6 md:bottom-4">
          <div
            role="region"
            aria-label="Stocks to compare"
            className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-line bg-raised p-3 shadow-lg"
          >
            <GitCompareArrows aria-hidden className="size-5 text-brand" />
            <span className="text-sm text-fg-2">
              Compare <span className="num">{p.compare.length}</span> of {MAX_COMPARE}:
            </span>
            {p.compare.map((s) => (
              <span
                key={s}
                className="num inline-flex items-center gap-1 rounded-full bg-sunken py-1 pr-1 pl-3 text-xs text-fg"
              >
                {s}
                <button
                  type="button"
                  onClick={() => toggleCompare(s)}
                  aria-label={`Remove ${s} from Compare`}
                  className="touch-target flex size-5 items-center justify-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </span>
            ))}
            <span className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => update({ cmp: null })}
                className="text-xs font-medium text-fg-2 underline-offset-2 hover:text-fg hover:underline"
              >
                Clear
              </button>
              <Link
                to={compareHref}
                onClick={() => track("compare.open", { from: "stocks", count: p.compare.length })}
                className={buttonClass("primary", "sm")}
              >
                {p.compare.length === 1 ? "Compare with its sector" : "Compare"}
              </Link>
            </span>
          </div>
        </div>
      )}
    </>
  );
}
