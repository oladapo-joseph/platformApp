/**
 * Every listed stock as a table (US-2.6, moved here from Market; US-2.9): sort any column, the
 * stock column sticky when the table scrolls sideways on phones. About 150 rows, sorted in
 * memory, so a plain semantic table is enough.
 */
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import type { ScreenRow, StrategyInfo } from "@/api/types";
import { PriceChange } from "@/components/ui/market";
import { WatchStar } from "@/components/ui/WatchStar";
import { cn } from "@/lib/cn";
import { change, money, price, volume } from "@/lib/format";
import { range52, strategyShort, type ScreenSortKey } from "@/lib/screener";

import { CompareToggle, SignalLine } from "./StockCards";

interface Column {
  key: ScreenSortKey;
  label: string;
  cell: (r: ScreenRow) => ReactNode;
  left?: boolean;
}

function columns(period: boolean, signal: (r: ScreenRow) => ReactNode, signalLabel: string): Column[] {
  return [
    { key: "close", label: period ? "Close" : "Price", cell: (r) => price(r.close) },
    { key: "pct", label: "% Change", cell: (r) => <PriceChange pct={r.pct_change} /> },
    { key: "change", label: "Change", cell: (r) => change(r.change) },
    { key: "value", label: "Value", cell: (r) => money(r.value) },
    { key: "volume", label: "Volume", cell: (r) => volume(r.volume) },
    period
      ? { key: "days", label: "Days", cell: (r) => r.days ?? "—" }
      : { key: "trades", label: "Deals", cell: (r) => r.trades?.toLocaleString("en-NG") ?? "—" },
    { key: "market_cap", label: "Market cap", cell: (r) => money(r.market_cap) },
    {
      key: "range52",
      label: "52-wk position",
      cell: (r) => {
        const at = range52(r);
        return at === null ? "—" : `${Math.round(at * 100)}%`;
      },
    },
    { key: "signal", label: `${signalLabel} signal`, cell: signal, left: true },
  ];
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  first = false,
  left = false,
}: {
  label: string;
  column: ScreenSortKey;
  sort: { key: ScreenSortKey; desc: boolean };
  onSort: (key: ScreenSortKey) => void;
  first?: boolean;
  left?: boolean;
}) {
  const active = sort.key === column;
  const Icon = !active ? ChevronsUpDown : sort.desc ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
      className={cn(
        "px-3 py-2 text-xs font-medium text-fg-muted sm:px-4",
        first ? "sticky left-0 z-(--z-sticky) bg-surface text-left" : left ? "text-left" : "text-right",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm whitespace-nowrap hover:text-fg",
          active && "text-fg",
          !first && !left && "flex-row-reverse",
        )}
      >
        {label}
        <Icon aria-hidden className={cn("size-3.5", !active && "opacity-50")} />
      </button>
    </th>
  );
}

export function ScreenTable({
  rows,
  period,
  sort,
  onSort,
  strategy,
  strategies,
  latest,
  picked,
  onCompare,
}: {
  rows: ScreenRow[];
  period: boolean;
  sort: { key: ScreenSortKey; desc: boolean };
  onSort: (key: ScreenSortKey) => void;
  strategy: string;
  strategies: StrategyInfo[] | undefined;
  latest: string;
  picked: string[];
  onCompare: (symbol: string) => void;
}) {
  const cols = columns(
    period,
    (r) => <SignalLine row={r} strategy={strategy} strategies={strategies} latest={latest} />,
    strategyShort(strategy, strategies),
  );
  return (
    <div className="relative -mx-4 overflow-x-auto">
      <table className="w-full min-w-[60rem] text-sm">
        <caption className="sr-only">Stocks. Column headers sort the list.</caption>
        <thead className="bg-surface">
          <tr className="border-b border-line-subtle">
            <SortHeader label="Stock" column="symbol" sort={sort} onSort={onSort} first />
            {cols.map((c) => (
              <SortHeader key={c.key} label={c.label} column={c.key} sort={sort} onSort={onSort} left={c.left} />
            ))}
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-fg-muted sm:px-4">
              <span className="sr-only">Compare</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {rows.map((r) => (
            <tr key={r.symbol} className="group hover:bg-hover">
              <th
                scope="row"
                className="sticky left-0 bg-surface px-3 py-2 text-left font-normal group-hover:bg-hover sm:px-4"
              >
                <div className="-ml-2 flex items-center gap-1">
                  <WatchStar symbol={r.symbol} />
                  <Link to={`/app/stocks/${r.symbol}`} className="block min-w-0 hover:text-brand">
                    <span className="num block font-medium text-fg">{r.symbol}</span>
                    <span
                      className="block max-w-24 truncate text-xs text-fg-muted sm:max-w-44"
                      title={r.company ?? undefined}
                    >
                      {r.company}
                    </span>
                  </Link>
                </div>
              </th>
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={cn("px-3 py-2 whitespace-nowrap text-fg sm:px-4", c.left ? "text-left" : "num text-right")}
                >
                  {c.cell(r)}
                </td>
              ))}
              <td className="px-3 py-2 sm:px-4">
                <CompareToggle symbol={r.symbol} picked={picked} onToggle={onCompare} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
