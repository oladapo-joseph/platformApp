/**
 * News (US-9.8): every headline the crawler has kept (90 days), newest or most important first,
 * filterable by stock, sector, topic, scope, regulator, type, source and date. A left rail on
 * desktop; on phones, topic chips above the list and the rest in a bottom sheet. All in the URL.
 */
import { Newspaper, Search, SlidersHorizontal, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";

import { useNews, useNewsCount } from "@/api/news";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/controls";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { NewsItem } from "@/components/ui/NewsItem";
import { cn } from "@/lib/cn";
import { useDebounced, useMediaQuery } from "@/lib/hooks";
import {
  activeChips,
  CLEARED,
  mostRestrictive,
  TOPICS,
  withoutChip,
  withoutRestriction,
  writeNewsParams,
  type NewsFilters,
  type Topic,
} from "@/lib/news";

import { NewsFilterControls, RemoveChip } from "./NewsFilters";
import { useNewsParams } from "./useNewsParams";

const SORTS = [
  { value: "recent" as const, label: "Newest" },
  { value: "importance" as const, label: "Most important" },
];

const plural = (n: number) => `${n.toLocaleString("en-NG")} article${n === 1 ? "" : "s"}`;

function SearchBox({
  filters,
  set,
}: {
  filters: NewsFilters;
  set: (f: NewsFilters, o?: { replace?: boolean }) => void;
}) {
  const [draft, setDraft] = useState(filters.q);
  const settled = useDebounced(draft, 350);
  // a chip, "Clear all" or Back changed the search: follow the URL (our own writes match `settled`)
  const [seen, setSeen] = useState(filters.q);
  if (filters.q !== seen) {
    setSeen(filters.q);
    if (filters.q.trim() !== settled.trim()) setDraft(filters.q);
  }
  useEffect(() => {
    if (settled.trim() !== filters.q.trim()) set({ ...filters, q: settled }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a settled draft writes the URL
  }, [settled]);
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-sm">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
      />
      <label htmlFor="news-q" className="sr-only">
        Search headlines
      </label>
      <input
        id="news-q"
        type="search"
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Search headlines"
        className="touch-target h-10 w-full rounded-xl border border-line-input bg-surface pr-3 pl-9 text-base text-fg shadow-elev-1 placeholder:text-fg-muted"
      />
    </div>
  );
}

/** Phones: the filters in a bottom sheet, applied together with a live result count. */
function FilterSheet({ filters, set }: { filters: NewsFilters; set: (f: NewsFilters) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(filters);
  const count = useNewsCount(pending, open);
  const active = activeChips(filters).filter((c) => c.key !== "q").length;
  const total = count.data?.total;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (o) setPending(filters);
        setOpen(o);
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="secondary" icon={<SlidersHorizontal aria-hidden className="size-4" />}>
          Filters{active > 0 && <span className="num text-brand">({active})</span>}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-canvas/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[85dvh] flex-col rounded-t-xl border-t border-line bg-raised shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line-subtle px-4 py-2">
            <Dialog.Title className="text-base font-semibold text-fg">Filter news</Dialog.Title>
            <Dialog.Close
              aria-label="Close filters"
              className="touch-target flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-4">
            <NewsFilterControls filters={pending} facets={count.data?.facets} onChange={setPending} />
          </div>
          <div className="flex gap-3 border-t border-line-subtle px-4 py-3">
            <Button variant="ghost" onClick={() => setPending({ ...CLEARED, sort: pending.sort })}>
              Clear all
            </Button>
            <Button
              className="flex-1"
              loading={count.isFetching && total === undefined}
              onClick={() => {
                set(pending);
                setOpen(false);
              }}
            >
              {total === undefined || total === null ? "Apply" : `Apply (${plural(total)})`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Phones: the most-used filter one tap away (US-9.8 UX notes). */
function TopicChips({
  filters,
  set,
  counts,
}: {
  filters: NewsFilters;
  set: (f: NewsFilters) => void;
  counts: Map<string, number>;
}) {
  const toggle = (t: Topic) =>
    set({
      ...filters,
      topic: filters.topic.includes(t) ? filters.topic.filter((x) => x !== t) : [...filters.topic, t],
    });
  const ordered = [...TOPICS].sort((a, b) => (counts.get(b.value) ?? 0) - (counts.get(a.value) ?? 0));
  return (
    <div role="group" aria-label="Topics" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {ordered
        .filter((t) => filters.topic.includes(t.value) || counts.get(t.value))
        .map((t) => {
          const on = filters.topic.includes(t.value);
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.value)}
              className={cn(
                "touch-target h-8 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap",
                on ? "border-brand bg-brand-subtle text-fg" : "border-line text-fg-2 hover:border-line-input",
              )}
            >
              {t.label}
            </button>
          );
        })}
    </div>
  );
}

export default function NewsPage() {
  const { filters, set } = useNewsParams();
  const wide = useMediaQuery("(min-width: 1024px)");
  const news = useNews(filters);
  const first = news.data?.pages[0];
  const facets = first?.facets;
  const items = news.data?.pages.flatMap((p) => p.items) ?? [];
  const chips = activeChips(filters);
  const total = first?.total ?? null;
  const topicCounts = new Map((facets?.topics ?? []).map((c) => [c.value, c.count]));
  const addTopic = (t: string) => {
    const next = { ...filters, topic: [...new Set([...filters.topic, t as Topic])] };
    return `?${writeNewsParams(next).toString()}`;
  };
  const restrictive = !news.isPending && !items.length ? mostRestrictive(filters, facets) : null;

  const list = news.isPending ? (
    <div aria-busy className="flex flex-col gap-6 py-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  ) : news.error && !items.length ? (
    <ErrorState error={news.error} onRetry={() => void news.refetch()} title="News didn't load" />
  ) : !items.length ? (
    <EmptyState
      icon={Newspaper}
      title="No news matches these filters"
      action={
        restrictive ? (
          <Button variant="secondary" onClick={() => set(withoutRestriction(filters, restrictive))}>
            {restrictive.key === "q" ? "Clear the search" : `Remove “${restrictive.label}”`}
          </Button>
        ) : undefined
      }
    >
      {restrictive && chips.length > 1 ? (
        <>
          {restrictive.key === "q" ? `The search ${restrictive.label}` : `“${restrictive.label}”`} narrows it the most.
        </>
      ) : (
        "Try a wider date range or fewer filters."
      )}
    </EmptyState>
  ) : (
    <>
      <ul
        aria-busy={news.isPlaceholderData || undefined}
        className={cn("divide-y divide-line-subtle", news.isPlaceholderData && "opacity-60")}
      >
        {items.map((a) => (
          <li key={a.id}>
            <NewsItem article={a} topicHref={addTopic} />
          </li>
        ))}
      </ul>
      {news.hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button variant="secondary" loading={news.isFetchingNextPage} onClick={() => void news.fetchNextPage()}>
            Show more news
          </Button>
        </div>
      )}
      {news.error && items.length > 0 && (
        <p role="alert" className="pt-3 text-center text-sm text-danger">
          More news didn't load.{" "}
          <button type="button" className="font-medium underline" onClick={() => void news.fetchNextPage()}>
            Try again
          </button>
        </p>
      )}
    </>
  );

  return (
    <>
      <PageHeader title="News" description="Nigerian market and company headlines from the last 90 days." />
      <div className="flex gap-8">
        {wide && (
          <aside aria-labelledby="news-filters" className="w-72 shrink-0">
            <Card className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto px-4 pt-4 pb-2">
              <h2 id="news-filters" className="eyebrow pb-1 text-fg-muted">
                Filters
              </h2>
              <NewsFilterControls filters={filters} facets={facets} onChange={(f) => set(f)} />
            </Card>
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchBox filters={filters} set={set} />
            {!wide && <FilterSheet filters={filters} set={(f) => set(f)} />}
            <SegmentedControl
              label="Order"
              value={filters.sort}
              onChange={(sort) => set({ ...filters, sort })}
              options={SORTS}
              className="ml-auto"
            />
          </div>
          {!wide && <TopicChips filters={filters} set={(f) => set(f)} counts={topicCounts} />}
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <RemoveChip key={`${c.key}:${c.value}`} label={c.label} onRemove={() => set(withoutChip(filters, c))} />
              ))}
              <button
                type="button"
                onClick={() => set({ ...CLEARED, sort: filters.sort })}
                className="touch-target px-2 text-sm font-medium text-brand hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
          <p role="status" className="text-sm text-fg-2">
            {news.isPlaceholderData ? (
              "Updating…"
            ) : total !== null && !news.isPending ? (
              <>
                {plural(total)}
                {filters.type.length === 0 && " · opinion hidden"}
              </>
            ) : null}
          </p>
          <Card className="px-4">
            <h2 className="sr-only">Articles</h2>
            {list}
          </Card>
        </div>
      </div>
    </>
  );
}
