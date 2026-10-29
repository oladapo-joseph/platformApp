/**
 * News page state (US-9.8), testable without a browser: the filters as they're written in the
 * URL, the API query they become, labels for the tag vocabularies (docs/10 §3–§6), and which
 * filter to suggest removing when nothing matches.
 */
import { TZDate } from "@date-fns/tz";
import { format, subDays } from "date-fns";

import type { Query } from "@/api/client";
import type { ContentType, Scope, Topic } from "@/api/types";

import { TZ } from "./dates";
import { sectorName } from "./sectors";

export type { ContentType, Scope, Topic };

/** Topic order on screen: company events first, then the wider economy (docs/10 §5.1). */
export const TOPICS: { value: Topic; label: string }[] = [
  { value: "earnings", label: "Earnings" },
  { value: "dividend", label: "Dividends" },
  { value: "corporate_action", label: "Corporate actions" },
  { value: "capital_raising", label: "Capital raising" },
  { value: "mergers_acquisitions", label: "M&A" },
  { value: "governance", label: "Leadership" },
  { value: "listing_trading", label: "Listings & trading status" },
  { value: "regulation", label: "Regulation" },
  { value: "monetary_policy", label: "Interest rates & CBN" },
  { value: "fx", label: "Naira & FX" },
  { value: "macro", label: "Economy" },
  { value: "energy", label: "Energy" },
  { value: "market_wrap", label: "Market wrap" },
  { value: "legal", label: "Legal" },
  { value: "outlook", label: "Outlook" },
];

export const SCOPES: { value: Scope; label: string }[] = [
  { value: "company", label: "Company" },
  { value: "multi_company", label: "Several companies" },
  { value: "sector", label: "Sector" },
  { value: "market", label: "Market" },
  { value: "macro", label: "Economy" },
];

export const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "news", label: "News" },
  { value: "analysis", label: "Analysis" },
  { value: "disclosure", label: "Disclosures" },
  { value: "press_release", label: "Press releases" },
  { value: "opinion", label: "Opinion" },
];

/** Opinion is hidden until someone asks for it (US-9.8). */
export const DEFAULT_TYPES: ContentType[] = ["news", "analysis", "disclosure", "press_release"];

/** The tagger's fixed list (docs/10 §5.2). */
export const REGULATORS = [
  "CBN",
  "SEC",
  "NGX",
  "FMDQ",
  "NAICOM",
  "PenCom",
  "NCC",
  "NERC",
  "NUPRC",
  "NMDPRA",
  "FIRS",
  "NDIC",
];

export const DATE_PRESETS = [
  { value: "1", label: "Since yesterday" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number]["value"] | "custom";
/** News is kept for 90 days, so that's the whole archive. */
export const ARCHIVE_DAYS = 90;

export const LIST_FILTERS = ["symbol", "sector", "subsector", "topic", "scope", "regulator", "type", "source"] as const;
export type ListFilter = (typeof LIST_FILTERS)[number];

export interface NewsFilters {
  symbol: string[];
  /** Add my watchlist's stocks to `symbol` (US-9.8) */
  watchlist: boolean;
  sector: string[];
  subsector: string[];
  topic: Topic[];
  scope: Scope[];
  regulator: string[];
  /** Empty means the default: everything but opinion */
  type: ContentType[];
  source: string[];
  days: DatePreset;
  from: string | null;
  to: string | null;
  headline: boolean;
  q: string;
  sort: "recent" | "importance";
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const has = <T extends string>(list: readonly { value: T }[], v: string): v is T => list.some((o) => o.value === v);

function list(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  return raw
    ? [
        ...new Set(
          raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}

/** Reads `/app/news?symbol=MTNN,GTCO&topic=dividend&days=7&q=…`; unknown values are dropped. */
export function parseNewsParams(params: URLSearchParams): NewsFilters {
  const from = params.get("from");
  const to = params.get("to");
  const custom = (!!from && DAY.test(from)) || (!!to && DAY.test(to));
  const days = params.get("days");
  return {
    symbol: list(params, "symbol").map((s) => s.toUpperCase()),
    watchlist: params.get("watchlist") === "1",
    sector: list(params, "sector").map((s) => s.toUpperCase()),
    subsector: list(params, "subsector"),
    topic: list(params, "topic").filter((t): t is Topic => has(TOPICS, t)),
    scope: list(params, "scope").filter((t): t is Scope => has(SCOPES, t)),
    regulator: list(params, "regulator"),
    type: list(params, "type").filter((t): t is ContentType => has(CONTENT_TYPES, t)),
    source: list(params, "source"),
    days: custom ? "custom" : DATE_PRESETS.some((p) => p.value === days) ? (days as DatePreset) : "90",
    from: custom && from && DAY.test(from) ? from : null,
    to: custom && to && DAY.test(to) ? to : null,
    headline: params.get("headline") === "1",
    q: params.get("q") ?? "",
    sort: params.get("sort") === "importance" ? "importance" : "recent",
  };
}

/** The reverse of parseNewsParams; defaults are left out so shared links stay short. */
export function writeNewsParams(f: NewsFilters): URLSearchParams {
  const p = new URLSearchParams();
  for (const key of LIST_FILTERS) if (f[key].length) p.set(key, f[key].join(","));
  if (f.watchlist) p.set("watchlist", "1");
  if (f.days === "custom") {
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
  } else if (f.days !== "90") p.set("days", f.days);
  if (f.headline) p.set("headline", "1");
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.sort !== "recent") p.set("sort", f.sort);
  return p;
}

export const watToday = () => format(new TZDate(Date.now(), TZ), "yyyy-MM-dd");
export const watDaysAgo = (n: number) => format(subDays(new TZDate(Date.now(), TZ), n), "yyyy-MM-dd");

/** Any stock filter: picked tickers or my watchlist ("Headline mentions only" needs one). */
export const hasStocks = (f: NewsFilters) => f.symbol.length > 0 || f.watchlist;

/** GET /news query. `today` is injectable for tests. */
export function newsQuery(f: NewsFilters, today = watToday()): Query {
  const from =
    f.days === "custom"
      ? f.from
      : f.days === "90"
        ? null
        : format(subDays(new Date(`${today}T12:00:00`), Number(f.days)), "yyyy-MM-dd");
  return {
    symbols: f.symbol.join(",") || null,
    watchlist: f.watchlist || null,
    sectors: f.sector.join(",") || null,
    subsectors: f.subsector.join(",") || null,
    topics: f.topic,
    scope: f.scope,
    regulators: f.regulator.join(",") || null,
    content_types: f.type.length ? f.type : DEFAULT_TYPES,
    sources: f.source.join(",") || null,
    from,
    to: f.days === "custom" ? f.to : null,
    title_only: f.headline && hasStocks(f) ? true : null,
    q: f.q.trim() || null,
    sort: f.sort,
  };
}

/** The facet key in the API response for each URL filter. */
export const FACET_KEY: Record<ListFilter, string> = {
  symbol: "symbols",
  sector: "sectors",
  subsector: "subsectors",
  topic: "topics",
  scope: "scope",
  regulator: "regulators",
  type: "content_type",
  source: "source",
};

export const FILTER_NAMES: Record<ListFilter, string> = {
  symbol: "Stocks",
  sector: "Sector",
  subsector: "Subsector",
  topic: "Topic",
  scope: "Scope",
  regulator: "Regulator",
  type: "Type",
  source: "Source",
};

/** How a value reads on a chip or an option. */
export function valueLabel(key: ListFilter, value: string): string {
  if (key === "topic") return TOPICS.find((t) => t.value === value)?.label ?? value;
  if (key === "scope") return SCOPES.find((t) => t.value === value)?.label ?? value;
  if (key === "type") return CONTENT_TYPES.find((t) => t.value === value)?.label ?? value;
  if (key === "sector") return sectorName(value);
  return value;
}

export function dateLabel(f: NewsFilters): string {
  if (f.days !== "custom") return DATE_PRESETS.find((p) => p.value === f.days)?.label ?? "90 days";
  if (f.from && f.to) return `${f.from} to ${f.to}`;
  return f.from ? `From ${f.from}` : `Until ${f.to ?? ""}`;
}

export interface ActiveChip {
  key: ListFilter | "watchlist" | "days" | "headline" | "q";
  value: string;
  label: string;
}

/** Removable chips for everything that isn't a default (US-9.8). */
export function activeChips(f: NewsFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (f.q.trim()) chips.push({ key: "q", value: f.q, label: `“${f.q.trim()}”` });
  if (f.watchlist) chips.push({ key: "watchlist", value: "1", label: "My watchlist" });
  for (const key of LIST_FILTERS) {
    for (const v of f[key]) chips.push({ key, value: v, label: valueLabel(key, v) });
  }
  if (f.days !== "90") chips.push({ key: "days", value: f.days, label: dateLabel(f) });
  if (f.headline && hasStocks(f)) chips.push({ key: "headline", value: "1", label: "Headline mentions only" });
  return chips;
}

export function withoutChip(f: NewsFilters, chip: ActiveChip): NewsFilters {
  if (chip.key === "q") return { ...f, q: "" };
  if (chip.key === "days") return { ...f, days: "90", from: null, to: null };
  if (chip.key === "headline") return { ...f, headline: false };
  if (chip.key === "watchlist") return { ...f, watchlist: false };
  const key = chip.key;
  return { ...f, [key]: (f[key] as string[]).filter((v) => v !== chip.value) };
}

export const CLEARED: Omit<NewsFilters, "sort"> = {
  symbol: [],
  watchlist: false,
  sector: [],
  subsector: [],
  topic: [],
  scope: [],
  regulator: [],
  type: [],
  source: [],
  days: "90",
  from: null,
  to: null,
  headline: false,
  q: "",
};

type Facets = Record<string, { value: string; count: number }[]> | null | undefined;

/** Fields with one value per article: removing the filter would bring back exactly the sum of its counts. */
const SINGLE = new Set<ListFilter>(["scope", "type", "source"]);

/**
 * With no results, the filter whose removal would bring back the most articles (US-9.8).
 * Facet counts ignore their own filter, so for each active list filter they show what removing
 * it would return: exactly (single-valued fields) or at least (tag lists). Falls back to the
 * search, then the date range.
 */
export function mostRestrictive(f: NewsFilters, facets: Facets): ActiveChip | null {
  let best: { chip: ActiveChip; n: number } | null = null;
  for (const key of LIST_FILTERS) {
    if (!f[key].length) continue;
    const counts = facets?.[FACET_KEY[key]] ?? [];
    const n = SINGLE.has(key)
      ? counts.reduce((sum, c) => sum + c.count, 0)
      : Math.max(0, ...counts.map((c) => c.count));
    if (n > 0 && (!best || n > best.n)) {
      const label = f[key].length === 1 ? valueLabel(key, f[key][0] ?? "") : FILTER_NAMES[key];
      best = { chip: { key, value: f[key].length === 1 ? (f[key][0] ?? "") : "*", label }, n };
    }
  }
  if (best) return best.chip;
  const chips = activeChips(f);
  return chips.find((c) => c.key === "q") ?? chips.find((c) => c.key === "days") ?? chips[0] ?? null;
}

/** Removes a whole filter (value "*") or one value. */
export function withoutRestriction(f: NewsFilters, chip: ActiveChip): NewsFilters {
  if (
    chip.value === "*" &&
    chip.key !== "q" &&
    chip.key !== "days" &&
    chip.key !== "headline" &&
    chip.key !== "watchlist"
  ) {
    return { ...f, [chip.key]: [] };
  }
  return withoutChip(f, chip);
}
