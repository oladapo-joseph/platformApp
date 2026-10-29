/**
 * The News page filters (US-9.8): one set of controls for the desktop rail and the phone sheet.
 * Every option shows how many articles it would give with the other filters applied; options
 * with none are disabled but stay visible.
 */
import { ChevronRight, X } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";

import { useDirectory } from "@/api/market";
import { useWatchlist } from "@/api/watchlist";
import type { NewsPage } from "@/api/types";
import { cn } from "@/lib/cn";
import {
  ARCHIVE_DAYS,
  CONTENT_TYPES,
  DATE_PRESETS,
  DEFAULT_TYPES,
  FACET_KEY,
  hasStocks,
  REGULATORS,
  SCOPES,
  TOPICS,
  valueLabel,
  watDaysAgo,
  watToday,
  type ContentType,
  type ListFilter,
  type NewsFilters as Filters,
} from "@/lib/news";
import { rankStocks } from "@/lib/search";

type Facets = NewsPage["facets"] | undefined;

const SHOW = 6;

function counts(facets: Facets, key: ListFilter): Map<string, number> {
  return new Map((facets?.[FACET_KEY[key]] ?? []).map((c) => [c.value, c.count]));
}

function Group({
  title,
  active,
  defaultOpen,
  children,
}: {
  title: string;
  active: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen || active > 0} className="group border-b border-line-subtle py-2 last:border-b-0">
      <summary className="touch-target flex h-10 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-fg [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {active > 0 && <span className="ml-1.5 text-xs font-normal text-brand">{active} selected</span>}
        </span>
        <ChevronRight aria-hidden className="size-4 text-fg-muted transition-transform group-open:rotate-90" />
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}

function Option({
  type = "checkbox",
  name,
  checked,
  disabled,
  count,
  onChange,
  children,
}: {
  type?: "checkbox" | "radio";
  name?: string;
  checked: boolean;
  disabled?: boolean;
  count?: number | undefined;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 text-sm text-fg-2 hover:bg-hover md:min-h-8",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="size-4 shrink-0 accent-(--color-brand)"
      />
      <span className={cn("min-w-0 flex-1 truncate", checked && "text-fg")}>{children}</span>
      {count !== undefined && (
        <span className="num text-xs text-fg-muted">
          {count}
          <span className="sr-only"> articles</span>
        </span>
      )}
    </label>
  );
}

/** A checkbox list over known values plus whatever the facets found; long lists fold after six. */
function CheckList({
  filterKey,
  values,
  filters,
  facets,
  onChange,
  numeric,
}: {
  filterKey: ListFilter;
  values: string[];
  filters: Filters;
  facets: Facets;
  onChange: (f: Filters) => void;
  numeric?: boolean;
}) {
  const [all, setAll] = useState(false);
  const n = counts(facets, filterKey);
  const selected = filters[filterKey] as string[];
  const shown = all ? values : values.filter((v, i) => i < SHOW || selected.includes(v));
  const toggle = (v: string) =>
    onChange({
      ...filters,
      [filterKey]: selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v],
    });
  return (
    <div className="flex flex-col">
      {shown.map((v) => (
        <Option
          key={v}
          checked={selected.includes(v)}
          disabled={!selected.includes(v) && !n.get(v)}
          count={n.get(v) ?? 0}
          onChange={() => toggle(v)}
        >
          <span className={numeric ? "num" : undefined}>{valueLabel(filterKey, v)}</span>
        </Option>
      ))}
      {values.length > shown.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="touch-target self-start px-1 py-1 text-sm font-medium text-brand hover:underline"
        >
          Show {values.length - shown.length} more
        </button>
      )}
    </div>
  );
}

/** Known values first in their own order, then anything else the facets found, by count. */
function merge(known: readonly string[], facets: Facets, key: ListFilter, selected: string[]): string[] {
  const found = (facets?.[FACET_KEY[key]] ?? []).map((c) => c.value);
  return [...new Set([...known, ...selected, ...found])];
}

function StockPicker({
  filters,
  facets,
  onChange,
}: {
  filters: Filters;
  facets: Facets;
  onChange: (f: Filters) => void;
}) {
  const { data: directory } = useDirectory();
  const { data: watchlist } = useWatchlist();
  const [query, setQuery] = useState("");
  const id = useId();
  const mine = watchlist?.symbols.length ?? 0;
  const matches = useMemo(
    () => rankStocks(directory ?? [], query, 5).filter((e) => !filters.symbol.includes(e.symbol)),
    [directory, query, filters.symbol],
  );
  const add = (symbol: string) => {
    onChange({ ...filters, symbol: [...filters.symbol, symbol] });
    setQuery("");
  };
  return (
    <div className="flex flex-col gap-2">
      <Option
        checked={filters.watchlist}
        disabled={!mine && !filters.watchlist}
        onChange={() => onChange({ ...filters, watchlist: !filters.watchlist })}
      >
        My watchlist
        <span className="text-xs text-fg-muted">{mine ? ` (${mine} stock${mine === 1 ? "" : "s"})` : " (empty)"}</span>
      </Option>
      <label htmlFor={id} className="sr-only">
        Add a stock
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            e.preventDefault();
            add(matches[0].symbol);
          }
        }}
        placeholder="Add a stock…"
        autoComplete="off"
        className="touch-target h-9 w-full rounded-md border border-line-input bg-surface px-3 text-sm text-fg placeholder:text-fg-muted"
      />
      {query && (
        <ul aria-label="Matching stocks" className="flex flex-col">
          {matches.length ? (
            matches.map((e) => (
              <li key={e.symbol}>
                <button
                  type="button"
                  onClick={() => add(e.symbol)}
                  className="touch-target flex w-full items-baseline gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-hover"
                >
                  <span className="num font-medium text-fg">{e.symbol}</span>
                  <span className="truncate text-xs text-fg-muted">{e.company}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-1 py-1.5 text-sm text-fg-muted">No stock matches “{query}”</li>
          )}
        </ul>
      )}
      <CheckList
        filterKey="symbol"
        values={merge([], facets, "symbol", filters.symbol)}
        filters={filters}
        facets={facets}
        onChange={onChange}
        numeric
      />
      <Option
        checked={filters.headline}
        disabled={!hasStocks(filters)}
        onChange={() => onChange({ ...filters, headline: !filters.headline })}
      >
        Headline mentions only
      </Option>
    </div>
  );
}

function DateFilter({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const name = useId();
  const min = watDaysAgo(ARCHIVE_DAYS);
  const max = watToday();
  const input =
    "touch-target h-9 w-full rounded-md border border-line-input bg-surface px-2 text-sm text-fg [color-scheme:inherit]";
  return (
    <div role="radiogroup" aria-label="Published" className="flex flex-col">
      {DATE_PRESETS.map((p) => (
        <Option
          key={p.value}
          type="radio"
          name={name}
          checked={filters.days === p.value}
          onChange={() => onChange({ ...filters, days: p.value, from: null, to: null })}
        >
          {p.label}
        </Option>
      ))}
      <Option
        type="radio"
        name={name}
        checked={filters.days === "custom"}
        onChange={() => onChange({ ...filters, days: "custom", from: filters.from ?? watDaysAgo(7), to: filters.to })}
      >
        Custom range
      </Option>
      {filters.days === "custom" && (
        <div className="grid grid-cols-2 gap-2 pt-1 pl-8">
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            From
            <input
              type="date"
              min={min}
              max={filters.to ?? max}
              value={filters.from ?? ""}
              onChange={(e) => onChange({ ...filters, from: e.target.value || null })}
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            To
            <input
              type="date"
              min={filters.from ?? min}
              max={max}
              value={filters.to ?? ""}
              onChange={(e) => onChange({ ...filters, to: e.target.value || null })}
              className={input}
            />
          </label>
        </div>
      )}
      <p className="px-1 pt-1 text-xs text-fg-muted">News is kept for {ARCHIVE_DAYS} days.</p>
    </div>
  );
}

function TypeFilter({
  filters,
  facets,
  onChange,
}: {
  filters: Filters;
  facets: Facets;
  onChange: (f: Filters) => void;
}) {
  const n = counts(facets, "type");
  const current = filters.type.length ? filters.type : DEFAULT_TYPES;
  const toggle = (t: ContentType) => {
    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
    const isDefault = next.length === DEFAULT_TYPES.length && DEFAULT_TYPES.every((d) => next.includes(d));
    onChange({ ...filters, type: isDefault ? [] : next });
  };
  return (
    <div className="flex flex-col">
      {CONTENT_TYPES.map((t) => (
        <Option
          key={t.value}
          checked={current.includes(t.value)}
          disabled={current.length === 1 && current.includes(t.value)}
          count={n.get(t.value) ?? 0}
          onChange={() => toggle(t.value)}
        >
          {t.label}
        </Option>
      ))}
    </div>
  );
}

export function NewsFilterControls({
  filters,
  facets,
  onChange,
}: {
  filters: Filters;
  facets: Facets;
  onChange: (f: Filters) => void;
}) {
  const { data: directory } = useDirectory();
  const sectors = useMemo(
    () => [...new Set((directory ?? []).map((e) => e.sector).filter(Boolean))].sort(),
    [directory],
  );
  const props = { filters, facets, onChange };
  return (
    <div className="flex flex-col">
      <Group title="Topic" active={filters.topic.length} defaultOpen>
        <CheckList filterKey="topic" values={TOPICS.map((t) => t.value)} {...props} />
      </Group>
      <Group title="Stocks" active={filters.symbol.length + (filters.watchlist ? 1 : 0)} defaultOpen>
        <StockPicker {...props} />
      </Group>
      <Group title="Published" active={filters.days === "90" ? 0 : 1} defaultOpen>
        <DateFilter filters={filters} onChange={onChange} />
      </Group>
      <Group title="Sector" active={filters.sector.length}>
        <CheckList filterKey="sector" values={merge(sectors, facets, "sector", filters.sector)} {...props} />
      </Group>
      <Group title="Subsector" active={filters.subsector.length}>
        <CheckList filterKey="subsector" values={merge([], facets, "subsector", filters.subsector)} {...props} />
      </Group>
      <Group title="Scope" active={filters.scope.length}>
        <CheckList filterKey="scope" values={SCOPES.map((s) => s.value)} {...props} />
      </Group>
      <Group title="Regulator" active={filters.regulator.length}>
        <CheckList
          filterKey="regulator"
          values={merge(REGULATORS, facets, "regulator", filters.regulator)}
          {...props}
        />
      </Group>
      <Group title="Type" active={filters.type.length ? 1 : 0}>
        <TypeFilter {...props} />
      </Group>
      <Group title="Source" active={filters.source.length}>
        <CheckList filterKey="source" values={merge([], facets, "source", filters.source)} {...props} />
      </Group>
    </div>
  );
}

export function RemoveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="touch-target inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface pr-2 pl-3 text-sm text-fg hover:border-line-input"
    >
      {label}
      <X aria-hidden className="size-3.5 text-fg-muted" />
      <span className="sr-only">(remove filter)</span>
    </button>
  );
}
