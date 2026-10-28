import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, parseISO, subYears } from "date-fns";

import { api } from "./client";
import type {
  BarsResponse,
  IndicatorsResponse,
  SignalsResponse,
  SimilarResponse,
  StockNews,
  StockProfile,
  StrategyInfo,
} from "./types";

type Range = { start: string | null; end: string | null };

export function useProfile(symbol: string) {
  return useQuery({
    queryKey: ["stock", symbol, "profile"],
    queryFn: ({ signal }) => api<StockProfile>(`/stocks/${encodeURIComponent(symbol)}`, { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useBars(symbol: string, { start, end }: Range, enabled = true) {
  return useQuery({
    queryKey: ["stock", symbol, "bars", start, end],
    queryFn: ({ signal }) =>
      api<BarsResponse>(`/stocks/${encodeURIComponent(symbol)}/bars`, { query: { start, end }, signal }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** The last year of bars, for the 52-week range in the key stats. */
export function useYearBars(symbol: string, latest: string | null | undefined) {
  const start = latest ? format(subYears(parseISO(latest), 1), "yyyy-MM-dd") : null;
  return useBars(symbol, { start, end: latest ?? null }, !!latest);
}

/** Indicators are computed on full history server-side, then sliced, so short ranges have no warm-up gap (ADR-009). */
export function useIndicators(symbol: string, set: string, { start, end }: Range, enabled = true) {
  return useQuery({
    queryKey: ["stock", symbol, "indicators", set, start, end],
    queryFn: ({ signal }) =>
      api<IndicatorsResponse>(`/stocks/${encodeURIComponent(symbol)}/indicators`, {
        query: { set, start, end },
        signal,
      }),
    enabled: enabled && set.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useSignals(symbol: string, strategy: string, { start, end }: Range, enabled = true) {
  return useQuery({
    queryKey: ["stock", symbol, "signals", strategy, start, end],
    queryFn: ({ signal }) =>
      api<SignalsResponse>(`/stocks/${encodeURIComponent(symbol)}/signals`, {
        query: { strategy, start, end },
        signal,
      }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: ({ signal }) => api<StrategyInfo[]>("/strategies", { signal }),
    staleTime: Infinity,
  });
}

export function useStockNews(symbol: string, sort: "recent" | "importance") {
  return useQuery({
    queryKey: ["stock", symbol, "news", sort],
    queryFn: ({ signal }) =>
      api<StockNews>(`/stocks/${encodeURIComponent(symbol)}/news`, { query: { days: 30, limit: 5, sort }, signal }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export type PeerSort = "overall" | "industry" | "market_cap" | "traded_value";

export function useSimilar(symbol: string, start: string | null, end: string | null, sort: PeerSort) {
  return useQuery({
    queryKey: ["stock", symbol, "similar", start, end, sort],
    queryFn: ({ signal }) =>
      api<SimilarResponse>(`/stocks/${encodeURIComponent(symbol)}/similar`, { query: { start, end, sort }, signal }),
    enabled: !!start && !!end,
    placeholderData: keepPreviousData,
  });
}
