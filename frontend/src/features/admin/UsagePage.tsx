/**
 * Usage (US-7.8): which pages and features people use and how they move through the app, from
 * pseudonymous first-party events (no IP, no names). Kept 90 days.
 */
import { ArrowRight, BarChart3 } from "lucide-react";
import { useSearchParams } from "react-router";

import { useUsage } from "@/api/admin";
import type { Usage } from "@/api/types";
import { SegmentedControl } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { StatTile } from "@/components/ui/StatTile";
import { day, isoDay } from "@/lib/dates";
import { featureName, pageName } from "@/lib/analytics-names";

import { AiUsageSection } from "./AiUsageSection";
import { Section } from "./shared";

const PERIODS: { value: "7" | "30" | "90"; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

/** Every WAT day of the period, oldest first, with zeros where nobody came (so one busy day isn't one huge bar). */
function fillDays(daily: Usage["daily"], days: number): Usage["daily"] {
  const seen = new Map(daily.map((d) => [d.day, d]));
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => {
    const key = isoDay(new Date(now - (days - 1 - i) * 86_400_000)) ?? "";
    return seen.get(key) ?? { day: key, users: 0, sessions: 0, page_views: 0 };
  });
}

function DailyChart({ daily, days }: { daily: Usage["daily"]; days: number }) {
  const all = fillDays(daily, days);
  const max = Math.max(1, ...all.map((d) => d.users));
  const w = 100 / all.length;
  return (
    <figure>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-36 w-full" aria-hidden>
        <line x1={0} x2={100} y1={39.8} y2={39.8} className="stroke-line" strokeWidth={0.4} />
        {all.map((d, i) => {
          if (!d.users) return null;
          const h = (d.users / max) * 38;
          return (
            <rect
              key={d.day}
              x={i * w + w * 0.15}
              y={40 - h}
              width={w * 0.7}
              height={h}
              rx={0.6}
              className="fill-brand"
            >
              <title>{`${day(d.day)}: ${d.users} users, ${d.sessions} sessions, ${d.page_views} page views`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-fg-muted">
        <span>{all[0] && day(all[0].day)}</span>
        <span>Active users per day (most {max})</span>
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
                Users
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Sessions
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Page views
              </th>
            </tr>
          </thead>
          <tbody className="num">
            {daily.map((d) => (
              <tr key={d.day} className="border-t border-line-subtle">
                <th scope="row" className="py-1 font-normal">
                  {day(d.day)}
                </th>
                <td className="py-1 text-right">{d.users}</td>
                <td className="py-1 text-right">{d.sessions}</td>
                <td className="py-1 text-right">{d.page_views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** A ranked list with a thin bar for magnitude; the numbers are always in text. `unit` is plural ("views"). */
function Ranked({ rows, unit }: { rows: { label: string; value: number; note?: string }[]; unit: string }) {
  if (!rows.length) return <p className="py-4 text-sm text-fg-muted">Nothing yet.</p>;
  const top = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-fg">{r.label}</span>
            <span className="num shrink-0 text-fg-2">
              {r.value.toLocaleString("en-NG")} {r.value === 1 ? unit.replace(/s$/, "") : unit}
              {r.note && <span className="text-fg-muted"> · {r.note}</span>}
            </span>
          </div>
          <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sunken">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${(r.value / top) * 100}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

export default function UsagePage() {
  const [params, setParams] = useSearchParams();
  const days = PERIODS.find((p) => p.value === params.get("days"))?.value ?? "30";
  const usage = useUsage(Number(days));
  const u = usage.data;

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-sm text-fg-2">
        From the signed-in app: pages people open and features they use. Pseudonymous (no names, no IP addresses);
        people can turn it off in Account.
      </p>
      <SegmentedControl
        label="Period"
        value={days}
        onChange={(v) => setParams(v === "30" ? {} : { days: v }, { replace: true })}
        options={PERIODS}
      />
    </div>
  );

  if (usage.isPending) {
    return (
      <div aria-busy>
        {header}
        <span className="sr-only">Loading usage</span>
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (usage.error || !u) {
    return <ErrorState error={usage.error} onRetry={() => void usage.refetch()} title="Usage didn't load" />;
  }
  if (!u.page_views && !u.features.length) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          {header}
          <EmptyState icon={BarChart3} title="No usage recorded yet">
            Events appear here as people use the app.
          </EmptyState>
        </div>
        <AiUsageSection days={Number(days)} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {header}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active users" value={u.users.toLocaleString("en-NG")} />
        <StatTile label="Sessions" value={u.sessions.toLocaleString("en-NG")} />
        <StatTile label="Page views" value={u.page_views.toLocaleString("en-NG")} />
        <StatTile label="Pages per session" value={u.pages_per_session?.toFixed(1) ?? "—"} />
      </div>
      <Section title="Active users">
        <DailyChart daily={u.daily} days={Number(days)} />
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Most visited pages" description="Views, people, and average time on the page.">
          <Ranked
            unit="views"
            rows={u.pages.map((p) => ({
              label: pageName(p.path),
              value: p.views,
              note: [people(p.users), p.avg_seconds !== null && `${Math.round(p.avg_seconds ?? 0)} s`]
                .filter(Boolean)
                .join(" · "),
            }))}
          />
        </Section>
        <Section title="Most used features">
          <Ranked
            unit="times"
            rows={u.features.map((f) => ({ label: featureName(f.key), value: f.count, note: people(f.users) }))}
          />
        </Section>
        <Section title="Where sessions start">
          <Ranked unit="sessions" rows={u.entries.map((e) => ({ label: pageName(e.key), value: e.count }))} />
        </Section>
        <Section title="Phone or desktop">
          <Ranked
            unit="sessions"
            rows={u.devices.map((d) => ({ label: d.key, value: d.count, note: people(d.users) }))}
          />
        </Section>
      </div>
      <Section title="How people move" description="The most common steps from one page to the next.">
        {u.transitions.length ? (
          <ol className="divide-y divide-line-subtle text-sm">
            {u.transitions.map((t) => (
              <li key={`${t.source}>${t.target}`} className="flex items-center gap-2 py-2">
                <span className="text-fg">{pageName(t.source)}</span>
                <ArrowRight aria-label="to" className="size-4 shrink-0 text-fg-muted" />
                <span className="min-w-0 flex-1 text-fg">{pageName(t.target)}</span>
                <span className="num text-fg-2">{t.count.toLocaleString("en-NG")}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-fg-muted">Nothing yet.</p>
        )}
      </Section>
      <Section title="Typical journeys" description="The first pages of a session, most common first.">
        {u.journeys.length ? (
          <ol className="flex flex-col gap-2 text-sm">
            {u.journeys.map((j) => (
              <li key={j.steps.join(">")} className="flex flex-wrap items-center gap-2">
                {j.steps.map((s, i) => (
                  <span key={`${s}-${i}`} className="flex items-center gap-2">
                    {i > 0 && <ArrowRight aria-label="then" className="size-4 text-fg-muted" />}
                    <span className="rounded-md bg-sunken px-2 py-0.5 text-fg">{pageName(s)}</span>
                  </span>
                ))}
                <span className="num ml-auto text-fg-2">
                  {j.sessions} session{j.sessions === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-fg-muted">Nothing yet.</p>
        )}
      </Section>
      <AiUsageSection days={Number(days)} />
    </div>
  );
}
