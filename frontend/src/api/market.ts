import { keepPreviousData, queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { format, parseISO, subDays } from "date-fns";

import { api } from "./client";
import type { Article, DirectoryEntry, MarketHistory, MarketStatus, RangeSummary, Snapshot } from "./types";

const FIVE_MIN = 5 * 60_000;

// Query definitions are shared by the hooks and the router's prefetch (app/router.tsx).

export const statusQuery = queryOptions({
  queryKey: ["market", "status"],
  queryFn: ({ signal }) => api<MarketStatus>("/market/status", { signal }),
  staleTime: 60_000,
});

export const snapshotQuery = (date?: string | null) =>
  queryOptions({
    queryKey: ["market", "snapshot", date ?? "latest"],
    queryFn: ({ signal }) => api<Snapshot>("/market/snapshot", { query: { date }, signal }),
  });

/** The session before `tradeDate` (the API steps back over weekends and holidays). */
export const previousSnapshotQuery = (tradeDate: string | undefined) => {
  const before = tradeDate ? format(subDays(parseISO(tradeDate), 1), "yyyy-MM-dd") : null;
  return queryOptions({
    queryKey: ["market", "snapshot", before],
    queryFn: before
      ? ({ signal }) => api<Snapshot>("/market/snapshot", { query: { date: before }, signal })
      : skipToken,
    staleTime: Infinity, // a past session never changes
  });
};

export const historyQuery = (days: number) =>
  queryOptions({
    queryKey: ["market", "history", days],
    queryFn: ({ signal }) => api<MarketHistory>("/market/history", { query: { days }, signal }),
    staleTime: FIVE_MIN,
  });

/** Freshness for the top bar: public, cheap, refreshed every 5 minutes. */
export function useMarketStatus() {
  return useQuery({ ...statusQuery, refetchInterval: FIVE_MIN });
}

/** One session (the latest by default). Refreshes in the background while the market is open. */
export function useSnapshot(date?: string | null) {
  const { data: status } = useMarketStatus();
  return useQuery({
    ...snapshotQuery(date),
    refetchInterval: !date && status?.is_trading_hours ? FIVE_MIN : false,
    placeholderData: keepPreviousData,
  });
}

export function usePreviousSnapshot(tradeDate: string | undefined) {
  return useQuery(previousSnapshotQuery(tradeDate));
}

/** Totals for the last sessions, oldest first: the tiles' sparklines (US-2.1). */
export function useMarketHistory(days = 20) {
  return useQuery(historyQuery(days));
}

export function useRange(start: string | null, end: string | null) {
  return useQuery({
    queryKey: ["market", "range", start, end],
    queryFn: ({ signal }) => api<RangeSummary>("/market/range", { query: { start, end }, signal }),
    enabled: !!start && !!end,
    placeholderData: keepPreviousData,
  });
}

/** Every listed stock (ticker, company, sector): cached for an hour so search is instant (US-3.1). */
export function useDirectory() {
  return useQuery({
    queryKey: ["stocks", "directory"],
    queryFn: ({ signal }) => api<DirectoryEntry[]>("/stocks", { signal }),
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
  });
}

/** Top stories by importance (US-9.3): the last 48 h, else the last week with dates shown. */
export const topStoriesQuery = (sector: string | null) =>
  queryOptions({
    queryKey: ["news", "top", sector],
    queryFn: async ({ signal }) => {
      const recent = await api<Article[]>("/news/top", { query: { hours: 48, limit: 5, sector }, signal });
      if (recent.length) return { articles: recent, older: false };
      const week = await api<Article[]>("/news/top", { query: { hours: 168, limit: 5, sector }, signal });
      return { articles: week, older: true };
    },
    staleTime: FIVE_MIN,
  });

export function useTopStories(sector: string | null) {
  return useQuery(topStoriesQuery(sector));
}
