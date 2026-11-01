/**
 * AI signal interpretation (US-4.1 – US-4.5, US-9.5; docs/06 AIInsightCard): asked for, never
 * automatic; violet AI treatment; the model, time, data date and disclaimer always in view.
 * Hidden when AI is off. A reading describes what the signals show, never what to do.
 */
import { ExternalLink, Sparkles } from "lucide-react";
import { useId } from "react";

import { ApiError } from "@/api/client";
import { useAiStatus, useInsight } from "@/api/insights";
import type { Insight } from "@/api/types";
import { DISCLAIMER } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Badge, Card, Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { modelName } from "@/lib/ai";
import { day, stamp } from "@/lib/dates";
import { price } from "@/lib/format";
import { rangeWords, type ChartRange } from "@/lib/stock";

const UNAVAILABLE = "AI readings are unavailable right now. Charts and signals still work.";

function reading(range: ChartRange, symbol: string): string {
  if (range === "ALL") return `Reading all of ${symbol}'s history…`;
  if (range === "YTD") return `Reading ${symbol}'s data for this year…`;
  return `Reading ${rangeWords(range)} of ${symbol} data…`;
}

const STANCE = {
  bullish: { tone: "gain", mark: "▲", label: "Bullish" },
  bearish: { tone: "loss", mark: "▼", label: "Bearish" },
  neutral: { tone: "neutral", mark: "●", label: "Neutral" },
} as const;

export function AiInsightCard({
  symbol,
  strategy,
  strategyLabel,
  range,
  start,
  end,
  latest,
  className,
}: {
  symbol: string;
  strategy: string;
  strategyLabel: string;
  range: ChartRange;
  start: string | null;
  end: string | null;
  latest: string | null;
  className?: string;
}) {
  const headingId = useId();
  const status = useAiStatus();
  const insight = useInsight({ symbol, strategy, range, start, end });
  if (!status.data?.enabled) return null; // US-4.5: off means hidden, not broken

  const quota = status.data.quota;
  const ask = () => void insight.refetch();
  const r = insight.data;
  const error = insight.error;
  const outOfReadings = error instanceof ApiError && error.slug === "ai-quota";
  const busy = insight.isFetching;

  let announce = "";
  if (busy) announce = reading(range, symbol);
  else if (error) announce = outOfReadings ? error.detail : UNAVAILABLE;
  else if (r) announce = "AI reading ready.";

  return (
    <Card aria-labelledby={headingId} role="region" className={cn("border-ai/30 p-4", className)}>
      <h2 id={headingId} className="flex items-center gap-2 font-headline text-lg font-semibold text-fg">
        <Sparkles aria-hidden className="size-5 text-ai" />
        AI signal interpretation
      </h2>
      <p role="status" className="sr-only">
        {announce}
      </p>

      {busy ? (
        <div aria-busy className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-ai">{reading(range, symbol)}</p>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : r ? (
        <Reading insight={r} range={range} latest={latest} onRefresh={ask} />
      ) : error && !outOfReadings ? (
        <div className="mt-3 flex flex-col items-start gap-3">
          <p className="text-sm text-fg-2">
            {error instanceof ApiError && error.status === 400 ? error.detail : UNAVAILABLE}
          </p>
          <Button variant="secondary" size="sm" onClick={ask}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex flex-col items-start gap-3">
          <p className="text-sm text-fg-2">
            A plain-English reading of what the {strategyLabel} signals and the indicators show for {symbol} over{" "}
            {range === "ALL" ? "all history" : rangeWords(range)}. It describes the picture; it doesn't tell you what to
            do.
          </p>
          {quota && quota.remaining > 0 && !outOfReadings ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={ask}
                icon={<Sparkles aria-hidden className="size-4 text-ai" />}
                aria-describedby={`${headingId}-left`}
              >
                Explain these signals
              </Button>
              <span id={`${headingId}-left`} className="text-xs text-fg-muted">
                {quota.remaining} of {quota.limit} left today
              </span>
            </div>
          ) : (
            <>
              <p className="text-sm text-fg">
                You've used today's {quota?.limit ?? ""} readings. They reset at midnight WAT.
              </p>
              {!outOfReadings && (
                <Button variant="ghost" size="sm" onClick={ask}>
                  Show a saved reading, if there is one
                </Button>
              )}
              {outOfReadings && <p className="text-xs text-fg-muted">There's no saved reading for this view yet.</p>}
            </>
          )}
        </div>
      )}

      <p className="mt-4 border-t border-line-subtle pt-3 text-xs text-fg-muted">{DISCLAIMER}</p>
    </Card>
  );
}

function Reading({
  insight: i,
  range,
  latest,
  onRefresh,
}: {
  insight: Insight;
  range: ChartRange;
  latest: string | null;
  onRefresh: () => void;
}) {
  const r = i.reading;
  const stance = STANCE[r.stance];
  const cited = new Set(r.sources);
  const newer = !!latest && i.data_as_of < latest;
  return (
    <div className="mt-3 flex flex-col gap-4 text-sm">
      {newer && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning-subtle px-3 py-2">
          <span className="text-fg">Newer data available</span>
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={stance.tone} className="text-sm">
          <span aria-hidden>{stance.mark}</span>
          {stance.label}
        </Badge>
        <Badge tone="ai">Confidence: {r.confidence}</Badge>
      </div>
      <p className="text-base leading-relaxed text-fg">{r.summary}</p>

      <section>
        <h3 className="eyebrow text-fg-muted">What the signals show</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-fg-2">
          {r.drivers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="eyebrow text-fg-muted">Key levels</h3>
        <dl className="mt-1 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-sunken px-3 py-2">
            <dt className="text-xs text-fg-muted">Support</dt>
            <dd className="num text-fg">{price(r.key_levels.support)}</dd>
          </div>
          <div className="rounded-md bg-sunken px-3 py-2">
            <dt className="text-xs text-fg-muted">Resistance</dt>
            <dd className="num text-fg">{price(r.key_levels.resistance)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="eyebrow text-fg-muted">Keep in mind</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-fg-2">
          {r.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="eyebrow text-fg-muted">Headlines considered</h3>
        {i.headlines.length ? (
          <>
            {r.news_context && <p className="mt-1 text-fg-2">{r.news_context}</p>}
            <ul className="mt-1 space-y-1.5">
              {i.headlines.map((h) => (
                <li key={h.id}>
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fg underline decoration-line underline-offset-2 hover:text-brand"
                  >
                    {h.title}
                    <ExternalLink aria-hidden className="ml-1 inline size-3 align-baseline text-fg-muted" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <span className="block text-xs text-fg-muted">
                    {h.source}
                    {h.published_at && ` · ${day(h.published_at)}`}
                    {cited.has(h.id) && " · drawn on"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-fg-2">No recent headlines were available.</p>
        )}
      </section>

      <p className="text-xs text-fg-muted">
        {modelName(i.model)} · Generated {stamp(i.generated_at)} · Based on data up to {day(i.data_as_of)} close ·{" "}
        {i.strategy_label}, {range === "ALL" ? "all history" : rangeWords(range)}
        {i.cached && " · A shared reading: it didn't use one of yours"}
      </p>
    </div>
  );
}
