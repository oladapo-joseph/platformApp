/** Admin console (US-7.1 – US-7.8): every call needs an admin session; the API answers 403 otherwise. */
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, apiResponse, type Query } from "./client";
import type {
  AccessRequest,
  AccessRequestPage,
  AdminSummary,
  AdminUser,
  AiUsage,
  Approval,
  AuditPage,
  AuditQuery,
  DataHealth,
  Invite,
  InviteBatch,
  InviteEntry,
  InvitePage,
  IssuedInvite,
  Usage,
  UserPage,
} from "./types";

const MIN = 60_000;
const admin = (...key: unknown[]) => ["admin", ...key];

/** Nav badge counts: new access requests and suspicious sign-ins (US-7.3, US-7.7). */
export function useAdminSummary(enabled: boolean) {
  return useQuery({
    queryKey: admin("summary"),
    queryFn: ({ signal }) => api<AdminSummary>("/admin/summary", { signal }),
    staleTime: MIN,
    refetchInterval: 5 * MIN,
    enabled,
  });
}

// ── access requests (US-7.3) ──

export type RequestStatus = AccessRequest["status"];

export function useAccessRequests(status: RequestStatus) {
  return useQuery({
    queryKey: admin("requests", status),
    queryFn: ({ signal }) =>
      api<AccessRequestPage>("/admin/access-requests", { query: { status, limit: 200 }, signal }),
    placeholderData: keepPreviousData,
  });
}

function useAdminMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // requests, invites, users, the badge and the audit log all move together
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export const useApprove = () =>
  useAdminMutation((id: string) => api<Approval>(`/admin/access-requests/${id}/approve`, { method: "POST", body: {} }));

export const useDecline = () =>
  useAdminMutation(({ id, notify }: { id: string; notify: boolean }) =>
    api<AccessRequest>(`/admin/access-requests/${id}/decline`, { method: "POST", body: { notify } }),
  );

// ── invites (US-7.1, US-7.2) ──

export type InviteStatus = Invite["status"];

export function useInvites(status: InviteStatus | null) {
  return useQuery({
    queryKey: admin("invites", status),
    queryFn: ({ signal }) => api<InvitePage>("/admin/invites", { query: { status, limit: 200 }, signal }),
    placeholderData: keepPreviousData,
  });
}

export const useCreateInvites = () =>
  useAdminMutation((invites: InviteEntry[]) =>
    api<InviteBatch>("/admin/invites", { method: "POST", body: { invites } }),
  );

export const useResendInvite = () =>
  useAdminMutation((id: string) => api<IssuedInvite>(`/admin/invites/${id}/resend`, { method: "POST" }));

export const useRevokeInvite = () =>
  useAdminMutation((id: string) => api<Invite>(`/admin/invites/${id}`, { method: "DELETE" }));

// ── users (US-7.4) ──

export function useUsers(q: string) {
  return useQuery({
    queryKey: admin("users", q),
    queryFn: ({ signal }) => api<UserPage>("/admin/users", { query: { q: q || null, limit: 200 }, signal }),
    placeholderData: keepPreviousData,
  });
}

export const useUpdateUser = () =>
  useAdminMutation(({ id, ...body }: { id: string; role?: AdminUser["role"]; is_active?: boolean }) =>
    api<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body }),
  );

// ── audit log (US-7.7) ──

/** The filters as the API reads them (dates as `from`/`to`); empty values left out. */
export function auditParams(f: AuditQuery): Query {
  return {
    from: f.from ?? null,
    to: f.to ?? null,
    category: f.category ?? null,
    outcome: f.outcome ?? null,
    actor: f.actor ?? null,
    target: f.target ?? null,
    q: f.q ?? null,
    user_id: f.user_id ?? null,
    suspicious: f.suspicious ? true : null,
  };
}

export function useAuditLog(f: AuditQuery) {
  const query = auditParams(f);
  return useInfiniteQuery({
    queryKey: admin("audit", query),
    queryFn: ({ pageParam, signal }) =>
      api<AuditPage>("/admin/audit", { query: { ...query, limit: 50, cursor: pageParam }, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  });
}

/** Downloads the filtered view as CSV; the server logs the export (US-7.7). */
export function useExportAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: AuditQuery) => {
      const body = Object.fromEntries(Object.entries(auditParams(f)).filter(([, v]) => v !== null));
      const res = await apiResponse("/admin/audit/export", { method: "POST", body });
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "audit-log.csv";
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.append(a); // some browsers ignore a click on a detached link
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: admin("audit") }),
  });
}

// ── usage (US-7.8) and data health (US-7.6) ──

export function useUsage(days: number) {
  return useQuery({
    queryKey: admin("usage", days),
    queryFn: ({ signal }) => api<Usage>("/admin/usage", { query: { days }, signal }),
    staleTime: 5 * MIN,
    placeholderData: keepPreviousData,
  });
}

export function useAiUsage(days: number) {
  return useQuery({
    queryKey: admin("ai-usage", days),
    queryFn: ({ signal }) => api<AiUsage>("/admin/ai-usage", { query: { days }, signal }),
    staleTime: 5 * MIN,
    placeholderData: keepPreviousData,
  });
}

export function useDataHealth() {
  return useQuery({
    queryKey: admin("data-health"),
    queryFn: ({ signal }) => api<DataHealth>("/admin/data-health", { signal }),
    staleTime: MIN,
    refetchInterval: 5 * MIN,
  });
}
