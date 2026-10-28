/** Set a new password from the emailed link (US-1.6); signs in and ends other sessions. */
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";

import { useResetPassword } from "@/api/auth";
import { ApiError } from "@/api/client";
import { AuthLayout, textLink } from "@/components/layout/AuthLayout";
import { FormError } from "@/components/ui/feedback";
import { Button } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/buttonClass";
import { PasswordField } from "@/components/ui/Field";

import { applyServerError, newPassword, passwordHint, useHashToken } from "./shared";

const schema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });
type Values = z.infer<typeof schema>;

export default function ResetPage() {
  const token = useHashToken();
  const navigate = useNavigate();
  const reset = useResetPassword();
  const [formError, setFormError] = useState<string | null>(null);
  const [linkDead, setLinkDead] = useState(!token);
  const { register, handleSubmit, setError, control, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { password: "", confirm: "" },
  });
  const password = useWatch({ control, name: "password" });

  if (linkDead) {
    return (
      <AuthLayout title="This reset link has expired or was already used">
        <p className="text-sm text-fg-2">Reset links work once, for 30 minutes. Ask for a new one.</p>
        <Link to="/forgot" className={buttonClass("primary", "lg", "mt-6 w-full")}>
          Send a new link
        </Link>
      </AuthLayout>
    );
  }

  const onSubmit = handleSubmit(({ password }) => {
    setFormError(null);
    reset.mutate(
      { token: token ?? "", password },
      {
        onSuccess: () => void navigate("/app/market", { replace: true }),
        onError: (error) => {
          if (error instanceof ApiError && error.slug === "invalid-token") return setLinkDead(true);
          setFormError(applyServerError(error, setError, ["password"]));
        },
      },
    );
  });

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="You'll be signed in here, and signed out everywhere else."
      footer={
        <Link to="/login" className={textLink}>
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        <FormError message={formError} />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint={passwordHint(password)}
          error={formState.errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          error={formState.errors.confirm?.message}
          {...register("confirm")}
        />
        <Button type="submit" size="lg" loading={reset.isPending} className="w-full">
          Save and sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
