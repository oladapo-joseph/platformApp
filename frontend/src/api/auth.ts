import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { applyTheme, savedTheme, subscribeTheme, type ThemeChoice } from "@/lib/theme";

import { ApiError, api, resetCsrf } from "./client";
import type { InviteView, Me, Schemas } from "./types";

export const meKey = ["me"] as const;

/** The signed-in user, or null when signed out (a 401 isn't an error here). */
export const meQuery = queryOptions({
  queryKey: meKey,
  queryFn: async ({ signal }) => {
    try {
      return await api<Me>("/auth/me", { signal });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  staleTime: 5 * 60_000,
  retry: false,
});

export function useMe() {
  return useQuery(meQuery);
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["LoginRequest"]) => api<Me>("/auth/login", { method: "POST", body }),
    onSuccess: (me) => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] }); // nothing from a previous user
      qc.setQueryData(meKey, me);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scope: "this" | "all" = "this") =>
      api<undefined>(scope === "all" ? "/auth/logout-all" : "/auth/logout", { method: "POST" }),
    onSettled: () => {
      // ASVS 14.3.1: drop every cached response once the session ends, even if the call failed
      qc.clear();
      qc.setQueryData(meKey, null);
      resetCsrf();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      api<Schemas["Accepted"]>("/auth/password/forgot", { method: "POST", body: { email } }),
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["ResetRequest"]) => api<Me>("/auth/password/reset", { method: "POST", body }),
    onSuccess: (me) => qc.setQueryData(meKey, me),
  });
}

export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api<Me>("/auth/verify-email", { method: "POST", body: { token } }),
    onSuccess: (me) => {
      // a signed-in user's "add your email" banner goes away; signed-out readers just see success
      if (qc.getQueryData(meKey)) qc.setQueryData(meKey, me);
    },
  });
}

export function useInviteLookup(token: string | null) {
  return useQuery({
    queryKey: ["invite", token],
    queryFn: () => api<InviteView>("/invites/lookup", { method: "POST", body: { token } }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["AcceptInvite"]) => api<Me>("/invites/accept", { method: "POST", body }),
    onSuccess: (me) => qc.setQueryData(meKey, me),
  });
}

export function useRequestAccess() {
  return useMutation({
    mutationFn: (body: Schemas["AccessRequestIn"]) =>
      api<Schemas["Accepted"]>("/access-requests", { method: "POST", body }),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["UpdateMe"]) => api<Me>("/auth/me", { method: "PATCH", body }),
    onSuccess: (me) => qc.setQueryData(meKey, me),
  });
}

/** The theme everywhere it's shown (user menu, account page): applied at once, saved to the account. */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const qc = useQueryClient();
  const choice = useSyncExternalStore(subscribeTheme, savedTheme, () => "system" as const);
  const save = useMutation({
    mutationFn: (theme: ThemeChoice) => api<Me>("/auth/me", { method: "PATCH", body: { theme } }),
    onSuccess: (me) => qc.setQueryData(meKey, me),
  });
  return [
    choice,
    (next) => {
      applyTheme(next);
      if (qc.getQueryData(meKey)) save.mutate(next); // a failed save still leaves it applied here
    },
  ];
}

/** US-6.4: type your email (or legacy username) to confirm; the session ends with the account. */
export function useDeleteMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (confirm: string) => api<undefined>("/auth/me", { method: "DELETE", body: { confirm } }),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(meKey, null);
      resetCsrf();
    },
  });
}
