/**
 * AI overview of a comparison (US-4.7), in the AI card's style (docs/06 AIInsightCard): asked for,
 * never automatic; the model, time, data date and disclaimer always in view; hidden when AI is
 * off. It describes how the stocks compare, never which to choose. One overview uses one of the
 * day's readings, like a stock reading.
 */
import { ExternalLink, Sparkles } from "lucide-react";
import { useId } from "react";

import { ApiError } from "@/api/client";
import { useAiStatus } from "@/api/insights";
import { useCompareInsight } from "@/api/screener";
import type { CompareInsight } from "@/api/types";
import { DISCLAIMER } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Card, Skeleton } from "@/components/ui/feedback";
import { modelName } from "@/lib/ai";
import { day, stamp } from "@/lib/dates";

const UNAVAILABLE = "AI overviews are unavailable right now. The comparison still works.";

export function CompareAiCard({
  symbols,
  start,
  end,
  latest,
}: {
  symbols: string[];
  start: string | null;
  end: string | null;
  latest: string | null;
}) {
  const headingId = useId();
  const status = useAiStatus();
  const insight = useCompareInsight(symbols, start, end);
  if (!status.data?.enabled) return null; // US-4.5: off means hidden, not broken

  const quota = status.data.quota;
  const ask = () => void insight.refetch();
  const r = insight.data;
  const error = insight.error;
  const outOfReadings = error instanceof ApiError && error.slug === "ai-quota";
  const busy = insight.isFetching;
  const names = symbols.join(", ");

  let announce = "";
  if (busy) announce = `Comparing ${names}…`;
  else if (error) announce = outOfReadings ? error.detail : UNAVAILABLE;
  else if (r) announce = "AI overview ready.";

  return (
    <Card aria-labelledby={headingId} role="region" className="border-ai/30 p-4">
      <h2 id={headingId} className="flex items-center gap-2 font-headline text-lg font-semibold text-fg">
        <Sparkles aria-hidden className="size-5 text-ai" />
        AI overview
      </h2>
      <p role="status" className="sr-only">
        {announce}
      </p>

      {symbols.length < 2 ? (
        <p className="mt-2 text-sm text-fg-2">Add another stock to get an AI overview of how they compare.</p>
      ) : busy ? (
        <div aria-busy className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-ai">Comparing {names}…</p>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : r ? (
        <Overview insight={r} latest={latest} onRefresh={ask} />
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
            A plain-English overview of how {names} compare over this period: returns against their sectors, risk,
            trading and what their indicators show. It describes the picture; it doesn't tell you which to choose.
          </p>
          {quota && quota.remaining > 0 && !outOfReadings ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={ask}
                icon={<Sparkles aria-hidden className="size-4 text-ai" />}
                aria-describedby={`${headingId}-left`}
              >
                Get an AI overview
              </Button>
              <span id={`${headingId}-left`} className="text-xs text-fg-muted">
                Uses 1 of your {quota.remaining} readings left today
              </span>
            </div>
          ) : (
            <>
              <p className="text-sm text-fg">
                You've used today's {quota?.limit ?? ""} readings. They reset at midnight WAT.
              </p>
              {!outOfReadings && (
                <Button variant="ghost" size="sm" onClick={ask}>
                  Show a saved overview, if there is one
                </Button>
              )}
              {outOfReadings && (
                <p className="text-xs text-fg-muted">There's no saved overview for these stocks yet.</p>
              )}
            </>
          )}
        </div>
      )}

      <p className="mt-4 border-t border-line-subtle pt-3 text-xs text-fg-muted">{DISCLAIMER}</p>
    </Card>
  );
}

function Overview({
  insight: i,
  latest,
  onRefresh,
}: {
  insight: CompareInsight;
  latest: string | null;
  onRefresh: () => void;
}) {
  const r = i.reading;
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
      <p className="text-base leading-relaxed text-fg">{r.summary}</p>

      <section>
        <h3 className="eyebrow text-fg-muted">Each stock</h3>
        <dl className="mt-1 grid gap-2 md:grid-cols-2">
          {r.stocks.map((n) => (
            <div key={n.symbol} className="rounded-md bg-sunken px-3 py-2">
              <dt className="num font-medium text-fg">{n.symbol}</dt>
              <dd className="text-fg-2">{n.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="eyebrow text-fg-muted">What sets them apart</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-fg-2">
          {r.differences.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
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
        {day(i.start)} to {day(i.end)}
        {i.cached && " · A shared overview: it didn't use one of yours"}
      </p>
    </div>
  );
}
