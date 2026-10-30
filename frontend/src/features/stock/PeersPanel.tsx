/** Similar stocks (US-3.7): up to 8 peers with why they matched; a table on desktop, cards on phones. */
import { Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { useRange } from "@/api/market";
import { useSimilar, type PeerSort } from "@/api/stock";
import type { PeerEntry } from "@/api/types";
import { SegmentedControl } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PriceChange } from "@/components/ui/market";
import { WatchStar } from "@/components/ui/WatchStar";
import { money } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";

const SORTS: { value: PeerSort; label: string }[] = [
  { value: "overall", label: "Match" },
  { value: "industry", label: "Industry" },
  { value: "market_cap", label: "Size" },
  { value: "traded_value", label: "Traded value" },
];

function Breakdown({ peer }: { peer: PeerEntry }) {
  const parts: [string, number][] = [
    ["Industry", peer.scores.industry],
    ["Size", peer.scores.market_cap],
    ["Value", peer.scores.traded_value],
    ["Volume", peer.scores.volume],
  ];
  return (
    <span className="flex flex-wrap gap-x-2 text-xs text-fg-muted">
      {parts.map(([label, v]) => (
        <span key={label}>
          {label} <span className="num text-fg-2">{v}</span>
        </span>
      ))}
    </span>
  );
}

function Match({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="h-1.5 w-12 overflow-hidden rounded-full bg-sunken">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
      </span>
      <span className="num text-sm text-fg">{value}%</span>
    </span>
  );
}

export function PeersPanel({ symbol, start, end }: { symbol: string; start: string | null; end: string | null }) {
  const [sort, setSort] = useState<PeerSort>("overall");
  const { data, isPending, error, refetch } = useSimilar(symbol, start, end, sort);
  const range = useRange(start, end); // period % change per peer (not in the similar response)
  const pct = new Map((range.data?.stocks ?? []).map((r) => [r.symbol, r.pct_change]));
  const wide = useMediaQuery("(min-width: 768px)");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Sort peers"
          track="stock.peers_sort"
          size="sm"
          value={sort}
          onChange={setSort}
          options={SORTS}
        />
        <p className="text-xs text-fg-muted">Based on industry, size, and trading activity over the selected period.</p>
      </div>
      {isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Peers didn't load" />
      ) : !data.peers.length ? (
        <EmptyState icon={Users} title="No similar stocks found" />
      ) : wide ? (
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">Similar stocks</caption>
            <thead>
              <tr className="border-b border-line-subtle text-xs text-fg-muted">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Stock
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium whitespace-nowrap">
                  Market cap
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium whitespace-nowrap">
                  Value traded
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium whitespace-nowrap">
                  % Change
                </th>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Match
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {data.peers.map((p) => (
                <tr key={p.symbol} className="hover:bg-hover">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    <div className="-ml-2 flex items-center gap-1">
                      <WatchStar symbol={p.symbol} />
                      <Link to={`/app/stocks/${p.symbol}`} className="hover:text-brand">
                        <span className="num block font-medium text-fg">{p.symbol}</span>
                        <span className="block text-xs text-fg-muted">
                          {p.company} · {p.subsector}
                        </span>
                      </Link>
                    </div>
                  </th>
                  <td className="num px-4 py-2 text-right text-fg">{money(p.market_cap)}</td>
                  <td className="num px-4 py-2 text-right text-fg">{money(p.traded_value)}</td>
                  <td className="px-4 py-2 text-right">
                    <PriceChange pct={pct.get(p.symbol) ?? null} />
                  </td>
                  <td className="px-4 py-2">
                    <Match value={p.scores.overall} />
                    <Breakdown peer={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.peers.map((p) => (
            <li key={p.symbol} className="relative">
              <WatchStar symbol={p.symbol} className="absolute top-1.5 right-1.5" />
              <Link
                to={`/app/stocks/${p.symbol}`}
                className="flex flex-col gap-1.5 rounded-md border border-line-subtle p-3 pr-12 hover:bg-hover"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="num font-medium text-fg">{p.symbol}</span>
                  <Match value={p.scores.overall} />
                </span>
                <span className="text-xs text-fg-muted">
                  {p.company} · {p.subsector}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 text-xs text-fg-2">
                  <span>Cap {money(p.market_cap)}</span>
                  <span>Traded {money(p.traded_value)}</span>
                  <PriceChange pct={pct.get(p.symbol) ?? null} />
                </span>
                <Breakdown peer={p} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
