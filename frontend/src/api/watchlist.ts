import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/lib/analytics";
import { notify } from "@/lib/notify";

import { ApiError, api } from "./client";
import type { Watchlist, WatchlistNews, WatchlistOverview, WatchlistPeriod } from "./types";

const FIVE_MIN = 5 * 60_000;
export const watchlistKey = ["watchlist"] as const;
const SET_KEY = ["watchlist", "set"] as const;

/** My watchlist's symbols: every ☆ reads this one query (US-5.1). */
export const watchlistQuery = queryOptions({
  queryKey: watchlistKey,
  queryFn: ({ signal }) => api<Watchlist>("/me/watchlist", { signal }),
  staleTime: FIVE_MIN,
});

export function useWatchlist() {
  return useQuery(watchlistQuery);
}

export const watchlistOverviewQuery = (period: WatchlistPeriod, strategy?: string) =>
  queryOptions({
    queryKey: ["watchlist", "overview", period, strategy ?? null],
    queryFn: ({ signal }) => api<WatchlistOverview>("/me/watchlist/overview", { query: { period, strategy }, signal }),
  });

/** Price, day and period change, trend and latest signal for each stock (US-5.2). */
export function useWatchlistOverview(period: WatchlistPeriod, strategy?: string) {
  return useQuery({ ...watchlistOverviewQuery(period, strategy), placeholderData: keepPreviousData });
}

/** News mentioning any of my stocks in the last 7 days (US-9.4). */
export function useWatchlistNews(enabled = true) {
  return useQuery({
    queryKey: ["watchlist", "news"],
    queryFn: ({ signal }) => api<WatchlistNews>("/me/watchlist/news", { query: { days: 7 }, signal }),
    staleTime: FIVE_MIN,
    enabled,
  });
}

function failed(error: unknown, symbol: string) {
  notify(
    error instanceof ApiError && error.slug === "watchlist-full"
      ? error.detail
      : `Couldn't update your watchlist for ${symbol}. Try again.`,
    { tone: "error" },
  );
}

/**
 * Add (`on`) or remove one stock, optimistically: the list changes at once and goes back, with a
 * message, if the server refuses. The message shows even if the caller has gone (a removed row).
 */
export function useSetWatched() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: SET_KEY,
    mutationFn: ({ symbol, on }: { symbol: string; on: boolean }) =>
      api<Watchlist>(`/me/watchlist/${encodeURIComponent(symbol)}`, {
        method: on ? "PUT" : "DELETE",
        keepalive: true,
      }),
    onMutate: async ({ symbol, on }) => {
      track(on ? "watchlist.add" : "watchlist.remove", { symbol });
      await qc.cancelQueries({ queryKey: watchlistKey, exact: true });
      const before = qc.getQueryData<Watchlist>(watchlistKey);
      if (before) {
        const rest = before.symbols.filter((s) => s !== symbol);
        qc.setQueryData<Watchlist>(watchlistKey, { ...before, symbols: on ? [...rest, symbol] : rest });
      }
      return { before };
    },
    onError: (error, { symbol }, ctx) => {
      if (ctx?.before) qc.setQueryData(watchlistKey, ctx.before);
      failed(error, symbol);
    },
    onSettled: () => {
      // after a burst of toggles, read the server's list once (an earlier reply would undo a later star)
      if (qc.isMutating({ mutationKey: SET_KEY }) === 1) void qc.invalidateQueries({ queryKey: watchlistKey });
    },
  });
}
