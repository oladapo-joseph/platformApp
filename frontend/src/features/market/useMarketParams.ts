import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { parseSort } from "@/lib/market";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Market view state lives in the URL (docs/06 §7, US-2.5, US-2.6): `start`+`end` switch to a
 * period, `sector` filters, `q` searches, `sort` orders the price list (`-pct` = largest first).
 */
export function useMarketParams() {
  const [params, setParams] = useSearchParams();
  const start = params.get("start");
  const end = params.get("end");
  const period = !!start && !!end && DAY.test(start) && DAY.test(end) && start <= end;

  const update = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === "") next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  );

  return {
    period,
    start: period ? start : null,
    end: period ? end : null,
    sector: params.get("sector"),
    q: params.get("q") ?? "",
    sortParam: params.get("sort"),
    sort: parseSort(params.get("sort")),
    update,
    /** Query string for a link that keeps this view but changes some params */
    hrefWith: (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      return `?${next.toString()}`;
    },
  };
}

export type MarketParams = ReturnType<typeof useMarketParams>;
