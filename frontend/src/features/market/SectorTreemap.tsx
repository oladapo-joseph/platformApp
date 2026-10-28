/**
 * Sector heatmap (US-2.4): area = value traded, colour = average % change on the diverging
 * loss → neutral → gain scale from the chart tokens, clamped at ±5%. Every cell is a focusable
 * button with the full reading in its label; the table view carries the same numbers.
 */
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SectorAggregate } from "@/api/types";
import { cn } from "@/lib/cn";
import { money, percent, spokenChange } from "@/lib/format";
import { HEAT_CLAMP, useHeatScale } from "@/lib/heat";
import { sectorName } from "@/lib/sectors";

export function HeatLegend() {
  const scale = useHeatScale();
  return (
    <div className="flex items-center gap-2 text-xs text-fg-muted" aria-hidden>
      <span className="num">{`−${HEAT_CLAMP}%`}</span>
      <span className="h-2 w-28 rounded-full" style={{ background: scale.gradient }} />
      <span className="num">{`+${HEAT_CLAMP}%`}</span>
      <span>· area = value traded</span>
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function SectorTreemap({
  sectors,
  selected,
  onSelect,
  height = 320,
}: {
  sectors: SectorAggregate[];
  selected: string | null;
  onSelect: (sector: string) => void;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const scale = useHeatScale();
  const [hover, setHover] = useState<string | null>(null);

  const cells = useMemo(() => {
    if (!width) return [];
    const root = hierarchy<{ children?: SectorAggregate[] } & Partial<SectorAggregate>>({
      children: sectors.filter((s) => s.total_value > 0),
    })
      .sum((d) => d.total_value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    treemap<typeof root.data>().tile(treemapSquarify).size([width, height]).paddingInner(2).round(true)(root);
    return root.leaves().map((leaf) => {
      const l = leaf as typeof leaf & { x0: number; x1: number; y0: number; y1: number };
      return { s: leaf.data as SectorAggregate, x: l.x0, y: l.y0, w: l.x1 - l.x0, h: l.y1 - l.y0 };
    });
  }, [sectors, width, height]);

  const tip = cells.find((c) => c.s.sector === hover);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="group" aria-label="Sector heatmap" className="block">
          {cells.map(({ s, x, y, w, h }) => {
            const label = `${sectorName(s.sector)}, ${spokenChange(null, s.avg_pct_change)}, ${money(s.total_value)} traded`;
            const roomy = w > 84 && h > 44;
            const isSelected = selected === s.sector;
            return (
              <g
                key={s.sector}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={isSelected}
                onClick={() => onSelect(s.sector)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(s.sector);
                  }
                }}
                onPointerEnter={() => setHover(s.sector)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(s.sector)}
                onBlur={() => setHover(null)}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-(--color-focus) [&:focus-visible>rect]:stroke-2"
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={4}
                  fill={scale.fill(s.avg_pct_change)}
                  stroke={isSelected ? "var(--color-text-primary)" : "none"}
                  strokeWidth={isSelected ? 2 : 0}
                  opacity={hover && hover !== s.sector ? 0.85 : 1}
                />
                {roomy && (
                  <text x={x + 8} y={y + 18} fill={scale.ink(s.avg_pct_change)} className="text-xs font-medium">
                    {truncate(sectorName(s.sector), Math.floor((w - 16) / 7))}
                    <tspan x={x + 8} dy={16} className="num">
                      {percent(s.avg_pct_change)}
                    </tspan>
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {tip && (
        <div
          role="presentation"
          className="pointer-events-none absolute z-(--z-tooltip) w-48 rounded-md border border-line bg-raised px-3 py-2 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(tip.x + tip.w / 2 - 96, 0), width - 192),
            top: tip.y + tip.h + 6 > height - 60 ? Math.max(tip.y - 70, 0) : tip.y + tip.h + 6,
          }}
        >
          <p className={cn("num text-sm font-semibold text-fg")}>{percent(tip.s.avg_pct_change)}</p>
          <p className="text-fg-2">{sectorName(tip.s.sector)}</p>
          <p className="text-fg-muted">
            {money(tip.s.total_value)} traded · {tip.s.stock_count} stocks
          </p>
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, Math.max(n - 1, 1))}…` : s;
}
