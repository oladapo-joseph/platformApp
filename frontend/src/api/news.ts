import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { newsQuery, type NewsFilters } from "@/lib/news";

import { api } from "./client";
import type { NewsPage } from "./types";

const PAGE = 20;

/** The News page list (US-9.8): 20 at a time; facets and the total come with the first page. */
export function useNews(filters: NewsFilters) {
  const query = newsQuery(filters);
  return useInfiniteQuery({
    queryKey: ["news", "page", query],
    queryFn: ({ pageParam, signal }) =>
      api<NewsPage>("/news", { query: { ...query, limit: PAGE, cursor: pageParam }, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

/** Facets and the total for filters not applied yet: the phone filter sheet's "Apply (23 results)". */
export function useNewsCount(filters: NewsFilters, enabled: boolean) {
  const query = newsQuery(filters);
  return useQuery({
    queryKey: ["news", "count", query],
    queryFn: ({ signal }) => api<NewsPage>("/news", { query: { ...query, limit: 1 }, signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
