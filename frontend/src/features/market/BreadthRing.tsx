/**
 * Breadth at a glance (US-2.1): a ring split into risers, unchanged and fallers, with the counts
 * in text beside it. Colour is never the only signal: the legend spells every number out, and
 * "up"/"down" link to the price list sorted that way.
 */
import { Link } from "react-router";

import type { Totals } from "@/lib/market";

const R = 52;
const C = 2 * Math.PI * R;
const GAP = 4; // px of track between segments

function Arc({ from, length, className }: { from: number; length: number; className: string }) {
  if (length <= 0) return null;
  const visible = Math.max(length - GAP, 1);
  return (
    <circle
      cx={66}
      cy={66}
      r={R}
      fill="none"
      stroke="currentColor"
      strokeWidth={14}
      strokeLinecap="round"
      strokeDasharray={`${visible} ${C - visible}`}
      strokeDashoffset={-from}
      transform="rotate(-90 66 66)"
      className={className}
    />
  );
}

export function BreadthRing({ t, stocksHref }: { t: Totals; stocksHref: (patch: Record<string, string>) => string }) {
  const total = t.up + t.down + t.flat || 1;
  const up = (t.up / total) * C;
  const flat = (t.flat / total) * C;
  const down = (t.down / total) * C;
  const link = "font-medium underline-offset-2 hover:underline";
  return (
    <div className="flex items-center gap-5 sm:flex-col sm:gap-4">
      <svg
        role="img"
        aria-label={`Breadth: ${t.up} rose, ${t.down} fell, ${t.flat} unchanged`}
        width={132}
        height={132}
        viewBox="0 0 132 132"
        className="shrink-0 max-sm:size-28"
      >
        <circle cx={66} cy={66} r={R} fill="none" strokeWidth={14} className="stroke-line-subtle" />
        <Arc from={0} length={up} className="text-gain" />
        <Arc from={up} length={flat} className="text-line" />
        <Arc from={up + flat} length={down} className="text-loss" />
        <text x={66} y={64} textAnchor="middle" className="num fill-fg text-2xl font-semibold">
          {t.up}:{t.down}
        </text>
        <text x={66} y={84} textAnchor="middle" className="fill-fg-muted text-xs">
          rose : fell
        </text>
      </svg>
      <ul className="flex flex-col gap-1.5 text-sm text-fg-2 sm:flex-row sm:gap-4">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-sm bg-gain" />
          <Link to={stocksHref({ sort: "-pct" })} className={link}>
            {t.up} up
          </Link>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-sm bg-loss" />
          <Link to={stocksHref({ sort: "pct" })} className={link}>
            {t.down} down
          </Link>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-sm bg-line" />
          {t.flat} flat
        </li>
      </ul>
    </div>
  );
}
