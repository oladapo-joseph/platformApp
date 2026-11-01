/**
 * AI usage (US-7.5): readings per day, new vs shared from the cache, the cache hit rate, who asks
 * most, and tokens with an estimated cost per provider and model.
 */
import { useAiUsage } from "@/api/admin";
import type { AiUsage } from "@/api/types";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { StatTile } from "@/components/ui/StatTile";
import { modelName } from "@/lib/ai";
import { day, isoDay } from "@/lib/dates";

import { Section } from "./shared";

const n = (v: number) => v.toLocaleString("en-NG");

function fill(daily: AiUsage["daily"], days: number): AiUsage["daily"] {
  const seen = new Map(daily.map((d) => [d.day, d]));
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => {
    const key = isoDay(new Date(now - (days - 1 - i) * 86_400_000)) ?? "";
    return seen.get(key) ?? { day: key, generated: 0, cached: 0, failed: 0 };
  });
}

function DailyReadings({ daily, days }: { daily: AiUsage["daily"]; days: number }) {
  const all = fill(daily, days);
  const max = Math.max(1, ...all.map((d) => d.generated + d.cached));
  const w = 100 / all.length;
  return (
    <figure>
      <div className="mb-2 flex gap-4 text-xs text-fg-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-ai" /> New readings
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-ai/40" /> Shared from the cache
        </span>
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-32 w-full" aria-hidden>
        <line x1={0} x2={100} y1={39.8} y2={39.8} className="stroke-line" strokeWidth={0.4} />
        {all.map((d, i) => {
          if (!d.generated && !d.cached) return null;
          const hg = (d.generated / max) * 38;
          const hc = (d.cached / max) * 38;
          const x = i * w + w * 0.15;
          return (
            <g key={d.day}>
              <title>{`${day(d.day)}: ${d.generated} new, ${d.cached} shared`}</title>
              {hg > 0 && <rect x={x} y={40 - hg} width={w * 0.7} height={hg} className="fill-ai" />}
              {hc > 0 && (
                <rect x={x} y={40 - hg - hc} width={w * 0.7} height={Math.max(hc - 0.4, 0.2)} className="fill-ai/40" />
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-fg-muted">
        <span>{all[0] && day(all[0].day)}</span>
        <span>Readings per day (most {max})</span>
        <span>{all.at(-1) && day(all.at(-1)?.day)}</span>
      </figcaption>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-fg-2">Show as a table</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-xs text-fg-muted">
            <tr>
              <th scope="col" className="py-1 font-medium">
                Day
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                New
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Shared
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Failed
              </th>
            </tr>
          </thead>
          <tbody className="num">
            {daily.map((d) => (
              <tr key={d.day} className="border-t border-line-subtle">
                <th scope="row" className="py-1 font-normal">
                  {day(d.day)}
                </th>
                <td className="py-1 text-right">{d.generated}</td>
                <td className="py-1 text-right">{d.cached}</td>
                <td className="py-1 text-right">{d.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function AiUsageSection({ days }: { days: number }) {
  const q = useAiUsage(days);
  const u = q.data;
  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.error || !u)
    return <ErrorState error={q.error} onRetry={() => void q.refetch()} title="AI usage didn't load" />;
  const model = u.model ? `${modelName(u.model)} (${u.provider})` : "off";
  return (
    <Section
      title="AI readings"
      description={u.enabled ? `Answered by ${model}. Shared readings don't use anyone's allowance.` : "AI is off."}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="New readings" value={n(u.generated)} />
        <StatTile label="Shared from cache" value={n(u.cached)} />
        <StatTile label="Cache hit rate" value={u.hit_rate === null ? "—" : `${Math.round(u.hit_rate * 100)}%`} />
        <StatTile label="Failed · limit hits" value={`${n(u.failed)} · ${n(u.quota_hits)}`} />
      </div>
      {u.generated + u.cached > 0 ? (
        <div className="mt-5 flex flex-col gap-6">
          <DailyReadings daily={u.daily} days={days} />
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="eyebrow text-fg-muted">Who asks most</h3>
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-xs text-fg-muted">
                  <tr>
                    <th scope="col" className="py-1 font-medium">
                      Person
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      New
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      Shared
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {u.top_users.map((p) => (
                    <tr key={p.user_id} className="border-t border-line-subtle">
                      <th scope="row" className="py-1.5 font-normal">
                        <span className="block text-fg">{p.name ?? "—"}</span>
                        <span className="block text-xs text-fg-muted">{p.email ?? "deleted account"}</span>
                      </th>
                      <td className="num py-1.5 text-right">{p.generated}</td>
                      <td className="num py-1.5 text-right">{p.cached}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="eyebrow text-fg-muted">Tokens and estimated cost</h3>
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-xs text-fg-muted">
                  <tr>
                    <th scope="col" className="py-1 font-medium">
                      Model
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      Readings
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      Tokens in · out
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      Est. cost
                    </th>
                  </tr>
                </thead>
                <tbody className="num">
                  {u.models.map((m) => (
                    <tr key={`${m.provider}-${m.model}`} className="border-t border-line-subtle">
                      <th scope="row" className="py-1.5 font-sans font-normal">
                        {modelName(m.model)}
                      </th>
                      <td className="py-1.5 text-right">{n(m.readings)}</td>
                      <td className="py-1.5 text-right">
                        {n(m.tokens_in)} · {n(m.tokens_out)}
                      </td>
                      <td className="py-1.5 text-right">
                        {m.est_cost_usd === null ? "—" : `$${m.est_cost_usd.toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-fg-muted">
                From list prices, including attempts that failed; the provider's bill is the final word.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-fg-muted">No AI readings in this period.</p>
      )}
    </Section>
  );
}
