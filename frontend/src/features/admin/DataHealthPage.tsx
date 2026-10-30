/** Data health (US-7.6): is the crawler running, and is the market data complete? */
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { useDataHealth } from "@/api/admin";
import { Banner, ErrorState, Skeleton } from "@/components/ui/feedback";
import { day, weekday } from "@/lib/dates";

import { Section, When } from "./shared";

export default function DataHealthPage() {
  const health = useDataHealth();
  if (health.isPending) return <Skeleton className="h-72" />;
  if (health.error)
    return <ErrorState error={health.error} onRetry={() => void health.refetch()} title="Data health didn't load" />;
  const h = health.data;
  const facts: [string, ReactNode][] = [
    ["Last crawl (tradesData)", <When key="f" value={h.last_fetch_at} />],
    ["Last daily_bars update", <When key="b" value={h.last_bars_update_at} />],
    ["Latest session", h.latest_trade_date ? day(h.latest_trade_date) : "—"],
    ["Market now", h.trading_hours ? "Open (10:00–14:30 WAT)" : "Closed"],
  ];
  return (
    <div className="flex flex-col gap-6">
      {h.stale ? (
        <Banner tone="danger" title="The data is stale">
          The market is open and the newest crawl is more than 2 hours old. Check the ngxPro crawler.
        </Banner>
      ) : (
        <p role="status" className="flex items-center gap-2 text-sm text-fg-2">
          <CircleCheck aria-hidden className="size-4 text-gain" />
          {h.trading_hours
            ? "The crawler is keeping up."
            : "The market is closed; nothing to crawl until the next session."}
        </p>
      )}
      <Section title="Freshness">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-fg-muted">{k}</dt>
              <dd className="mt-0.5 text-fg">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section
        title="Stocks without a price in the latest session"
        description={`${h.missing_symbols.length} of ${h.listed} listed. Thinly traded stocks often have none.`}
      >
        {h.missing_symbols.length ? (
          <details>
            <summary className="cursor-pointer text-sm text-fg-2">Show the {h.missing_symbols.length} tickers</summary>
            <p className="num mt-2 text-sm leading-relaxed text-fg">{h.missing_symbols.join(" · ")}</p>
          </details>
        ) : (
          <p className="text-sm text-fg-2">Every listed stock has a price.</p>
        )}
      </Section>
      <Section title="Weekdays without data (last 30 days)" description="Public holidays show here too.">
        {h.missing_sessions.length ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {h.missing_sessions.map((d) => (
              <li key={d} className="flex items-center gap-1 rounded-md bg-warning-subtle px-2 py-1 text-fg">
                <TriangleAlert aria-hidden className="size-3.5 text-warning" />
                {weekday(d)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-2">Every weekday has data.</p>
        )}
      </Section>
    </div>
  );
}
