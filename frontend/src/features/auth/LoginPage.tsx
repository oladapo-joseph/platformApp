/** Sign in with email or legacy username (US-1.5); explains signed-out and expired sessions (US-1.9). */
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";

import { useLogin } from "@/api/auth";
import { ApiError } from "@/api/client";
import { AuthLayout, textLink } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Banner, FormError } from "@/components/ui/feedback";
import { Checkbox, PasswordField, TextField } from "@/components/ui/Field";
import { safeNext } from "@/lib/nav";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username.").max(254),
  password: z.string().min(1, "Enter your password.").max(256),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;

const REASONS: Record<string, string> = {
  "signed-out": "You've signed out.",
  expired: "Your session has ended. Please sign in again.",
};

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const reason = REASONS[params.get("reason") ?? ""];

  const { register, handleSubmit, setFocus, resetField, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { identifier: "", password: "", remember: true },
  });
  const { errors } = formState;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => void navigate(safeNext(params.get("next")), { replace: true }),
      onError: (error) => {
        setFormError(error instanceof ApiError ? error.detail : error.message);
        if (error instanceof ApiError && error.slug === "bad-credentials") {
          resetField("password"); // US-1.5: cleared and focused
          setFocus("password");
        }
      },
    });
  });

  return (
    <AuthLayout
      title="Sign in"
      footer={
        <>
          Don't have access?{" "}
          <Link to="/request-invite" className={textLink}>
            Request an invite
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        {reason && <Banner tone="info">{reason}</Banner>}
        <FormError message={formError} />
        <TextField
          label="Email or username"
          autoComplete="username"
          autoCapitalize="none"
          inputMode="email"
          error={errors.identifier?.message}
          {...register("identifier")}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          labelAside={
            <Link to="/forgot" className={`${textLink} text-sm`}>
              Forgot password?
            </Link>
          }
          error={errors.password?.message}
          {...register("password")}
        />
        <Checkbox label="Keep me signed in" {...register("remember")} />
        <Button type="submit" size="lg" loading={login.isPending} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
