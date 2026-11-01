/**
 * What a strategy looks for (US-3.6): 2–3 sentences, a small diagram of the crossing it marks,
 * what it's good at and where it fails, and a link to the glossary (US-6.5).
 */
import { Info } from "lucide-react";
import { Link } from "react-router";

interface Guide {
  how: string;
  goodAt: string;
  failsWhen: string;
  glossary: { id: string; label: string };
  diagram: "macd" | "rsi" | "sma";
}

const GUIDES: Record<string, Guide> = {
  macd_crossover: {
    how: "MACD is the gap between the 12- and 26-day averages, and its signal line is a 9-day average of that gap. A bullish crossover is MACD rising through the signal line, a sign momentum is turning up; a bearish crossover is the reverse.",
    goodAt: "catching turns in momentum in stocks that trend.",
    failsWhen:
      "trading is flat or choppy: it flips back and forth, and it always reacts after the price has started to move.",
    glossary: { id: "macd", label: "MACD" },
    diagram: "macd",
  },
  rsi_reversal: {
    how: "RSI scores recent gains against losses from 0 to 100 over 14 sessions. This strategy marks a bullish signal when RSI climbs back above 30 after being oversold, and a bearish one when it drops back below 70 after being overbought.",
    goodAt: "spotting stretched moves that are starting to ease, in stocks that swing within a range.",
    failsWhen: "a stock trends strongly: RSI can stay above 70 or below 30 for weeks, so signals come early.",
    glossary: { id: "rsi", label: "RSI" },
    diagram: "rsi",
  },
  sma_golden_cross: {
    how: "Compares the 50-day average with the 200-day average. When the 50-day crosses above the 200-day (a golden cross), the medium-term trend has turned up through the long-term one; a death cross is the reverse.",
    goodAt: "confirming large, lasting changes in trend.",
    failsWhen:
      "you need speed: it fires late, after much of the move, and needs about 200 sessions of history before it can fire at all.",
    glossary: { id: "golden-cross", label: "golden cross" },
    diagram: "sma",
  },
};

/** The crossing each strategy marks, in the chart's own colours; decorative (the text says it all). */
function Diagram({ kind }: { kind: Guide["diagram"] }) {
  const dot = (x: number, y: number) => (
    <circle cx={x} cy={y} r={3.5} className="fill-ai stroke-surface" strokeWidth={2} />
  );
  return (
    <svg aria-hidden viewBox="0 0 160 64" className="h-16 w-40 shrink-0 rounded-md bg-sunken">
      {kind === "rsi" ? (
        <>
          <line x1={6} x2={154} y1={16} y2={16} className="stroke-fg-muted" strokeDasharray="3 3" strokeWidth={1} />
          <line x1={6} x2={154} y1={48} y2={48} className="stroke-fg-muted" strokeDasharray="3 3" strokeWidth={1} />
          <text x={150} y={13} textAnchor="end" className="fill-fg-muted text-[8px]">
            70
          </text>
          <text x={150} y={60} textAnchor="end" className="fill-fg-muted text-[8px]">
            30
          </text>
          <path
            d="M6 30 C30 40, 44 58, 62 56 S 84 46, 92 48 S 120 30, 154 26"
            className="fill-none stroke-brand"
            strokeWidth={2}
          />
          {dot(92, 48)}
        </>
      ) : (
        <>
          {/* the slower line: signal line (MACD) or 200-day average (SMA) */}
          <path
            d={kind === "macd" ? "M6 22 C40 26, 70 36, 90 38 S 130 36, 154 30" : "M6 30 C50 33, 90 34, 154 32"}
            className="fill-none stroke-fg-muted"
            strokeDasharray={kind === "macd" ? "4 3" : undefined}
            strokeWidth={2}
          />
          {/* the faster line: MACD or the 50-day average, crossing up through it */}
          <path
            d={
              kind === "macd"
                ? "M6 14 C30 30, 56 54, 78 50 S 112 26, 154 12"
                : "M6 52 C40 50, 70 44, 98 34 S 130 18, 154 14"
            }
            className="fill-none stroke-brand"
            strokeWidth={2}
          />
          {kind === "macd" ? dot(104, 38.4) : dot(97, 34)}
        </>
      )}
    </svg>
  );
}

export function StrategyExplainer({ slug, label }: { slug: string; label: string }) {
  const g = GUIDES[slug];
  if (!g) return null;
  return (
    <details className="group rounded-md bg-sunken/60 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
        <Info aria-hidden className="size-4 text-fg-muted" />
        How {label} works
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3 sm:flex-row sm:items-start">
        <Diagram kind={g.diagram} />
        <div className="flex flex-col gap-1.5 text-fg-2">
          <p>{g.how}</p>
          <p>
            <span className="font-medium text-fg">Good at:</span> {g.goodAt}{" "}
            <span className="font-medium text-fg">Where it fails:</span> {g.failsWhen}
          </p>
          <Link to={`/app/help#${g.glossary.id}`} className="w-fit font-medium text-brand underline underline-offset-2">
            {g.glossary.label} in the glossary
          </Link>
        </div>
      </div>
    </details>
  );
}
