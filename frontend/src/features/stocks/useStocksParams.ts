import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import { CAP_BANDS, parseScreenSort, parseSymbols, type CapBand, type ScreenFilters } from "@/lib/screener";
import { DEFAULT_STRATEGY } from "@/lib/stock";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const list = (raw: string | null) => (raw ? raw.split(",").filter(Boolean) : []);

export type StocksView = "cards" | "table";

/**
 * The Stocks page's state lives in the URL, so a filtered view can be shared: `start`+`end` a
 * period, `q` search, `sector` and `sub` (comma lists), `cap`, `liq` (minimum value traded),
 * `sig` (bullish/bearish latest signal of `strat`), `watch=1`, `traded=1`, `view`, `sort` and
 * `cmp` (the stocks ticked for Compare).
 */
export function useStocksParams() {
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

  const sig = params.get("sig");
  const cap = params.get("cap");
  const liq = Number(params.get("liq"));
  const filters: ScreenFilters = useMemo(
    () => ({
      q: params.get("q") ?? "",
      sectors: list(params.get("sector")),
      subsectors: list(params.get("sub")),
      cap: CAP_BANDS.some((b) => b.value === cap) ? (cap as CapBand) : null,
      minValue: Number.isFinite(liq) && liq > 0 ? liq : null,
      signal: sig === "buy" || sig === "sell" ? sig : null,
      strategy: params.get("strat") ?? DEFAULT_STRATEGY,
      watchlist: params.get("watch") === "1",
      traded: params.get("traded") === "1",
    }),
    [params, cap, liq, sig],
  );

  return {
    period,
    start: period ? start : null,
    end: period ? end : null,
    filters,
    view: (params.get("view") === "table" ? "table" : "cards") as StocksView,
    sort: parseScreenSort(params.get("sort")),
    sortParam: params.get("sort"),
    compare: parseSymbols(params.get("cmp")),
    update,
  };
}

export type StocksParams = ReturnType<typeof useStocksParams>;
