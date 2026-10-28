import { Navigate, Outlet, useLocation } from "react-router";

import { useMe } from "@/api/auth";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { safeNext } from "@/lib/nav";

function Checking() {
  return (
    <div aria-busy className="mx-auto flex max-w-md flex-col gap-3 p-8">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

/** Signed-out visitors go to sign-in and come back to the exact URL afterwards (US-1.5, US-1.9). */
export function RequireUser() {
  const { data: me, isPending, error, refetch } = useMe();
  const location = useLocation();
  if (isPending) return <Checking />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { data: me } = useMe();
  return me?.role === "admin" ? <Outlet /> : <Navigate to="/app/market" replace />;
}

/** Auth pages bounce signed-in users into the app (except the token pages, which work either way). */
export function SignedOutOnly() {
  const { data: me, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <Checking />;
  if (me) return <Navigate to={safeNext(new URLSearchParams(location.search).get("next"))} replace />;
  return <Outlet />;
}
