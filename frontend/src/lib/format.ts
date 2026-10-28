/**
 * Number formats from docs/06 §3: ₦ prices, signed changes with arrows, compact money and
 * volume, em dash for missing. Display uses the true minus sign (U+2212).
 */

export const MINUS = "\u2212";
export const MISSING = "—";

type Num = number | null | undefined;

const fixed2 = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact1 = new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 });

const isNum = (n: Num): n is number => typeof n === "number" && Number.isFinite(n);
const minus = (s: string) => s.replace("-", MINUS);

/** ₦1,234.50 */
export function price(n: Num): string {
  return isNum(n) ? `₦${fixed2.format(n)}` : MISSING;
}

/** +12.40 · −3.10 · 0.00 */
export function change(n: Num): string {
  if (!isNum(n)) return MISSING;
  const s = fixed2.format(Math.abs(n));
  return n > 0 ? `+${s}` : n < 0 ? `${MINUS}${s}` : s;
}

/** +2.31% · −0.45% · 0.00% */
export function percent(n: Num): string {
  return isNum(n) ? `${change(n)}%` : MISSING;
}

/** ₦1.2B · ₦845.3M · ₦12.4K */
export function money(n: Num): string {
  if (!isNum(n)) return MISSING;
  const s = compact1.format(Math.abs(n));
  return `${n < 0 ? MINUS : ""}₦${s}`;
}

/** 12.4M */
export function volume(n: Num): string {
  return isNum(n) ? minus(compact1.format(n)) : MISSING;
}

export type Direction = "up" | "down" | "flat";

export function direction(n: Num): Direction {
  if (!isNum(n) || n === 0) return "flat";
  return n > 0 ? "up" : "down";
}

/** Screen-reader wording: "down 3.10 naira, minus 0.45 percent" (docs/06 §3) */
export function spokenChange(abs: Num, pct: Num): string {
  const dir = direction(isNum(pct) ? pct : abs);
  if (dir === "flat") return "unchanged";
  const word = dir === "up" ? "up" : "down";
  const bits: string[] = [];
  if (isNum(abs)) bits.push(`${word} ${fixed2.format(Math.abs(abs))} naira`);
  if (isNum(pct))
    bits.push(`${bits.length ? (dir === "up" ? "plus" : "minus") : word} ${fixed2.format(Math.abs(pct))} percent`);
  return bits.join(", ");
}
