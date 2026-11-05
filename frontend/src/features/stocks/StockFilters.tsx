/**
 * The Stocks page filters (US-2.9): sectors with their subsectors, and "More filters" for size,
 * liquidity, the latest signal, watchlist only and traded only. Every choice shows as a removable
 * chip; all of it lives in the URL.
 */
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, type ReactNode } from "react";

import type { ScreenRow, StrategyInfo } from "@/api/types";
import { cn } from "@/lib/cn";
import { CAP_BANDS, LIQUIDITY, SIGNAL_DAYS, sectorTree, strategyShort, type ScreenFilters } from "@/lib/screener";
import { sectorName } from "@/lib/sectors";
import { track } from "@/lib/analytics";

import type { StocksParams } from "./useStocksParams";

const trigger =
  "touch-target inline-flex h-10 items-center gap-2 rounded-md border border-line-input bg-surface px-3 text-sm font-medium text-fg hover:bg-hover data-[state=open]:bg-hover";
const panel =
  "z-(--z-dropdown) max-h-[min(32rem,var(--radix-popover-content-available-height))] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-line bg-raised p-4 shadow-md";

const toggle = (items: string[], item: string) =>
  items.includes(item) ? items.filter((x) => x !== item) : [...items, item];

function Check({
  checked,
  onChange,
  children,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <label className="touch-target flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm text-fg hover:bg-hover">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 accent-(--color-brand)" />
      <span className="min-w-0 flex-1">{children}</span>
      {count !== undefined && <span className="num text-xs text-fg-muted">{count}</span>}
    </label>
  );
}

function Radio({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="touch-target flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm text-fg hover:bg-hover">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="size-4 accent-(--color-brand)" />
      {children}
    </label>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-line-subtle py-3 first:pt-0 last:border-b-0 last:pb-0">
      <legend className="eyebrow mb-1 text-fg-muted">{legend}</legend>
      {children}
    </fieldset>
  );
}

function Sectors({ rows, f, p }: { rows: ScreenRow[]; f: ScreenFilters; p: StocksParams }) {
  const tree = sectorTree(rows);
  const set = (sectors: string[], subsectors: string[]) => {
    track("stocks.filter", { filter: "sector" });
    p.update({ sector: sectors.join(",") || null, sub: subsectors.join(",") || null });
  };
  const picked = f.sectors.length + f.subsectors.length;
  return (
    <Popover.Root>
      <Popover.Trigger className={trigger}>
        Sector
        {picked > 0 && <span className="num rounded-full bg-brand-subtle px-1.5 text-xs text-brand">{picked}</span>}
        <ChevronDown aria-hidden className="size-4 text-fg-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className={panel} aria-label="Filter by sector">
          <ul className="flex flex-col gap-0.5">
            {tree.map((node) => {
              const on = f.sectors.includes(node.sector);
              return (
                <li key={node.sector}>
                  <Check
                    checked={on}
                    count={node.count}
                    onChange={() =>
                      set(
                        toggle(f.sectors, node.sector),
                        on ? f.subsectors.filter((s) => !node.subsectors.includes(s)) : f.subsectors,
                      )
                    }
                  >
                    {sectorName(node.sector)}
                  </Check>
                  {on && node.subsectors.length > 1 && (
                    <ul
                      className="mb-1 ml-6 border-l border-line-subtle pl-2"
                      aria-label={`${sectorName(node.sector)} subsectors`}
                    >
                      {node.subsectors.map((sub) => (
                        <li key={sub}>
                          <Check
                            checked={f.subsectors.includes(sub)}
                            count={rows.filter((r) => r.subsector === sub).length}
                            onChange={() => set(f.sectors, toggle(f.subsectors, sub))}
                          >
                            {sub}
                          </Check>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-fg-muted">Pick a sector to narrow it to subsectors.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function More({ f, p, strategies }: { f: ScreenFilters; p: StocksParams; strategies: StrategyInfo[] | undefined }) {
  const id = useId();
  const set = (filter: string, patch: Record<string, string | null>) => {
    track("stocks.filter", { filter });
    p.update(patch);
  };
  const active = [f.cap, f.minValue, f.signal, f.watchlist || null, f.traded || null].filter(Boolean).length;
  return (
    <Popover.Root>
      <Popover.Trigger className={trigger}>
        <SlidersHorizontal aria-hidden className="size-4 text-fg-muted" />
        More filters
        {active > 0 && <span className="num rounded-full bg-brand-subtle px-1.5 text-xs text-brand">{active}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className={panel} aria-label="More filters">
          <Fieldset legend="Size (market cap)">
            <Radio name={`${id}-cap`} checked={!f.cap} onChange={() => set("cap", { cap: null })}>
              Any size
            </Radio>
            {CAP_BANDS.map((b) => (
              <Radio
                key={b.value}
                name={`${id}-cap`}
                checked={f.cap === b.value}
                onChange={() => set("cap", { cap: b.value })}
              >
                {b.label}
              </Radio>
            ))}
          </Fieldset>
          <Fieldset legend="Value traded">
            <Radio name={`${id}-liq`} checked={f.minValue === null} onChange={() => set("liquidity", { liq: null })}>
              Any amount
            </Radio>
            {LIQUIDITY.map((l) => (
              <Radio
                key={l.value}
                name={`${id}-liq`}
                checked={f.minValue === l.value}
                onChange={() => set("liquidity", { liq: String(l.value) })}
              >
                {l.label}
              </Radio>
            ))}
          </Fieldset>
          <Fieldset legend={`Latest signal, last ${SIGNAL_DAYS} days`}>
            <label className="mb-1 flex items-center gap-2 text-sm text-fg-2">
              Strategy
              <select
                value={f.strategy}
                onChange={(e) => set("strategy", { strat: e.target.value })}
                className="touch-target h-9 flex-1 rounded-md border border-line-input bg-surface px-2 text-sm text-fg"
              >
                {(strategies ?? []).map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <Radio name={`${id}-sig`} checked={!f.signal} onChange={() => set("signal", { sig: null })}>
              Any or none
            </Radio>
            <Radio name={`${id}-sig`} checked={f.signal === "buy"} onChange={() => set("signal", { sig: "buy" })}>
              ▲ Bullish crossover
            </Radio>
            <Radio name={`${id}-sig`} checked={f.signal === "sell"} onChange={() => set("signal", { sig: "sell" })}>
              ▼ Bearish crossover
            </Radio>
          </Fieldset>
          <Fieldset legend="Show only">
            <Check checked={f.watchlist} onChange={() => set("watchlist", { watch: f.watchlist ? null : "1" })}>
              My watchlist
            </Check>
            <Check checked={f.traded} onChange={() => set("traded", { traded: f.traded ? null : "1" })}>
              Stocks that traded
            </Check>
          </Fieldset>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sunken py-1 pr-1 pl-3 text-xs text-fg">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="touch-target flex size-5 items-center justify-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}

export function FilterControls({
  rows,
  p,
  strategies,
}: {
  rows: ScreenRow[];
  p: StocksParams;
  strategies: StrategyInfo[] | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Sectors rows={rows} f={p.filters} p={p} />
      <More f={p.filters} p={p} strategies={strategies} />
    </div>
  );
}

/** The active filters as chips, with "Clear all". Search has its own box, so it isn't a chip. */
export function FilterChips({
  p,
  strategies,
  onClear,
}: {
  p: StocksParams;
  strategies: StrategyInfo[] | undefined;
  onClear: () => void;
}) {
  const f = p.filters;
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...f.sectors.map((s) => ({
      key: `s-${s}`,
      label: sectorName(s),
      remove: () => p.update({ sector: f.sectors.filter((x) => x !== s).join(",") || null }),
    })),
    ...f.subsectors.map((s) => ({
      key: `u-${s}`,
      label: s,
      remove: () => p.update({ sub: f.subsectors.filter((x) => x !== s).join(",") || null }),
    })),
  ];
  const cap = CAP_BANDS.find((b) => b.value === f.cap);
  if (cap) chips.push({ key: "cap", label: cap.label, remove: () => p.update({ cap: null }) });
  const liq = LIQUIDITY.find((l) => l.value === f.minValue);
  if (liq) chips.push({ key: "liq", label: `Traded ${liq.label}`, remove: () => p.update({ liq: null }) });
  if (f.signal)
    chips.push({
      key: "sig",
      label: `${f.signal === "buy" ? "▲ Bullish" : "▼ Bearish"} ${strategyShort(f.strategy, strategies)}, ${SIGNAL_DAYS} days`,
      remove: () => p.update({ sig: null }),
    });
  if (f.watchlist) chips.push({ key: "watch", label: "My watchlist", remove: () => p.update({ watch: null }) });
  if (f.traded) chips.push({ key: "traded", label: "Traded only", remove: () => p.update({ traded: null }) });
  if (!chips.length && !f.q) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2")} aria-label="Active filters">
      {chips.map((c) => (
        <Chip key={c.key} label={c.label} onRemove={c.remove} />
      ))}
      <button
        type="button"
        onClick={onClear}
        className="text-xs font-medium text-fg-2 underline-offset-2 hover:text-fg hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
