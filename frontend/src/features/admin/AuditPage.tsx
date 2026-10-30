/**
 * Audit log (US-7.7): who did what, to whom, when and from where. Read-only; filters in the URL;
 * a dense table on desktop, cards on phones; a detail drawer; CSV export (itself logged).
 */
import { Download, ScrollText, ShieldAlert, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { useAuditLog, useExportAudit } from "@/api/admin";
import type { AuditEntry, AuditQuery } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/hooks";

import { failed, inputClass, selectClass } from "./format";
import { Section, When } from "./shared";

const CATEGORIES = [
  { value: "access", label: "Access & invites" },
  { value: "sign_in", label: "Sign-in" },
  { value: "account", label: "Account" },
  { value: "admin", label: "Admin changes" },
] as const;
const FILTER_KEYS = ["from", "to", "category", "outcome", "actor", "target", "q", "user_id", "suspicious"] as const;

function readFilters(p: URLSearchParams): AuditQuery {
  const category = CATEGORIES.find((c) => c.value === p.get("category"))?.value ?? null;
  const outcome = p.get("outcome") === "success" || p.get("outcome") === "failure" ? p.get("outcome") : null;
  return {
    from: p.get("from"),
    to: p.get("to"),
    category,
    outcome: outcome as AuditQuery["outcome"],
    actor: p.get("actor"),
    target: p.get("target"),
    q: p.get("q"),
    user_id: p.get("user_id"),
    suspicious: p.get("suspicious") === "1",
  };
}

const actorName = (e: AuditEntry) =>
  e.actor.name ?? e.actor.email ?? (e.actor.kind === "system" ? "System" : "Anonymous");

function Outcome({ e }: { e: AuditEntry }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={e.outcome === "success" ? "neutral" : "danger"}>
        {e.outcome === "success" ? "Success" : "Failed"}
      </Badge>
      {e.flags.includes("suspicious") && (
        <Badge tone="danger">
          <ShieldAlert aria-hidden className="size-3" /> Suspicious
        </Badge>
      )}
    </span>
  );
}

function Detail({ e, onClose }: { e: AuditEntry | null; onClose: () => void }) {
  const rows: [string, ReactNode][] = e
    ? [
        ["Time", <When key="t" value={e.at} />],
        ["Action", `${e.description} (${e.action})`],
        ["Category", CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category],
        [
          "Actor",
          [actorName(e), e.actor.email !== actorName(e) && e.actor.email, e.actor.kind].filter(Boolean).join(" · "),
        ],
        ["Target", e.target ? [e.target.label, e.target.type].filter(Boolean).join(" · ") : "—"],
        ["Outcome", <Outcome key="o" e={e} />],
        ["IP address", e.ip ?? "—"],
        ["Browser", e.user_agent ?? "—"],
        ["Request ID", e.request_id ?? "—"],
      ]
    : [];
  return (
    <Dialog.Root open={!!e} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-canvas/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-(--z-modal) flex w-full max-w-md flex-col border-l border-line bg-raised shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line-subtle px-5 py-3">
            <Dialog.Title className="font-headline text-xl font-semibold text-fg">Event details</Dialog.Title>
            <Dialog.Close
              aria-label="Close details"
              className="touch-target flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          {e && (
            <div className="overflow-y-auto px-5 py-4">
              <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-fg-muted">{k}</dt>
                    <dd className="break-words text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
              {e.changes && (
                <>
                  <h3 className="mt-5 mb-2 text-sm font-medium text-fg">Changes</h3>
                  <pre className="num overflow-x-auto rounded-md bg-sunken p-3 text-xs text-fg-2">
                    {JSON.stringify(e.changes, null, 2)}
                  </pre>
                </>
              )}
              <p className="mt-5 text-xs text-fg-muted">
                Entries can't be edited or deleted. They're kept for 365 days.
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Filters({ f, set }: { f: AuditQuery; set: (patch: Record<string, string | null>) => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        From
        <input
          type="date"
          value={f.from ?? ""}
          onChange={(e) => set({ from: e.target.value || null })}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        To
        <input
          type="date"
          value={f.to ?? ""}
          onChange={(e) => set({ to: e.target.value || null })}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        Category
        <select
          value={f.category ?? ""}
          onChange={(e) => set({ category: e.target.value || null })}
          className={selectClass}
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        Outcome
        <select
          value={f.outcome ?? ""}
          onChange={(e) => set({ outcome: e.target.value || null })}
          className={selectClass}
        >
          <option value="">All</option>
          <option value="success">Success</option>
          <option value="failure">Failed</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        Email contains
        <input
          type="search"
          defaultValue={f.q ?? ""}
          onKeyDown={(e) => e.key === "Enter" && set({ q: e.currentTarget.value.trim() || null })}
          onBlur={(e) => set({ q: e.currentTarget.value.trim() || null })}
          placeholder="ada@"
          className={`${inputClass} w-44`}
        />
      </label>
      <label className="flex h-9 items-center gap-2 text-sm text-fg-2">
        <input
          type="checkbox"
          checked={!!f.suspicious}
          onChange={(e) => set({ suspicious: e.target.checked ? "1" : null })}
          className="size-4 accent-(--color-brand)"
        />
        Suspicious only
      </label>
    </div>
  );
}

export default function AuditPage() {
  const [params, setParams] = useSearchParams();
  const f = readFilters(params);
  const log = useAuditLog(f);
  const exporter = useExportAudit();
  const [open, setOpen] = useState<AuditEntry | null>(null);
  const wide = useMediaQuery("(min-width: 768px)");
  const items = log.data?.pages.flatMap((p) => p.items) ?? [];
  const active = FILTER_KEYS.some((k) => params.get(k));
  const set = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );
  const narrowed = [
    f.user_id && { key: "user_id", label: "One person's activity" },
    f.actor && { key: "actor", label: `By ${f.actor}` },
    f.target && { key: "target", label: `About ${f.target}` },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <Section
      title="Audit log"
      description="Every sign-in, access and account event, newest first. Times are WAT."
      actions={
        <Button
          variant="secondary"
          icon={<Download aria-hidden className="size-4" />}
          loading={exporter.isPending}
          onClick={() => exporter.mutate(f, { onError: (e) => failed(e, "The export didn't work. Try again.") })}
        >
          Export CSV
        </Button>
      }
    >
      <Filters key={params.toString()} f={f} set={set} />
      {(narrowed.length > 0 || active) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {narrowed.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => set({ [n.key]: null })}
              className="touch-target inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-fg hover:border-line-input"
            >
              {n.label}
              <X aria-hidden className="size-3.5 text-fg-muted" />
              <span className="sr-only">(remove filter)</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setParams({}, { replace: true })}
            className="touch-target px-2 font-medium text-brand hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
      {log.isPending ? (
        <div aria-busy className="flex flex-col gap-2">
          <span className="sr-only">Loading the audit log</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : log.error && !items.length ? (
        <ErrorState error={log.error} onRetry={() => void log.refetch()} title="The audit log didn't load" />
      ) : !items.length ? (
        <EmptyState icon={ScrollText} title={active ? "No events match these filters" : "No events yet"} />
      ) : wide ? (
        <div className="-mx-4 overflow-x-auto md:-mx-5">
          <table className={cn("w-full text-sm", log.isPlaceholderData && "opacity-60")}>
            <caption className="sr-only">Audit events. Select an action to see every detail.</caption>
            <thead>
              <tr className="border-b border-line-subtle text-left text-xs text-fg-muted">
                {["Time", "Actor", "Action", "Target", "Outcome", "IP address"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2 font-medium whitespace-nowrap md:px-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {items.map((e) => (
                <tr key={e.id} className={cn("hover:bg-hover", e.flags.includes("suspicious") && "bg-danger-subtle")}>
                  <td className="px-4 py-2 whitespace-nowrap text-fg-2 md:px-5">
                    <When value={e.at} />
                  </td>
                  <td className="max-w-48 truncate px-4 py-2 text-fg md:px-5" title={e.actor.email ?? undefined}>
                    {actorName(e)}
                  </td>
                  <th scope="row" className="px-4 py-2 text-left font-normal md:px-5">
                    <button
                      type="button"
                      onClick={() => setOpen(e)}
                      className="font-medium text-fg underline-offset-2 hover:text-brand hover:underline"
                    >
                      {e.description}
                    </button>
                  </th>
                  <td className="max-w-56 truncate px-4 py-2 text-fg-2 md:px-5" title={e.target?.label ?? undefined}>
                    {e.target?.label ?? "—"}
                  </td>
                  <td className="px-4 py-2 md:px-5">
                    <Outcome e={e} />
                  </td>
                  <td className="num px-4 py-2 whitespace-nowrap text-fg-2 md:px-5">{e.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className={cn("divide-y divide-line-subtle", log.isPlaceholderData && "opacity-60")}>
          {items.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setOpen(e)} className="flex w-full flex-col gap-1 py-3 text-left">
                <span className="text-sm text-fg">
                  <span className="font-medium">{actorName(e)}</span> · {e.description}
                  {e.target?.label && <span className="text-fg-2"> · {e.target.label}</span>}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                  <When value={e.at} />
                  {e.ip && <span className="num">{e.ip}</span>}
                  <Outcome e={e} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {log.hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button variant="secondary" loading={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>
            Show older events
          </Button>
        </div>
      )}
      <Detail e={open} onClose={() => setOpen(null)} />
    </Section>
  );
}
