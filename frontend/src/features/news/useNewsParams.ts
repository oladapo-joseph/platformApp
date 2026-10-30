import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import { track } from "@/lib/analytics";
import { parseNewsParams, writeNewsParams, type NewsFilters } from "@/lib/news";

/**
 * News filters live in the URL (US-9.8), so a filtered view can be bookmarked or shared.
 * Clicks add a history entry; typing in the search box replaces it.
 */
export function useNewsParams() {
  const [params, setParams] = useSearchParams();
  const key = params.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures `params`
  const filters = useMemo(() => parseNewsParams(params), [key]);
  const set = useCallback(
    (next: NewsFilters, { replace = false }: { replace?: boolean } = {}) => {
      // which filter changed, never what was typed (US-7.8)
      const changed = (Object.keys(next) as (keyof NewsFilters)[]).find(
        (k) => k !== "sort" && JSON.stringify(next[k]) !== JSON.stringify(filters[k]),
      );
      if (changed) track("news.filter", { filter: changed });
      setParams(writeNewsParams(next), { replace, preventScrollReset: true });
    },
    [setParams, filters],
  );
  return { filters, set };
}
