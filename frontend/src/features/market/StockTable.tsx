/**
 * Every listed stock (US-2.6): search by ticker or name, sort any column, filter by sector, all
 * kept in the URL. About 150 rows, so a plain semantic table sorted in memory is enough (no
 * virtualisation). On phones it scrolls sideways inside its card with the stock column sticky.
 */
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { Card, EmptyState } from "@/components/ui/feedback";
import { PriceChange } from "@/components/ui/market";
import { cn } from "@/lib/cn";
import { change, money, price, volume } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { matchesQuery, sortRows, type MarketRow, type SortKey } from "@/lib/market";

import { sectorName } from "@/lib/sectors";
import type { MarketParams } from "./useMarketParams";

interface Column {
  key: SortKey;
  label: string;
  cell: (r: MarketRow) => ReactNode;
}

function columns(period: boolean): Column[] {
  return [
    { key: "close", label: period ? "Close" : "Price", cell: (r) => price(r.close) },
    { key: "pct", label: "% Change", cell: (r) => <PriceChange pct={r.pct} /> },
    { key: "change", label: "Change", cell: (r) => change(r.change) },
    { key: "volume", label: "Volume", cell: (r) => volume(r.volume) },
    { key: "value", label: "Value", cell: (r) => money(r.value) },
    period
      ? { key: "days", label: "Days", cell: (r) => r.days ?? "—" }
      : { key: "trades", label: "Deals", cell: (r) => r.trades?.toLocaleString("en-NG") ?? "—" },
  ];
}

function SortHeader({
  label,
  column,
  sortKey,
  desc,
  onSort,
  first = false,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  desc: boolean;
  onSort: (key: SortKey) => void;
  first?: boolean;
}) {
  const active = sortKey === column;
  const Icon = !active ? ChevronsUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
      className={cn(
        "px-3 py-2 text-xs font-medium text-fg-muted sm:px-4",
        first ? "sticky left-0 z-(--z-sticky) bg-surface text-left" : "text-right",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm whitespace-nowrap hover:text-fg",
          active && "text-fg",
          !first && "flex-row-reverse",
        )}
      >
        {label}
        <Icon aria-hidden className={cn("size-3.5", !active && "opacity-50")} />
      </button>
    </th>
  );
}

export function StockTable({ rows, p }: { rows: MarketRow[]; p: MarketParams }) {
  const [text, setText] = useState(p.q);
  const q = useDebounced(text, 200);
  const { update } = p;
  useEffect(() => {
    update({ q: q.trim() || null });
  }, [q, update]);

  // a session has deals, a period has trading days: map a sort on the other one across
  const sortKey: SortKey =
    p.period && p.sort.key === "trades" ? "days" : !p.period && p.sort.key === "days" ? "trades" : p.sort.key;
  const desc = p.sort.desc;
  const cols = useMemo(() => columns(p.period), [p.period]);
  const shown = useMemo(
    () =>
      sortRows(
        rows.filter((r) => (!p.sector || r.sector === p.sector) && matchesQuery(r, q)),
        sortKey,
        desc,
      ),
    [rows, p.sector, q, sortKey, desc],
  );
  const onSort = (key: SortKey) => {
    // a new column starts with its natural order: A→Z for tickers, largest first for numbers
    const nextDesc = key === sortKey ? !desc : key !== "symbol";
    update({ sort: `${nextDesc ? "-" : ""}${key}` });
  };

  const filters = !!p.sector || !!q;
  return (
    <Card id="all-stocks" className="scroll-mt-24 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-fg">All stocks</h2>
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
          />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filter by ticker or name"
            aria-label="Filter stocks by ticker or company name"
            className="touch-target h-10 w-full rounded-md border border-line-input bg-surface pr-3 pl-9 text-sm text-fg placeholder:text-fg-muted"
          />
        </div>
      </div>
      {filters && (
        <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {p.sector && <Chip label={`Sector: ${sectorName(p.sector)}`} onRemove={() => update({ sector: null })} />}
          {q && <Chip label={`Search: ${q}`} onRemove={() => setText("")} />}
          <button
            type="button"
            onClick={() => {
              setText("");
              update({ sector: null, q: null });
            }}
            className="text-xs font-medium text-fg-2 underline-offset-2 hover:text-fg hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
      <p role="status" className="mb-2 text-xs text-fg-muted">
        {shown.length === rows.length ? `${rows.length} stocks` : `${shown.length} of ${rows.length} stocks`}
      </p>
      {shown.length === 0 ? (
        <EmptyState icon={Search} title={q ? `No stocks match “${q}”` : "No stocks in this sector"}>
          {p.sector && q ? "Try removing the sector filter." : "Check the spelling, or search by company name."}
        </EmptyState>
      ) : (
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <caption className="sr-only">All stocks. Column headers sort the list.</caption>
            <thead className="bg-surface">
              <tr className="border-b border-line-subtle">
                <SortHeader label="Stock" column="symbol" sortKey={sortKey} desc={desc} onSort={onSort} first />
                {cols.map((c) => (
                  <SortHeader
                    key={c.key}
                    label={c.label}
                    column={c.key}
                    sortKey={sortKey}
                    desc={desc}
                    onSort={onSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {shown.map((r) => (
                <tr key={r.symbol} className="group hover:bg-hover">
                  <th
                    scope="row"
                    className="sticky left-0 bg-surface px-3 py-2 text-left font-normal group-hover:bg-hover sm:px-4"
                  >
                    <Link to={`/app/stocks/${r.symbol}`} className="block min-w-0 hover:text-brand">
                      <span className="num block font-medium text-fg">{r.symbol}</span>
                      <span className="block max-w-24 truncate text-xs text-fg-muted sm:max-w-44" title={r.company}>
                        {r.company}
                      </span>
                    </Link>
                  </th>
                  {cols.map((c) => (
                    <td key={c.key} className="num px-3 py-2 text-right whitespace-nowrap text-fg sm:px-4">
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sunken py-1 pr-1 pl-3 text-xs text-fg">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="touch-target flex size-5 items-center justify-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}
