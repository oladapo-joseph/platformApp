/** Access requests (US-7.3): approve sends an invite; nothing is approved without an admin's choice (D-13). */
import { Inbox } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { useAccessRequests, useApprove, useDecline, type RequestStatus } from "@/api/admin";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { notify } from "@/lib/notify";

import { failed } from "./format";
import { Confirm, Section, When } from "./shared";

const STATUSES: { value: RequestStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
];

export default function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const status = (STATUSES.find((s) => s.value === params.get("status"))?.value ?? "new") as RequestStatus;
  const list = useAccessRequests(status);
  const approve = useApprove();
  const decline = useDecline();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notifyDecline, setNotifyDecline] = useState(false);
  const items = list.data?.items ?? [];
  const chosen = items.filter((r) => picked.has(r.id));

  const approveOne = (id: string, email: string) =>
    approve.mutate(id, {
      onSuccess: (a) => notify(a.invite ? `Invite sent to ${email}` : `${email} already has an account`),
      onError: (e) => failed(e),
    });

  return (
    <Section
      title="Access requests"
      description="People who asked to join. Approving sends them an invite."
      actions={
        <SegmentedControl
          label="Status"
          value={status}
          onChange={(s) => {
            setPicked(new Set());
            setParams(s === "new" ? {} : { status: s }, { replace: true });
          }}
          options={STATUSES}
        />
      }
    >
      {status === "new" && chosen.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-selected px-3 py-2 text-sm text-fg">
          {chosen.length} selected
          <Confirm
            trigger={<Button size="sm">Approve {chosen.length}</Button>}
            title={`Approve ${chosen.length} request${chosen.length === 1 ? "" : "s"}?`}
            description={`Each person gets an invite email: ${chosen.map((r) => r.email).join(", ")}.`}
            confirm="Approve and send invites"
            onConfirm={() => {
              chosen.forEach((r) => approveOne(r.id, r.email));
              setPicked(new Set());
            }}
          />
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
            Clear
          </Button>
        </div>
      )}
      {list.isPending ? (
        <div aria-busy className="flex flex-col gap-3">
          <span className="sr-only">Loading requests</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Requests didn't load" />
      ) : !items.length ? (
        <EmptyState icon={Inbox} title={status === "new" ? "No requests waiting" : `No ${status} requests`} />
      ) : (
        <ul className="divide-y divide-line-subtle">
          {items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 py-3">
              {status === "new" && (
                <input
                  type="checkbox"
                  aria-label={`Select ${r.email}`}
                  checked={picked.has(r.id)}
                  onChange={() =>
                    setPicked((p) => {
                      const next = new Set(p);
                      if (next.has(r.id)) next.delete(r.id);
                      else next.add(r.id);
                      return next;
                    })
                  }
                  className="touch-target mt-1 size-4 accent-(--color-brand)"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">
                  {r.name ?? r.email} {r.name && <span className="font-normal text-fg-muted">· {r.email}</span>}
                </p>
                {r.note && <p className="mt-1 text-sm text-fg-2">“{r.note}”</p>}
                <p className="mt-1 text-xs text-fg-muted">
                  Asked <When value={r.created_at} />
                  {r.reviewed_at && (
                    <>
                      {" "}
                      · {r.status} <When value={r.reviewed_at} />
                      {r.reviewed_by ? ` by ${r.reviewed_by}` : ""}
                    </>
                  )}
                </p>
              </div>
              {status === "new" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={approve.isPending && approve.variables === r.id}
                    onClick={() => approveOne(r.id, r.email)}
                  >
                    Approve
                  </Button>
                  <Confirm
                    trigger={
                      <Button size="sm" variant="secondary">
                        Decline
                      </Button>
                    }
                    title={`Decline ${r.email}?`}
                    description="The request is closed. They can ask again later."
                    confirm="Decline"
                    danger
                    onConfirm={() =>
                      decline.mutate(
                        { id: r.id, notify: notifyDecline },
                        { onSuccess: () => notify(`Declined ${r.email}`), onError: (e) => failed(e) },
                      )
                    }
                  >
                    <label className="flex items-center gap-2 text-sm text-fg-2">
                      <input
                        type="checkbox"
                        checked={notifyDecline}
                        onChange={(e) => setNotifyDecline(e.target.checked)}
                        className="size-4 accent-(--color-brand)"
                      />
                      Send them a short, polite email
                    </label>
                  </Confirm>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
