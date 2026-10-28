/** Top gainers, losers and most traded (US-2.2): side by side on desktop, tabs on phones. */
import { useState } from "react";
import { Link } from "react-router";

import { Tabs } from "@/components/ui/controls";
import { Card } from "@/components/ui/feedback";
import { PriceChange } from "@/components/ui/market";
import { money, price } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import type { MarketRow } from "@/lib/market";

type ListKey = "gainers" | "losers" | "mostTraded";

const LISTS: { key: ListKey; title: string; sort: string; empty: string }[] = [
  { key: "gainers", title: "Top gainers", sort: "-pct", empty: "No stocks rose." },
  { key: "losers", title: "Top losers", sort: "pct", empty: "No losers: no traded stock fell." },
  { key: "mostTraded", title: "Most traded", sort: "-value", empty: "Nothing traded." },
];

function MoverRows({ rows, byValue, empty }: { rows: MarketRow[]; byValue: boolean; empty: string }) {
  if (!rows.length) return <p className="px-1 py-6 text-center text-sm text-fg-2">{empty}</p>;
  return (
    <ol className="divide-y divide-line-subtle">
      {rows.map((r) => (
        <li key={r.symbol}>
          <Link
            to={`/app/stocks/${r.symbol}`}
            className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-hover"
          >
            <span className="min-w-0 flex-1">
              <span className="num block text-sm font-medium text-fg">{r.symbol}</span>
              <span className="block truncate text-xs text-fg-muted" title={r.company}>
                {r.company}
              </span>
            </span>
            <span className="flex flex-col items-end gap-0.5">
              {byValue ? (
                <span className="num text-sm text-fg">{money(r.value)}</span>
              ) : (
                <span className="num text-sm text-fg">{price(r.close)}</span>
              )}
              {byValue ? (
                <PriceChange pct={r.pct} className="text-xs" />
              ) : (
                <span className="flex items-center gap-2 text-xs">
                  <span className="num text-fg-muted">{money(r.value)}</span>
                  <PriceChange pct={r.pct} />
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function Movers({
  lists,
  hrefWith,
  period,
}: {
  lists: Record<ListKey, MarketRow[]>;
  hrefWith: (patch: Record<string, string | null>) => string;
  period: boolean;
}) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const [tab, setTab] = useState<ListKey>("gainers");
  const seeAll = (sort: string) => (
    <Link
      to={{ search: hrefWith({ sort }), hash: "all-stocks" }}
      preventScrollReset
      className="text-sm font-medium whitespace-nowrap text-brand underline-offset-2 hover:underline"
    >
      See all
    </Link>
  );
  const footnote = (
    <p className="mt-2 text-xs text-fg-muted">
      Gainers and losers only include stocks that traded{period ? " in the period" : " today"}.
    </p>
  );

  if (!wide) {
    const activeSort = LISTS.find((l) => l.key === tab)?.sort ?? "-pct";
    return (
      <section aria-labelledby="movers-title">
        <h2 id="movers-title" className="sr-only">
          Movers
        </h2>
        <Card className="p-4">
          <Tabs
            label="Movers"
            value={tab}
            onChange={setTab}
            tabs={LISTS.map((l) => ({
              value: l.key,
              label: l.key === "gainers" ? "Gainers" : l.key === "losers" ? "Losers" : "Most traded",
              content: <MoverRows rows={lists[l.key]} byValue={l.key === "mostTraded"} empty={l.empty} />,
            }))}
          />
          <div className="mt-2 flex items-start justify-between gap-3">
            {footnote}
            {seeAll(activeSort)}
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="movers-title">
      <h2 id="movers-title" className="sr-only">
        Movers
      </h2>
      <div className="grid grid-cols-3 gap-4">
        {LISTS.map((l) => (
          <Card key={l.key} className="p-4">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-lg font-medium text-fg">{l.title}</h3>
              {seeAll(l.sort)}
            </div>
            <MoverRows rows={lists[l.key]} byValue={l.key === "mostTraded"} empty={l.empty} />
          </Card>
        ))}
      </div>
      {footnote}
    </section>
  );
}
