import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, parseISO, subDays } from "date-fns";

import { api } from "./client";
import type { Article, DirectoryEntry, MarketStatus, RangeSummary, Snapshot } from "./types";

const FIVE_MIN = 5 * 60_000;

/** Freshness for the top bar: public, cheap, refreshed every 5 minutes. */
export function useMarketStatus() {
  return useQuery({
    queryKey: ["market", "status"],
    queryFn: ({ signal }) => api<MarketStatus>("/market/status", { signal }),
    staleTime: 60_000,
    refetchInterval: FIVE_MIN,
  });
}

/** One session (the latest by default). Refreshes in the background while the market is open. */
export function useSnapshot(date?: string | null) {
  const { data: status } = useMarketStatus();
  return useQuery({
    queryKey: ["market", "snapshot", date ?? "latest"],
    queryFn: ({ signal }) => api<Snapshot>("/market/snapshot", { query: { date }, signal }),
    refetchInterval: !date && status?.is_trading_hours ? FIVE_MIN : false,
    placeholderData: keepPreviousData,
  });
}

/** The session before `tradeDate` (the API steps back over weekends and holidays). */
export function usePreviousSnapshot(tradeDate: string | undefined) {
  const before = tradeDate ? format(subDays(parseISO(tradeDate), 1), "yyyy-MM-dd") : null;
  return useQuery({
    queryKey: ["market", "snapshot", before],
    queryFn: ({ signal }) => api<Snapshot>("/market/snapshot", { query: { date: before }, signal }),
    enabled: !!before,
    staleTime: Infinity, // a past session never changes
  });
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
export function useTopStories(sector: string | null) {
  return useQuery({
    queryKey: ["news", "top", sector],
    queryFn: async ({ signal }) => {
      const recent = await api<Article[]>("/news/top", { query: { hours: 48, limit: 5, sector }, signal });
      if (recent.length) return { articles: recent, older: false };
      const week = await api<Article[]>("/news/top", { query: { hours: 168, limit: 5, sector }, signal });
      return { articles: week, older: true };
    },
    staleTime: FIVE_MIN,
  });
}
