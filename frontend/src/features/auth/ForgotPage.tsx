/** Forgotten password: the same answer for every email (US-1.6, no enumeration). */
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";

import { useForgotPassword } from "@/api/auth";
import { ApiError } from "@/api/client";
import { AuthLayout, textLink } from "@/components/layout/AuthLayout";
import { FormError } from "@/components/ui/feedback";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

import { email } from "./shared";

const schema = z.object({ email });
type Values = z.infer<typeof schema>;

export default function ForgotPage() {
  const forgot = useForgotPassword();
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  if (forgot.isSuccess) {
    return (
      <AuthLayout title="Check your email" footer={<BackToSignIn />}>
        <div className="flex gap-3 text-sm text-fg-2">
          <MailCheck aria-hidden className="size-6 shrink-0 text-brand" />
          <p role="status">
            If that email has an account, we've sent a reset link. It expires in 30 minutes. Nothing there? Check your
            spam folder, or try again in a minute.
          </p>
        </div>
      </AuthLayout>
    );
  }

  const error = forgot.error instanceof ApiError ? forgot.error.detail : forgot.error?.message;
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email you use for EquityLensNG and we'll send you a link."
      footer={<BackToSignIn />}
    >
      <form
        onSubmit={(e) => void handleSubmit((v) => forgot.mutate(v.email))(e)}
        noValidate
        className="flex flex-col gap-5"
      >
        <FormError message={error} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={formState.errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" size="lg" loading={forgot.isPending} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}

function BackToSignIn() {
  return (
    <Link to="/login" className={textLink}>
      Back to sign in
    </Link>
  );
}
