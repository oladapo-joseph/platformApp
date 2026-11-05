import { keepPreviousData, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/lib/analytics";

import { aiStatusKey } from "./insights";
import { api } from "./client";
import type { AiStatus, CompareInsight, CompareResponse, ScreenResponse } from "./types";

const FIVE_MIN = 5 * 60_000;

/** Shared by the hook and the router's prefetch (app/router.tsx). */
export const screenerQuery = (start: string | null, end: string | null) =>
  queryOptions({
    queryKey: ["screener", start, end],
    queryFn: ({ signal }) => api<ScreenResponse>("/screener", { query: { start, end }, signal }),
    staleTime: FIVE_MIN,
  });

/** Every stock for the latest session (no dates) or a period, with screener columns (US-2.9). */
export function useScreener(start: string | null, end: string | null) {
  return useQuery({ ...screenerQuery(start, end), placeholderData: keepPreviousData });
}

/** Up to 4 stocks over one period, rebased to a common start, with optional averages (US-3.10). */
export function useCompare(symbols: string[], start: string | null, end: string | null, benchmarks: string[]) {
  return useQuery({
    queryKey: ["compare", symbols.join(","), start, end, benchmarks.join(",")],
    queryFn: ({ signal }) =>
      api<CompareResponse>("/compare", {
        query: { symbols: symbols.join(","), start, end, benchmarks: benchmarks.join(",") },
        signal,
      }),
    enabled: symbols.length > 0 && !!start && !!end,
    staleTime: FIVE_MIN,
    placeholderData: keepPreviousData,
  });
}

/** The AI overview of a comparison (US-4.7): only when asked, then kept for the visit, like a reading. */
export function useCompareInsight(symbols: string[], start: string | null, end: string | null) {
  const qc = useQueryClient();
  const key = [...symbols].sort().join(",");
  return useQuery({
    queryKey: ["ai", "compare", key, start, end],
    queryFn: async () => {
      const insight = await api<CompareInsight>("/compare/insights", {
        method: "POST",
        body: { symbols, start, end },
      });
      qc.setQueryData<AiStatus>(aiStatusKey, (s) => (s ? { ...s, quota: insight.quota } : s));
      track("ai.compare", { symbols: key, cached: insight.cached });
      return insight;
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
}
