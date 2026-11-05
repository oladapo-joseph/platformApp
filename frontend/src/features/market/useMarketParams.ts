import { useCallback } from "react";
import { useSearchParams } from "react-router";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Market view state lives in the URL (docs/06 §7, US-2.5): `start`+`end` switch to a period and
 * `sector` picks the sector for top stories. The full price list is on Stocks (US-2.9), which
 * `stocksHref` opens on the same session or period.
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
    update,
    /** The Stocks table on this session or period, e.g. sorted by `{ sort: "-pct" }` */
    stocksHref: (patch: Record<string, string>) => {
      const next = new URLSearchParams({ view: "table", ...patch });
      if (period && start && end) {
        next.set("start", start);
        next.set("end", end);
      }
      return `/app/stocks?${next.toString()}`;
    },
  };
}

export type MarketParams = ReturnType<typeof useMarketParams>;
