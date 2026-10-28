/** Confirm an email from its link (US-1.7). Works signed in or out. */
import { CircleCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

import { useMe, useVerifyEmail } from "@/api/auth";
import { ApiError } from "@/api/client";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { buttonClass } from "@/components/ui/buttonClass";
import { Skeleton } from "@/components/ui/feedback";

import { useHashToken } from "./shared";

export default function VerifyPage() {
  const token = useHashToken();
  const verify = useVerifyEmail();
  const { data: me } = useMe();
  const sent = useRef(false);

  useEffect(() => {
    if (token && !sent.current) {
      sent.current = true; // StrictMode runs effects twice in development; the link is single-use
      verify.mutate(token);
    }
  }, [token, verify]);

  const next = me ? "/app/market" : "/login";
  const nextLabel = me ? "Go to the market" : "Sign in";

  if (verify.isSuccess) {
    return (
      <AuthLayout title="Email confirmed">
        <div className="flex gap-3 text-sm text-fg-2">
          <CircleCheck aria-hidden className="size-6 shrink-0 text-brand" />
          <p role="status">
            {verify.data.email} is confirmed. You can sign in with it and reset your password if you ever forget it.
          </p>
        </div>
        <Link to={next} className={buttonClass("primary", "lg", "mt-6 w-full")}>
          {nextLabel}
        </Link>
      </AuthLayout>
    );
  }

  if (!token || verify.isError) {
    const taken = verify.error instanceof ApiError && verify.error.slug === "email-taken";
    return (
      <AuthLayout
        title={taken ? "That email is already in use" : "This confirmation link has expired or was already used"}
      >
        <p className="text-sm text-fg-2">
          {taken
            ? "Another account uses this email. Add a different one from your account page."
            : "Confirmation links work once, for 48 hours. Request a new one from your account page."}
        </p>
        <Link to={me ? "/app/account#email" : "/login"} className={buttonClass("primary", "lg", "mt-6 w-full")}>
          {me ? "Go to your account" : "Sign in"}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Confirming your email">
      <div aria-busy className="flex flex-col gap-3">
        <span className="sr-only">Confirming</span>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </AuthLayout>
  );
}
