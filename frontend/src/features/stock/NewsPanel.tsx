/**
 * News for one stock (US-9.1): "About" (named in the headline), "Mentions" (body only), then
 * sector news, so it's always clear how strongly each item relates to the company.
 */
import { useState } from "react";
import { Link } from "react-router";

import { useStockNews } from "@/api/stock";
import type { Article } from "@/api/types";
import { SegmentedControl } from "@/components/ui/controls";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { NewsItem } from "@/components/ui/NewsItem";
import { sectorName } from "@/lib/sectors";

function Group({ title, articles, symbol }: { title: string; articles: Article[]; symbol: string }) {
  if (!articles.length) return null;
  return (
    <section className="mt-3">
      <h3 className="eyebrow text-fg-muted">{title}</h3>
      <div className="divide-y divide-line-subtle">
        {articles.map((a) => (
          <NewsItem key={a.id} article={a} topicsFor={symbol} />
        ))}
      </div>
    </section>
  );
}

export function NewsPanel({ symbol, sector, heading = true }: { symbol: string; sector: string; heading?: boolean }) {
  const [sort, setSort] = useState<"recent" | "importance">("recent");
  const { data, isPending, error, refetch } = useStockNews(symbol, sort);
  const about = data?.mentions.filter((a) => a.match === "title") ?? [];
  const mentions = data?.mentions.filter((a) => a.match !== "title") ?? [];
  const sectorNews = data?.sector ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {heading && <h2 className="text-lg font-medium text-fg">News</h2>}
        <SegmentedControl
          label="Sort news"
          size="sm"
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Newest" },
            { value: "importance", label: "Most important" },
          ]}
        />
      </div>
      {isPending ? (
        <div aria-busy className="mt-3 flex flex-col gap-4">
          <span className="sr-only">Loading news</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="News didn't load" />
      ) : (
        <>
          {!about.length && !mentions.length && (
            <p className="mt-3 text-sm text-fg-2">
              {sectorNews.length ? `No recent news mentioning ${symbol}.` : "No recent news."}
            </p>
          )}
          <Group title={`About ${symbol}`} articles={about} symbol={symbol} />
          <Group title={`Mentions ${symbol}`} articles={mentions} symbol={symbol} />
          <Group title={`Sector news · ${sectorName(sector)}`} articles={sectorNews} symbol={symbol} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-fg-muted">News is collected automatically and may be incomplete.</p>
            <Link
              to={`/app/news?symbol=${encodeURIComponent(symbol)}`}
              className="text-sm font-medium whitespace-nowrap text-brand underline-offset-2 hover:underline"
            >
              See all news
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
