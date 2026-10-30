/** Users (US-7.4): find people, change roles, deactivate or reactivate, see their activity. */
import { Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useUpdateUser, useUsers } from "@/api/admin";
import { useMe } from "@/api/auth";
import type { AdminUser } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useDebounced } from "@/lib/hooks";
import { notify } from "@/lib/notify";

import { failed, inputClass, selectClass } from "./format";
import { Confirm, Section, When } from "./shared";

function UserRow({ u, self }: { u: AdminUser; self: boolean }) {
  const update = useUpdateUser();
  const name = u.display_name ?? u.email ?? u.username ?? "This user";
  const change = (body: { role?: AdminUser["role"]; is_active?: boolean }, done: string) =>
    update.mutate({ id: u.id, ...body }, { onSuccess: () => notify(done), onError: (e) => failed(e) });
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-fg">
          {name}
          {self && <span className="font-normal text-fg-muted"> (you)</span>}
        </p>
        <p className="truncate text-xs text-fg-muted">
          {u.email ?? u.username}
          {u.legacy && " · legacy account, no email yet"}
        </p>
        <p className="text-xs text-fg-muted">
          Joined <When value={u.created_at} /> · last signed in <When value={u.last_login_at} />
        </p>
      </div>
      {!u.is_active && <Badge tone="danger">Deactivated</Badge>}
      <label className="flex items-center gap-2 text-sm text-fg-2">
        <span className="sr-only">Role for {name}</span>
        <select
          value={u.role}
          disabled={self || update.isPending}
          onChange={(e) =>
            change(
              { role: e.target.value as AdminUser["role"] },
              `${name} is now ${e.target.value === "admin" ? "an admin" : "a user"}`,
            )
          }
          className={selectClass}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      {u.is_active ? (
        <Confirm
          trigger={
            <Button size="sm" variant="secondary" disabled={self}>
              Deactivate
            </Button>
          }
          title={`Deactivate ${name}?`}
          description="They're signed out everywhere within a minute and can't sign in until you reactivate them."
          confirm="Deactivate"
          danger
          onConfirm={() => change({ is_active: false }, `${name} deactivated`)}
        />
      ) : (
        <Button
          size="sm"
          variant="secondary"
          loading={update.isPending}
          onClick={() => change({ is_active: true }, `${name} reactivated`)}
        >
          Reactivate
        </Button>
      )}
      <Link
        to={`/app/admin/audit?user_id=${u.id}`}
        className="text-sm font-medium text-brand underline-offset-2 hover:underline"
      >
        View activity<span className="sr-only"> for {name}</span>
      </Link>
    </li>
  );
}

export default function UsersPage() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get("q") ?? "");
  const q = useDebounced(draft.trim(), 300);
  useEffect(() => {
    setParams(q ? { q } : {}, { replace: true });
  }, [q, setParams]);
  const { data: me } = useMe();
  const list = useUsers(q);
  return (
    <Section
      title="Users"
      description={list.data ? `${list.data.total} ${q ? "found" : "in all"}` : undefined}
      actions={
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
          />
          <label htmlFor="user-q" className="sr-only">
            Search by name or email
          </label>
          <input
            id="user-q"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Name or email"
            className={`${inputClass} w-64 pl-9`}
          />
        </div>
      }
    >
      {list.isPending ? (
        <Skeleton className="h-40" />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Users didn't load" />
      ) : !list.data.items.length ? (
        <EmptyState icon={Users} title={`No one matches “${q}”`} />
      ) : (
        <ul aria-busy={list.isPlaceholderData || undefined} className="divide-y divide-line-subtle">
          {list.data.items.map((u) => (
            <UserRow key={u.id} u={u} self={u.id === me?.id} />
          ))}
        </ul>
      )}
    </Section>
  );
}
