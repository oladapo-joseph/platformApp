/** The diverging loss → neutral → gain scale for sector heat, read from the chart tokens (docs/06 §2.3). */
import { useMemo } from "react";

import { useCssVars } from "./hooks";

export const HEAT_CLAMP = 5;
const TOKENS = [
  "--chart-up",
  "--chart-down",
  "--chart-heat-neutral",
  "--color-text-primary",
  "--color-text-inverse",
  "--color-bg-surface",
] as const;

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return Number.isNaN(n) ? [128, 128, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toCss = ([r, g, b]: Rgb) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: Rgb, b: Rgb) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
};

/** Fill for a % change, plus whichever text token reads best on it. */
export function useHeatScale() {
  const t = useCssVars(TOKENS);
  return useMemo(() => {
    const up = parseHex(t["--chart-up"]);
    const down = parseHex(t["--chart-down"]);
    const mid = parseHex(t["--chart-heat-neutral"]);
    const ink = [parseHex(t["--color-text-primary"]), parseHex(t["--color-text-inverse"])] as const;
    const fill = (pct: number | null): Rgb => {
      if (pct === null) return mid;
      const k = Math.min(Math.abs(pct) / HEAT_CLAMP, 1);
      return mix(mid, pct >= 0 ? up : down, k);
    };
    return {
      fill: (pct: number | null) => toCss(fill(pct)),
      ink: (pct: number | null) => {
        const f = fill(pct);
        return toCss(contrast(ink[0], f) >= contrast(ink[1], f) ? ink[0] : ink[1]);
      },
      gradient: `linear-gradient(to right, ${toCss(down)}, ${toCss(mid)}, ${toCss(up)})`,
      surface: t["--color-bg-surface"],
    };
  }, [t]);
}
