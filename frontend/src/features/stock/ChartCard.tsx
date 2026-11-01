/**
 * The chart card: range (thumb-reachable, directly above the chart), Candle/Line, Indicators,
 * "View as table" and Reset. The chart library loads lazily behind a skeleton (US-3.3).
 */
import { RotateCcw, SlidersHorizontal, Table2 } from "lucide-react";
import { Popover } from "radix-ui";
import { lazy, Suspense, useState } from "react";

import { subDays } from "date-fns";

import type { Bar, IndicatorsResponse, NewsDay, SignalEvent } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/controls";
import { Card, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useMediaQuery } from "@/lib/hooks";
import { INDICATORS, OVERLAYS, PANES, RANGES, type Overlay, type Pane } from "@/lib/stock";

import { DataPanel } from "./DataPanel";
import type { NewsPick } from "./NewsStrip";
import type { StockViewState } from "./useStockView";

const PriceChart = lazy(() => import("./PriceChart"));

function IndicatorPicker({ v }: { v: StockViewState }) {
  const toggle = <T extends string>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  const group = <T extends Overlay | Pane>(
    title: string,
    items: readonly T[],
    selected: T[],
    onChange: (next: T[]) => void,
  ) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="eyebrow mb-1 text-fg-muted">{title}</legend>
      {items.map((key) => (
        <label key={key} className="flex cursor-pointer items-start gap-3 rounded-md p-1.5 hover:bg-hover">
          <input
            type="checkbox"
            checked={selected.includes(key)}
            onChange={() => onChange(toggle(selected, key))}
            className="mt-0.5 size-4 shrink-0 accent-(--color-brand)"
          />
          <span>
            <span className="block text-sm text-fg">{INDICATORS[key].label}</span>
            <span className="block text-xs text-fg-muted">{INDICATORS[key].explainer}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="secondary" size="sm" icon={<SlidersHorizontal aria-hidden className="size-4" />}>
          Indicators{v.overlays.length + v.panes.length > 0 ? ` (${v.overlays.length + v.panes.length})` : ""}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-(--z-dropdown) flex max-h-[min(70vh,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-24px))] flex-col gap-4 overflow-y-auto rounded-lg border border-line bg-raised p-4 shadow-md"
        >
          {group("Trend (on price)", OVERLAYS, v.overlays, v.setOverlays)}
          {group("Momentum (below price)", PANES, v.panes, v.setPanes)}
          <fieldset className="flex flex-col gap-2">
            <legend className="eyebrow mb-1 text-fg-muted">Events</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-md p-1.5 hover:bg-hover">
              <input
                type="checkbox"
                checked={v.news}
                onChange={() => v.setNews(!v.news)}
                className="mt-0.5 size-4 shrink-0 accent-(--color-brand)"
              />
              <span>
                <span className="block text-sm text-fg">News</span>
                <span className="block text-xs text-fg-muted">
                  Days with news about the stock, marked under the chart (last 90 days)
                </span>
              </span>
            </label>
          </fieldset>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function ChartCard({
  v,
  symbol,
  bars,
  barsError,
  onRetry,
  indicators,
  signals,
  selectedSignal,
  onSelectSignal,
  summary,
  note,
  news,
  newsPick,
}: {
  v: StockViewState;
  symbol: string;
  bars: Bar[] | undefined;
  barsError: unknown;
  onRetry: () => void;
  indicators: IndicatorsResponse | undefined;
  signals: SignalEvent[];
  selectedSignal: string | null;
  onSelectSignal: (date: string) => void;
  summary: string;
  note: string | null;
  news: NewsDay[] | undefined;
  newsPick: NewsPick;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  const [resetKey, setResetKey] = useState(0);
  const lowerPanes = v.panes.length;
  const height = (wide ? 380 : Math.round(window.innerHeight * 0.45)) + lowerPanes * (wide ? 110 : 90);
  // news is kept 90 days (ADR-014): say so when the range reaches further back
  const first = bars?.[0]?.date;
  const last = bars?.at(-1)?.date;
  const olderThanNews = v.news && !!first && !!last && first < subDays(new Date(last), 90).toISOString().slice(0, 10);

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Chart range"
          track="stock.range"
          size="sm"
          value={v.range}
          onChange={v.setRange}
          options={RANGES.map((r) => ({ value: r, label: r }))}
        />
        <SegmentedControl
          label="Chart type"
          track="stock.chart"
          size="sm"
          value={v.type}
          onChange={v.setType}
          options={[
            { value: "candle", label: "Candle" },
            { value: "line", label: "Line" },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <IndicatorPicker v={v} />
          <Button
            variant="ghost"
            size="sm"
            icon={<Table2 aria-hidden className="size-4" />}
            aria-pressed={v.table}
            onClick={() => v.setTable(!v.table)}
          >
            {v.table ? "View chart" : "View as table"}
          </Button>
          {!v.table && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Reset zoom"
              title="Reset zoom"
              icon={<RotateCcw aria-hidden className="size-4" />}
              onClick={() => setResetKey((k) => k + 1)}
            />
          )}
        </div>
      </div>
      {note && <p className="mb-2 text-xs text-fg-muted">{note}</p>}
      {olderThanNews && !v.table && <p className="mb-2 text-xs text-fg-muted">News available for the last 90 days.</p>}
      {barsError && !bars ? (
        <ErrorState error={barsError} onRetry={onRetry} title="Prices didn't load" />
      ) : !bars ? (
        <div style={{ height }}>
          <Skeleton className="h-full w-full" />
        </div>
      ) : bars.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg-2">No trading data in this range.</p>
      ) : v.table ? (
        <DataPanel symbol={symbol} bars={bars} maxHeight={height} />
      ) : (
        <Suspense
          fallback={
            <div style={{ height }}>
              <Skeleton className="h-full w-full" />
            </div>
          }
        >
          <div style={{ minHeight: height }}>
            <PriceChart
              key={resetKey}
              bars={bars}
              indicators={indicators}
              type={v.type}
              overlays={v.overlays}
              panes={v.panes}
              signals={signals}
              selectedSignal={selectedSignal}
              onSelectSignal={onSelectSignal}
              summary={summary}
              height={height}
              news={v.news ? (news ?? []) : undefined}
              newsPick={newsPick}
            />
          </div>
        </Suspense>
      )}
    </Card>
  );
}
