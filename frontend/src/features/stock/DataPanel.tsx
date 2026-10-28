/** Daily OHLCV for the selected range, newest first, with a CSV of exactly that range (US-3.8). */
import { Download } from "lucide-react";

import type { Bar } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { PriceChange } from "@/components/ui/market";
import { day } from "@/lib/dates";
import { money, price, volume } from "@/lib/format";
import { barsCsv, csvFilename } from "@/lib/stock";

function download(symbol: string, bars: Bar[]) {
  const url = URL.createObjectURL(new Blob([barsCsv(bars)], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: csvFilename(symbol, bars) });
  a.click();
  URL.revokeObjectURL(url);
}

export function DataPanel({ symbol, bars, maxHeight }: { symbol: string; bars: Bar[]; maxHeight?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-fg-muted">{bars.length} trading days · dates are NGX trade dates (WAT)</p>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download aria-hidden className="size-4" />}
          onClick={() => download(symbol, bars)}
        >
          Download CSV
        </Button>
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label={`${symbol} daily prices`}
        className="-mx-4 overflow-auto"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">{symbol} daily prices, newest first</caption>
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-line-subtle text-xs text-fg-muted">
              {["Date", "Open", "High", "Low", "Close", "% Change", "Volume", "Value", "Deals"].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={i === 0 ? "px-4 py-2 text-left font-medium" : "px-4 py-2 text-right font-medium"}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {[...bars].reverse().map((b) => (
              <tr key={b.date}>
                <th scope="row" className="num px-4 py-1.5 text-left font-normal whitespace-nowrap text-fg">
                  {day(b.date)}
                </th>
                <td className="num px-4 py-1.5 text-right text-fg">{price(b.open)}</td>
                <td className="num px-4 py-1.5 text-right text-fg">{price(b.high)}</td>
                <td className="num px-4 py-1.5 text-right text-fg">{price(b.low)}</td>
                <td className="num px-4 py-1.5 text-right text-fg">{price(b.close)}</td>
                <td className="px-4 py-1.5 text-right">
                  <PriceChange pct={b.pct_change} />
                </td>
                <td className="num px-4 py-1.5 text-right text-fg">{volume(b.volume)}</td>
                <td className="num px-4 py-1.5 text-right text-fg">{money(b.value)}</td>
                <td className="num px-4 py-1.5 text-right text-fg">{b.trades?.toLocaleString("en-NG") ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
