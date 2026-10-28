import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { MINUS } from "@/lib/format";

import { Card } from "./feedback";

/**
 * KPI tile (docs/06 §6): eyebrow label, Mono value, optional delta vs a named period.
 * Deltas here are neutral-coloured: more value traded isn't "good" the way a price gain is.
 */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  /** Percent change vs the comparison period */
  delta?: number | null;
  deltaLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-1 p-4", className)}>
      <p className="eyebrow text-fg-muted">{label}</p>
      <p className="num text-2xl font-medium text-fg md:text-3xl">{value}</p>
      {delta !== undefined && delta !== null && Number.isFinite(delta) && (
        <p className="text-xs text-fg-2">
          <span aria-hidden>{delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} </span>
          <span className="num">
            {delta > 0 ? "+" : delta < 0 ? MINUS : ""}
            {Math.abs(delta).toFixed(1)}%
          </span>{" "}
          <span className="sr-only">{delta > 0 ? "higher" : delta < 0 ? "lower" : "unchanged"}</span>
          {deltaLabel}
        </p>
      )}
      {children}
    </Card>
  );
}
