/** PriceChange and FreshnessStamp: the two data primitives every screen uses (docs/06 §6). */
import { Clock } from "lucide-react";

import { useMarketStatus } from "@/api/market";
import { cn } from "@/lib/cn";
import { freshness } from "@/lib/freshness";
import { change, direction, percent, spokenChange } from "@/lib/format";

const arrow = { up: "▲", down: "▼", flat: "■" } as const;
const tone = { up: "text-gain", down: "text-loss", flat: "text-unchanged" } as const;
// The tints are translucent: over the page canvas they'd darken enough to fail 4.5:1 in the
// light theme, so pills sit on an opaque surface base (globals.css .pill-tint).
const pillTone = {
  up: "pill-tint [--pill-tint:var(--color-gain-subtle)]",
  down: "pill-tint [--pill-tint:var(--color-loss-subtle)]",
  flat: "bg-sunken",
} as const;
// Solid pills for ranked lists: the strongest emphasis, text ≥ 7:1 on the fill in both themes
const solidTone = {
  up: "bg-gain-pill text-on-gain-pill",
  down: "bg-loss-pill text-on-loss-pill",
  flat: "bg-sunken text-fg-2",
} as const;

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
  variant?: "inline" | "pill" | "solid";
  className?: string;
}) {
  const dir = direction(pct ?? abs);
  const parts = [abs !== undefined ? change(abs) : null, pct !== undefined ? percent(pct) : null].filter(Boolean);
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 whitespace-nowrap",
        variant === "solid" ? solidTone[dir] : tone[dir],
        variant === "pill" && cn("rounded-full px-2 py-0.5 text-sm", pillTone[dir]),
        variant === "solid" && "justify-center rounded-lg px-2 py-1 text-xs font-semibold",
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
