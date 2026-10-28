import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import { parseView, writeList, type ChartRange, type Overlay, type Pane } from "@/lib/stock";

/**
 * Stock page view state in the URL (US-3.9): range, type, overlays, panes, strategy, table view,
 * and the lower tab. View changes push history entries, so back/forward step through them.
 */
export function useStockView() {
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => parseView(params), [params]);

  const set = useCallback(
    (patch: Record<string, string | null>, replace = false) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace, preventScrollReset: true },
      ),
    [setParams],
  );

  return {
    ...view,
    tab: params.get("tab"),
    setRange: (range: ChartRange) => set({ range }),
    setType: (type: "candle" | "line") => set({ type: type === "candle" ? null : type }),
    setOverlays: (o: Overlay[]) => set({ overlays: o.length ? o.join(",") : null }),
    setPanes: (p: Pane[]) => set({ panes: p.length === 1 && p[0] === "volume" ? null : writeList(p) }),
    setStrategy: (strategy: string) => set({ strategy }),
    setTable: (on: boolean) => set({ view: on ? "table" : null }),
    setTab: (tab: string) => set({ tab }, true),
  };
}

export type StockViewState = ReturnType<typeof useStockView>;
