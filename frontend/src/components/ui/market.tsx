/** PriceChange and FreshnessStamp: the two data primitives every screen uses (docs/06 §6). */
import { Clock } from "lucide-react";

import { useMarketStatus } from "@/api/market";
import { cn } from "@/lib/cn";
import { freshness } from "@/lib/freshness";
import { change, direction, percent, spokenChange } from "@/lib/format";

const arrow = { up: "▲", down: "▼", flat: "■" } as const;
const tone = { up: "text-gain", down: "text-loss", flat: "text-unchanged" } as const;
const pillTone = { up: "bg-gain-subtle", down: "bg-loss-subtle", flat: "bg-sunken" } as const;

/**
 * Direction is never colour alone: arrow + sign + value, with the direction spelled out
 * for screen readers ("down 3.10 naira, minus 0.45 percent").
 */
export function PriceChange({
  abs,
  pct,
  variant = "inline",
  className,
}: {
  abs?: number | null;
  pct?: number | null;
  variant?: "inline" | "pill";
  className?: string;
}) {
  const dir = direction(pct ?? abs);
  const parts = [abs !== undefined ? change(abs) : null, pct !== undefined ? percent(pct) : null].filter(Boolean);
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 whitespace-nowrap",
        tone[dir],
        variant === "pill" && cn("rounded-full px-2 py-0.5 text-sm", pillTone[dir]),
        className,
      )}
    >
      <span aria-hidden>{arrow[dir]}</span>
      <span aria-hidden>{parts.join(" · ")}</span>
      <span className="sr-only">{spokenChange(abs, pct)}</span>
    </span>
  );
}

/** "Data as of 14:35 WAT · 26 Oct"; warning-coloured when over 2 h old in market hours. */
export function FreshnessStamp({ className }: { className?: string }) {
  const { data } = useMarketStatus();
  if (!data) return null;
  const f = freshness(data);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs", f.stale ? "text-warning" : "text-fg-muted", className)}
      title={f.stale ? "Prices may be delayed: the last update is more than 2 hours old." : undefined}
    >
      <Clock aria-hidden className="size-3.5" />
      <span>{f.text}</span>
      {f.stale && <span>· Data may be delayed</span>}
    </span>
  );
}
