/** Top stories (US-9.3): the 5 most important of the last 48 h, filtered by the selected sector. */
import { Link } from "react-router";

import { useTopStories } from "@/api/market";
import { Card, ErrorState, Skeleton } from "@/components/ui/feedback";
import { NewsItem } from "@/components/ui/NewsItem";

import { sectorName } from "@/lib/sectors";

export function TopStories({ sector }: { sector: string | null }) {
  const { data, isPending, error, refetch } = useTopStories(sector);
  if (!isPending && !error && data.articles.length === 0 && !sector) return null; // nothing in a week: hide
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-headline text-xl font-semibold text-fg">Top stories</h2>
        <Link to="/app/news" className="text-sm font-medium text-brand underline-offset-2 hover:underline">
          All news
        </Link>
      </div>
      {sector && <p className="text-xs text-fg-muted">{sectorName(sector)} only</p>}
      {isPending ? (
        <div aria-busy className="mt-3 flex flex-col gap-4">
          <span className="sr-only">Loading stories</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Stories didn't load" />
      ) : data.articles.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-2">No {sectorName(sector ?? "")} stories this week.</p>
      ) : (
        <>
          {data.older && (
            <p className="mt-1 text-xs text-fg-muted">Nothing new in 48 hours: the latest from this week.</p>
          )}
          {data.articles[0] && (
            <div className="mt-3 rounded-lg bg-selected px-4">
              <NewsItem article={data.articles[0]} showDate={data.older} lead />
            </div>
          )}
          <div className="divide-y divide-line-subtle">
            {data.articles.slice(1).map((a) => (
              <NewsItem key={a.id} article={a} showDate={data.older} />
            ))}
          </div>
          <p className="mt-2 text-xs text-fg-muted">News is collected automatically and may be incomplete.</p>
        </>
      )}
    </Card>
  );
}
