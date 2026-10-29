import { cn } from "@/lib/cn";

/**
 * A tiny trend line with a soft fill (docs/06 §6 StatTile). Decorative: the tile states the
 * value and its change in text, so the line is hidden from assistive tech. Colour comes from
 * `currentColor`, so callers set it with a text token.
 */
export function Sparkline({
  values,
  width = 112,
  height = 36,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(" ");
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <polygon points={`${line} ${width},${height} 0,${height}`} fill="currentColor" opacity={0.14} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={width} cy={points.at(-1)?.split(",")[1]} r={3} fill="currentColor" />
    </svg>
  );
}
