/** Open an invite link and set up the account (US-1.3); dead links explain what to do (US-1.4). */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";

import { useAcceptInvite, useInviteLookup } from "@/api/auth";
import { ApiError } from "@/api/client";
import { AuthLayout, textLink } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/buttonClass";
import { ErrorState, FormError, Skeleton } from "@/components/ui/feedback";
import { Checkbox, PasswordField, TextField } from "@/components/ui/Field";

import { applyServerError, newPassword, passwordHint, useHashToken } from "./shared";

const schema = z
  .object({
    display_name: z.string().trim().min(1, "Tell us your name.").max(60, "Use at most 60 characters."),
    password: newPassword,
    confirm: z.string(),
    accept_terms: z.boolean().refine(Boolean, "Please accept the terms and disclaimer to continue."),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });
type Values = z.infer<typeof schema>;

function DeadLink({ status, email }: { status: "expired" | "used" | "invalid"; email: string | null | undefined }) {
  const copy = {
    expired: {
      title: "This invite has expired",
      body: "Invite links last 7 days. Ask for a new one and we'll send it to the same address.",
      action: {
        to: `/request-invite${email ? `?email=${encodeURIComponent(email)}` : ""}`,
        label: "Request a new invite",
      },
    },
    used: {
      title: "This invite has already been used",
      body: "The account for this invite is set up. Sign in to continue.",
      action: { to: "/login", label: "Sign in" },
    },
    invalid: {
      title: "This invite link isn't valid",
      body: "It may have been replaced by a newer invite, or copied incompletely.",
      action: { to: "/request-invite", label: "Request an invite" },
    },
  }[status];
  return (
    <AuthLayout title={copy.title}>
      <p className="text-sm text-fg-2">{copy.body}</p>
      <Link to={copy.action.to} className={buttonClass("primary", "lg", "mt-6 w-full")}>
        {copy.action.label}
      </Link>
    </AuthLayout>
  );
}

export default function InvitePage() {
  const token = useHashToken();
  const lookup = useInviteLookup(token);
  const accept = useAcceptInvite();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const invitedName = lookup.data?.name ?? "";
  // pre-fill the name the admin typed, once the lookup answers (keeps anything already typed)
  const values = useMemo(
    () => ({ display_name: invitedName, password: "", confirm: "", accept_terms: false }),
    [invitedName],
  );
  const { register, handleSubmit, setError, control, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    values,
    resetOptions: { keepDirtyValues: true },
  });
  const password = useWatch({ control, name: "password" });

  if (!token || gone) return <DeadLink status="invalid" email={null} />;
  if (lookup.isPending) {
    return (
      <AuthLayout title="Opening your invite">
        <div aria-busy className="flex flex-col gap-3">
          <span className="sr-only">Loading</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthLayout>
    );
  }
  if (lookup.isError) {
    return (
      <AuthLayout title="We couldn't open this invite">
        <ErrorState error={lookup.error} onRetry={() => void lookup.refetch()} />
      </AuthLayout>
    );
  }
  const invite = lookup.data;
  if (invite.status !== "valid") return <DeadLink status={invite.status} email={invite.email} />;

  const onSubmit = handleSubmit(({ display_name, password }) => {
    setFormError(null);
    accept.mutate(
      { token, display_name, password, accept_terms: true },
      {
        onSuccess: () => void navigate("/app/market", { replace: true }),
        onError: (error) => {
          if (error instanceof ApiError && error.slug === "invalid-invite") return setGone(true);
          setFormError(applyServerError(error, setError, ["display_name", "password"]));
        },
      },
    );
  });

  const first = invite.name?.split(" ")[0];
  return (
    <AuthLayout
      title={first ? `Welcome to EquityLensNG, ${first}` : "Welcome to EquityLensNG"}
      subtitle="Set your name and a password, and you're in."
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        <FormError message={formError} />
        <TextField label="Email" value={invite.email ?? ""} readOnly autoComplete="username" />
        <TextField
          label="Your name"
          autoComplete="name"
          error={formState.errors.display_name?.message}
          {...register("display_name")}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint={passwordHint(password)}
          error={formState.errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          error={formState.errors.confirm?.message}
          {...register("confirm")}
        />
        <Checkbox
          label={
            <>
              I accept the{" "}
              <Link to="/terms" className={textLink}>
                terms
              </Link>{" "}
              and understand EquityLensNG is educational analysis, not investment advice.
            </>
          }
          error={formState.errors.accept_terms?.message}
          {...register("accept_terms")}
        />
        <Button type="submit" size="lg" loading={accept.isPending} className="w-full">
          Create my account
        </Button>
      </form>
    </AuthLayout>
  );
}
