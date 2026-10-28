/** "Request an invite": the same thank-you for every email (US-1.2). */
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";

import { useRequestAccess } from "@/api/auth";
import { AuthLayout, textLink } from "@/components/layout/AuthLayout";
import { FormError } from "@/components/ui/feedback";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextArea, TextField } from "@/components/ui/Field";

import { applyServerError, email } from "./shared";

const schema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(60, "Use at most 60 characters."),
  email,
  note: z.string().max(200, "Keep it under 200 characters.").optional(),
  accept_disclaimer: z.boolean().refine(Boolean, "Please confirm you understand this before continuing."),
});
type Values = z.infer<typeof schema>;

export default function RequestInvitePage() {
  const [params] = useSearchParams();
  const request = useRequestAccess();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, control, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", email: params.get("email") ?? "", note: "", accept_disclaimer: false },
  });
  const note = useWatch({ control, name: "note" }) ?? "";

  if (request.isSuccess) {
    return (
      <AuthLayout
        title="Request received"
        footer={
          <Link to="/" className={textLink}>
            Back to EquityLensNG
          </Link>
        }
      >
        <div className="flex gap-3 text-sm text-fg-2">
          <MailCheck aria-hidden className="size-6 shrink-0 text-brand" />
          <p role="status">{request.data.message}</p>
        </div>
      </AuthLayout>
    );
  }

  const onSubmit = handleSubmit(({ name, email, note }) => {
    setFormError(null);
    request.mutate(
      { name, email, note: note?.trim() || null, accept_disclaimer: true },
      { onError: (error) => setFormError(applyServerError(error, setError, ["name", "email"])) },
    );
  });

  return (
    <AuthLayout
      title="Request an invite"
      subtitle="EquityLensNG is invite-only for now. Every request is reviewed by the team."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className={textLink}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        <FormError message={formError} />
        <TextField label="Your name" autoComplete="name" error={formState.errors.name?.message} {...register("name")} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={formState.errors.email?.message}
          {...register("email")}
        />
        <TextArea
          label="How will you use EquityLensNG? (optional)"
          rows={3}
          maxLength={200}
          hint={`${note.length} of 200 characters`}
          error={formState.errors.note?.message}
          {...register("note")}
        />
        <Checkbox
          label="I understand EquityLensNG provides educational analysis, not investment advice."
          error={formState.errors.accept_disclaimer?.message}
          {...register("accept_disclaimer")}
        />
        <Button type="submit" size="lg" loading={request.isPending} className="w-full">
          Request an invite
        </Button>
      </form>
    </AuthLayout>
  );
}
