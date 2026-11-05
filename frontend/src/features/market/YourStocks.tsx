/** "Your stocks" (US-5.3): my watchlist first on Market, as compact cards that scroll sideways. */
import { useMemo } from "react";
import { Link } from "react-router";

import { useWatchlist } from "@/api/watchlist";
import { PriceChange } from "@/components/ui/market";
import { price } from "@/lib/format";
import type { MarketRow } from "@/lib/market";

export function YourStocks({ rows }: { rows: MarketRow[] }) {
  const { data } = useWatchlist();
  const mine = useMemo(() => {
    const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
    // a stock that didn't trade in this session or period has no row to show
    return (data?.symbols ?? []).flatMap((s) => bySymbol.get(s) ?? []);
  }, [rows, data]);
  if (!mine.length) return null;
  return (
    <section aria-labelledby="your-stocks">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="your-stocks" className="font-headline text-xl font-semibold text-fg">
          Your stocks
        </h2>
        <Link to="/app/watchlist" className="text-sm font-medium text-brand underline-offset-2 hover:underline">
          Watchlist
        </Link>
      </div>
      <ul className="relative -mx-4 flex gap-3 overflow-x-auto px-4 pt-1 pb-3 md:-mx-1 md:px-1">
        {mine.map((r) => (
          <li key={r.symbol} className="shrink-0">
            <Link
              to={`/app/stocks/${r.symbol}`}
              className="flex w-40 flex-col gap-1 rounded-lg border border-transparent bg-surface p-3 shadow-elev-1 transition-colors duration-(--duration-instant) hover:bg-hover"
            >
              <span className="num font-semibold text-fg">{r.symbol}</span>
              <span className="truncate text-xs text-fg-muted" title={r.company}>
                {r.company}
              </span>
              <span className="num mt-1 text-sm text-fg">{price(r.close)}</span>
              <PriceChange pct={r.pct} variant="solid" className="self-start text-xs" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
