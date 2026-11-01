import { useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/lib/analytics";

import { api } from "./client";
import type { AiStatus, Insight } from "./types";

export const aiStatusKey = ["ai", "status"] as const;

/** Whether AI readings are on, and my readings left today (US-4.4). */
export function useAiStatus() {
  return useQuery({
    queryKey: aiStatusKey,
    queryFn: ({ signal }) => api<AiStatus>("/me/ai", { signal }),
    staleTime: 60_000,
  });
}

type Ask = { symbol: string; strategy: string; range: string; start: string | null; end: string | null };

/**
 * One reading per stock, strategy and chart range, fetched only when asked ("Explain these
 * signals"), then kept for the visit. Asking again after the data moves on (`refresh`) fetches
 * for the new dates under the same key, so the old reading shows until the new one arrives.
 */
export function useInsight({ symbol, strategy, range, start, end }: Ask) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["ai", "insight", symbol, strategy, range],
    queryFn: async () => {
      const insight = await api<Insight>(`/stocks/${encodeURIComponent(symbol)}/insights`, {
        method: "POST",
        body: { strategy, start, end },
      });
      qc.setQueryData<AiStatus>(aiStatusKey, (s) => (s ? { ...s, quota: insight.quota } : s));
      track("ai.explain", { symbol, strategy, cached: insight.cached });
      return insight;
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
}
