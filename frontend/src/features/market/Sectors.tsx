/**
 * Sector performance (US-2.4): a ranked diverging bar list, the heatmap, and a table view.
 * Desktop shows heatmap + bars together; phones start on the bars (treemaps are hard to read
 * at 360 px). Selecting a sector filters the price list and the top stories (`?sector=`).
 */
import { useState } from "react";

import type { SectorAggregate } from "@/api/types";
import { SegmentedControl } from "@/components/ui/controls";
import { Card } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { money, percent, spokenChange, volume } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";

import { HeatLegend, SectorTreemap } from "./SectorTreemap";
import { sectorName } from "@/lib/sectors";

function SectorBars({
  sectors,
  selected,
  onSelect,
}: {
  sectors: SectorAggregate[];
  selected: string | null;
  onSelect: (sector: string) => void;
}) {
  const ranked = [...sectors].sort((a, b) => (b.avg_pct_change ?? -Infinity) - (a.avg_pct_change ?? -Infinity));
  const max = Math.max(1, ...ranked.map((s) => Math.abs(s.avg_pct_change ?? 0)));
  return (
    <ul className="flex flex-col">
      {ranked.map((s) => {
        const pct = s.avg_pct_change;
        const share = pct === null ? 0 : (Math.abs(pct) / max) * 50; // % of the track; zero line in the middle
        const isSelected = selected === s.sector;
        return (
          <li key={s.sector}>
            <button
              type="button"
              onClick={() => onSelect(s.sector)}
              aria-pressed={isSelected}
              aria-label={`${sectorName(s.sector)}, ${spokenChange(null, pct)}, ${money(s.total_value)} traded`}
              className={cn(
                "touch-target grid w-full grid-cols-[minmax(6rem,9rem)_1fr_4.5rem] items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-hover",
                isSelected && "bg-selected",
              )}
            >
              <span className="truncate text-sm text-fg">{sectorName(s.sector)}</span>
              <span aria-hidden className="relative h-4">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                {pct !== null && pct !== 0 && (
                  <span
                    className={cn(
                      "absolute top-0.5 h-3",
                      pct > 0
                        ? "left-1/2 rounded-r-[4px] bg-(--chart-up)"
                        : "right-1/2 rounded-l-[4px] bg-(--chart-down)",
                    )}
                    style={{ width: `${share}%` }}
                  />
                )}
              </span>
              <span aria-hidden className="num text-right text-sm text-fg">
                {percent(pct)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SectorTable({ sectors }: { sectors: SectorAggregate[] }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">Sector performance</caption>
        <thead>
          <tr className="border-b border-line-subtle text-left text-xs text-fg-muted">
            <th scope="col" className="py-2 pr-3 font-medium">
              Sector
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Avg % change
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Value traded
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Volume
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Stocks
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {sectors.map((s) => (
            <tr key={s.sector}>
              <th scope="row" className="py-2 pr-3 text-left font-normal text-fg">
                {sectorName(s.sector)}
              </th>
              <td className="num py-2 pr-3 text-right text-fg">{percent(s.avg_pct_change)}</td>
              <td className="num py-2 pr-3 text-right text-fg">{money(s.total_value)}</td>
              <td className="num py-2 pr-3 text-right text-fg">{volume(s.total_volume)}</td>
              <td className="num py-2 text-right text-fg">{s.stock_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type View = "chart" | "bars" | "heatmap" | "table";

export function Sectors({
  sectors,
  selected,
  onSelect,
}: {
  sectors: SectorAggregate[];
  selected: string | null;
  onSelect: (sector: string | null) => void;
}) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const [view, setView] = useState<View | null>(null);
  const active: View = view ?? (wide ? "chart" : "bars");
  const toggle = (s: string) => onSelect(selected === s ? null : s);
  const options = wide
    ? [
        { value: "chart" as const, label: "Chart" },
        { value: "table" as const, label: "Table" },
      ]
    : [
        { value: "bars" as const, label: "Bars" },
        { value: "heatmap" as const, label: "Heatmap" },
        { value: "table" as const, label: "Table" },
      ];
  const shown: View = options.some((o) => o.value === active) ? active : wide ? "chart" : "bars";

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-headline text-xl font-semibold text-fg">Sectors</h2>
          <p className="text-xs text-fg-muted">Average % change of each sector's stocks. Select one to filter.</p>
        </div>
        <SegmentedControl
          label="Sector view"
          track="market.sectors_view"
          size="sm"
          value={shown}
          onChange={setView}
          options={options}
        />
      </div>
      {shown === "table" && <SectorTable sectors={sectors} />}
      {shown === "bars" && <SectorBars sectors={sectors} selected={selected} onSelect={toggle} />}
      {shown === "heatmap" && (
        <>
          <SectorTreemap sectors={sectors} selected={selected} onSelect={toggle} height={280} />
          <div className="mt-2">
            <HeatLegend />
          </div>
        </>
      )}
      {shown === "chart" && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <SectorTreemap sectors={sectors} selected={selected} onSelect={toggle} />
            <div className="mt-2">
              <HeatLegend />
            </div>
          </div>
          <SectorBars sectors={sectors} selected={selected} onSelect={toggle} />
        </div>
      )}
    </Card>
  );
}
