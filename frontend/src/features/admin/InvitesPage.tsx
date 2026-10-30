/** Invites (US-7.1, US-7.2): send one or many, copy a link for WhatsApp, resend or revoke. */
import { Copy, MailPlus } from "lucide-react";
import { useId, useState } from "react";
import { useSearchParams } from "react-router";

import { useCreateInvites, useInvites, useResendInvite, useRevokeInvite, type InviteStatus } from "@/api/admin";
import type { InviteBatch, IssuedInvite } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/controls";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { notify } from "@/lib/notify";

import { failed, selectClass } from "./format";
import { Confirm, Section, When } from "./shared";

const MAX = 50;
const STATUS_TONE = { pending: "info", accepted: "gain", expired: "neutral", revoked: "danger" } as const;
const REASONS = { invalid_email: "not an email", duplicate: "listed twice", already_member: "already a member" };

/** Emails pasted with commas, spaces or new lines, de-duplicated (the API checks them properly). */
function splitEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

async function copyLink(invite: IssuedInvite) {
  try {
    await navigator.clipboard.writeText(invite.invite_url);
    notify(`Invite link for ${invite.email} copied`);
  } catch {
    notify("Couldn't copy. Select the link and copy it yourself.", { tone: "error" });
  }
}

function Result({ batch, onClose }: { batch: InviteBatch; onClose: () => void }) {
  const skipped = batch.skipped.length;
  return (
    <div role="status" className="mt-4 rounded-lg bg-selected p-3 text-sm text-fg">
      <p className="font-medium">
        Sent {batch.sent.length}
        {skipped > 0 && ` · skipped ${skipped}`}
      </p>
      {skipped > 0 && (
        <ul className="mt-1 text-fg-2">
          {batch.skipped.map((s) => (
            <li key={s.email}>
              {s.email}: {REASONS[s.reason]}
            </li>
          ))}
        </ul>
      )}
      {batch.sent.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {batch.sent.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate">{i.email}</span>
              {i.email_failed && <Badge tone="warning">Email didn't send: share the link</Badge>}
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy aria-hidden className="size-4" />}
                onClick={() => void copyLink(i)}
              >
                Copy invite link
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" variant="ghost" className="mt-2" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

function InviteForm() {
  const id = useId();
  const [raw, setRaw] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [batch, setBatch] = useState<InviteBatch | null>(null);
  const create = useCreateInvites();
  const emails = splitEmails(raw);
  const tooMany = emails.length > MAX;
  return (
    <Section title="Invite people" description={`One email, or paste up to ${MAX}. Invites last 7 days.`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!emails.length || tooMany) return;
          create.mutate(
            emails.map((email) => ({ email, role })),
            {
              onSuccess: (b) => {
                setBatch(b);
                setRaw("");
              },
              onError: (e) => failed(e),
            },
          );
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor={`${id}-emails`} className="text-sm font-medium text-fg">
          Emails
        </label>
        <textarea
          id={`${id}-emails`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={3}
          placeholder="ada@example.com, tunde@example.com"
          aria-describedby={`${id}-count`}
          className="w-full rounded-md border border-line-input bg-surface px-3 py-2 text-base text-fg placeholder:text-fg-muted"
        />
        <p id={`${id}-count`} className={tooMany ? "text-sm text-danger" : "text-xs text-fg-muted"}>
          {tooMany
            ? `That's ${emails.length}: send ${MAX} at a time.`
            : `${emails.length} email${emails.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-fg-2">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as "user" | "admin")} className={selectClass}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <Button
            type="submit"
            loading={create.isPending}
            disabled={!emails.length || tooMany}
            icon={<MailPlus aria-hidden className="size-4" />}
          >
            Send invite{emails.length === 1 ? "" : "s"}
          </Button>
        </div>
      </form>
      {batch && <Result batch={batch} onClose={() => setBatch(null)} />}
    </Section>
  );
}

const FILTERS: { value: InviteStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

function InviteList() {
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.find((f) => f.value === params.get("status"))?.value ?? "all";
  const list = useInvites(filter === "all" ? null : filter);
  const resend = useResendInvite();
  const revoke = useRevokeInvite();
  return (
    <Section
      title="Invites"
      description={list.data ? `${list.data.total} in this view` : undefined}
      actions={
        <SegmentedControl
          label="Invite status"
          value={filter}
          onChange={(v) => setParams(v === "all" ? {} : { status: v }, { replace: true })}
          options={FILTERS}
        />
      }
    >
      {list.isPending ? (
        <Skeleton className="h-40" />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Invites didn't load" />
      ) : !list.data.items.length ? (
        <EmptyState icon={MailPlus} title="No invites here" />
      ) : (
        <ul className="divide-y divide-line-subtle">
          {list.data.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">
                  {i.email}
                  {i.role === "admin" && <Badge className="ml-2">Admin</Badge>}
                </p>
                <p className="text-xs text-fg-muted">
                  Sent <When value={i.created_at} />
                  {i.invited_by ? ` by ${i.invited_by}` : ""}
                  {i.resend_count > 0 && ` · resent ${i.resend_count}×`}
                </p>
              </div>
              <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge>
              {(i.status === "pending" || i.status === "expired") && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={resend.isPending && resend.variables === i.id}
                  onClick={() =>
                    resend.mutate(i.id, {
                      onSuccess: (sent) =>
                        notify(`New invite sent to ${sent.email}`, {
                          action: { label: "Copy link", run: () => void copyLink(sent) },
                        }),
                      onError: (e) => failed(e),
                    })
                  }
                >
                  Resend
                </Button>
              )}
              {i.status === "pending" && (
                <Confirm
                  trigger={
                    <Button size="sm" variant="ghost">
                      Revoke
                    </Button>
                  }
                  title={`Revoke the invite to ${i.email}?`}
                  description="The link stops working at once."
                  confirm="Revoke"
                  danger
                  onConfirm={() =>
                    revoke.mutate(i.id, {
                      onSuccess: () => notify(`Revoked ${i.email}'s invite`),
                      onError: (e) => failed(e),
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function InvitesPage() {
  return (
    <div className="flex flex-col gap-6">
      <InviteForm />
      <InviteList />
    </div>
  );
}
