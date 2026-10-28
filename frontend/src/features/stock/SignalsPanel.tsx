/** Signals for the chosen strategy (US-3.5): summary, then a list linked both ways with the chart markers. */
import { Activity } from "lucide-react";

import type { SignalsResponse, StrategyInfo } from "@/api/types";
import { SegmentedControl } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PriceChange } from "@/components/ui/market";
import { cn } from "@/lib/cn";
import { day } from "@/lib/dates";
import { price } from "@/lib/format";
import { signalSummary, signalWording, sinceSignal, type ChartRange } from "@/lib/stock";

const SHORT: Record<string, string> = {
  macd_crossover: "MACD",
  rsi_reversal: "RSI",
  sma_golden_cross: "SMA cross",
};

export function SignalsPanel({
  data,
  error,
  onRetry,
  strategies,
  strategy,
  onStrategy,
  range,
  latest,
  lastClose,
  selected,
  onSelect,
  symbol,
}: {
  data: SignalsResponse | undefined;
  error: unknown;
  onRetry: () => void;
  strategies: StrategyInfo[];
  strategy: string;
  onStrategy: (slug: string) => void;
  range: ChartRange;
  latest: string | null | undefined;
  lastClose: number | null | undefined;
  selected: string | null;
  onSelect: (date: string) => void;
  symbol: string;
}) {
  const info = strategies.find((s) => s.slug === strategy) ?? data?.strategy;
  const signals = data?.signals ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Strategy"
          size="sm"
          value={strategy}
          onChange={onStrategy}
          options={(strategies.length ? strategies : [{ slug: strategy, label: strategy }]).map((s) => ({
            value: s.slug,
            label: SHORT[s.slug] ?? s.label,
            ariaLabel: s.label,
          }))}
        />
        {info && <p className="text-xs text-fg-muted">{info.description}</p>}
      </div>
      {error && !data ? (
        <ErrorState error={error} onRetry={onRetry} title="Signals didn't load" />
      ) : !data ? (
        <div aria-busy className="flex flex-col gap-2">
          <span className="sr-only">Loading signals</span>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !data.enough_history ? (
        <EmptyState icon={Activity} title="Not enough history for this strategy">
          {info?.label ?? "This strategy"} needs about {data.strategy.warmup_days} trading days of history; {symbol} has{" "}
          {data.history_days}.
        </EmptyState>
      ) : signals.length === 0 ? (
        <EmptyState icon={Activity} title="No signals in this period">
          Try a longer range, such as 1Y or ALL.
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-fg-2">{signalSummary(signals, range, latest)}</p>
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Signals, newest first. Selecting one marks it on the chart.</caption>
              <thead>
                <tr className="border-b border-line-subtle text-xs text-fg-muted">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Signal
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Price
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Since signal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {[...signals].reverse().map((s) => {
                  const isSelected = s.date === selected;
                  return (
                    <tr key={`${s.date}-${s.side}`} className={cn(isSelected && "bg-selected")}>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelect(s.date)}
                          aria-pressed={isSelected}
                          className="num text-left text-fg underline-offset-2 hover:text-brand hover:underline"
                        >
                          {day(s.date)}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <span className={cn("font-medium", s.side === "buy" ? "text-gain" : "text-loss")}>
                          <span aria-hidden>{s.side === "buy" ? "▲ " : "▼ "}</span>
                          {s.side === "buy" ? "Buy" : "Sell"}
                        </span>
                        <span className="block text-xs text-fg-2">{signalWording(strategy, s.side)}</span>
                      </td>
                      <td className="num px-4 py-2 text-right text-fg">{price(s.price)}</td>
                      <td className="px-4 py-2 text-right">
                        <PriceChange pct={sinceSignal(s, lastClose)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-fg-muted">
            Signals describe what an indicator did. They are not recommendations to buy or sell.
          </p>
        </>
      )}
    </div>
  );
}
