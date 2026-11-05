/** Ticker, company, last price and change, Compare, Share, and the key-stats row (US-3.2, US-3.9, US-3.10). Freshness is in the top bar. */
import { GitCompareArrows, Share2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import type { Bar, StockProfile } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/buttonClass";
import { Card } from "@/components/ui/feedback";
import { PriceChange } from "@/components/ui/market";
import { WatchStar } from "@/components/ui/WatchStar";
import { money, price, volume } from "@/lib/format";
import { sectorName } from "@/lib/sectors";
import { yearRange } from "@/lib/stock";
import { track } from "@/lib/analytics";

async function share(symbol: string, company: string, toast: (m: string) => void) {
  const url = window.location.href;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: `${symbol} · ${company} · EquityLensNG`, url });
      return;
    } catch {
      /* cancelled, or not allowed: fall back to copying */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    toast("Copy the address bar to share this view");
  }
}

export function StockHeader({
  profile,
  yearBars,
  toast,
}: {
  profile: StockProfile;
  yearBars: Bar[];
  toast: (m: string) => void;
}) {
  const q = profile.quote;
  const year = yearRange(yearBars);
  const [more, setMore] = useState(false);
  const stats: [string, string][] = [
    ["Previous close", price(q?.prev_close)],
    ["Day range", q?.low != null && q.high != null ? `${price(q.low)} – ${price(q.high)}` : "—"],
    ["Volume", volume(q?.volume)],
    ["Value", money(q?.value)],
    ["Deals", q?.trades != null ? q.trades.toLocaleString("en-NG") : "—"],
    ["Market cap", money(profile.market_cap)],
    ["52-week range", year ? `${price(year.low)} – ${price(year.high)}` : "—"],
  ];

  return (
    <Card className="mb-6 flex flex-col gap-5 rounded-xl p-6 shadow-elev-2 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-fg-muted">
            {sectorName(profile.sector)}
            {profile.subsector ? ` · ${profile.subsector}` : ""}
          </p>
          <h1 className="num mt-2 text-3xl font-semibold tracking-tight text-fg md:text-4xl">{profile.symbol}</h1>
          <p className="mt-1 font-headline text-xl font-semibold text-fg-2 md:text-2xl">{profile.company}</p>
        </div>
        <div className="flex items-center gap-2">
          <WatchStar symbol={profile.symbol} label="Watchlist" />
          <Link
            to={`/app/stocks/compare?symbols=${encodeURIComponent(profile.symbol)}`}
            onClick={() => track("compare.open", { from: "stock", symbol: profile.symbol })}
            className={buttonClass("secondary", "sm")}
          >
            <GitCompareArrows aria-hidden className="size-4" />
            Compare
          </Link>
          <Button
            variant="secondary"
            size="sm"
            icon={<Share2 aria-hidden className="size-4" />}
            onClick={() => {
              track("stock.share", { symbol: profile.symbol });
              void share(profile.symbol, profile.company, toast);
            }}
          >
            Share
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <p className="num text-4xl font-medium text-fg md:text-5xl">{price(q?.close)}</p>
        <PriceChange abs={q?.change} pct={q?.pct_change} variant="solid" className="mb-1.5 text-sm" />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line-subtle pt-4 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map(([label, value], i) => (
          <div key={label} className={i >= 4 && !more ? "max-sm:hidden" : undefined}>
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className="num text-sm text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        className="self-start text-sm font-medium text-brand underline-offset-2 hover:underline sm:hidden"
      >
        {more ? "Show fewer stats" : "Show more stats"}
      </button>
    </Card>
  );
}
