import { cn } from "@/lib/cn";

/**
 * The official lockup and mark (docs/07): never re-typed. Both theme files are rendered and
 * CSS shows the one that matches the active theme (globals.css), so it never flashes.
 */
export function Logo({ variant = "horizontal", className }: { variant?: "horizontal" | "mark"; className?: string }) {
  const [file, w, h] = variant === "mark" ? ["mark", 32, 32] : ["logo-horizontal", 152, 32];
  return (
    <span className={cn("inline-flex", className)}>
      <img src={`/brand/${file}-dark.svg`} width={w} height={h} alt="EquityLens NG" className="logo-on-dark" />
      <img src={`/brand/${file}-light.svg`} width={w} height={h} alt="EquityLens NG" className="logo-on-light" />
    </span>
  );
}
