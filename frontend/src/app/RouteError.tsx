import { Compass } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { buttonClass } from "@/components/ui/buttonClass";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Logo } from "@/components/ui/Logo";

/** Last-resort boundary: plain language, a way back, never a stack trace (US-8.4). */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 p-6">
      <Logo />
      {notFound ? (
        <NotFoundBody />
      ) : (
        <ErrorState error={error} title="Something went wrong" onRetry={() => window.location.reload()} />
      )}
    </main>
  );
}

function NotFoundBody() {
  return (
    <EmptyState
      icon={Compass}
      title="We couldn't find that page"
      action={
        <Link to="/app/market" className={buttonClass("secondary")}>
          Go to the market
        </Link>
      }
    >
      The link may be old, or the address mistyped.
    </EmptyState>
  );
}

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 p-6">
      <Logo />
      <NotFoundBody />
    </main>
  );
}
