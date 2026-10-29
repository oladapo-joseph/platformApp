/**
 * Account (E6): name (US-6.1), email, including "Add your email" for migrated accounts at
 * #email (US-1.7), password (US-6.1), theme (US-6.2), sign out of every device (US-6.3) and
 * delete the account (US-6.4).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertDialog } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router";
import { z } from "zod";

import { useDeleteMe, useLogout, useMe, useThemeChoice, useUpdateMe } from "@/api/auth";
import { ApiError } from "@/api/client";
import type { Me } from "@/api/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/controls";
import { Badge, Banner, Card, FormError } from "@/components/ui/feedback";
import { PasswordField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { applyServerError, email as emailRule, newPassword, passwordHint } from "@/features/auth/shared";
import { day } from "@/lib/dates";
import type { ThemeChoice } from "@/lib/theme";

function Section({
  id,
  title,
  description,
  danger,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className={danger ? "border-danger" : undefined}>
      <section aria-labelledby={`${id}-title`} id={id} className="scroll-mt-24 p-4 md:p-6">
        <h2 id={`${id}-title`} className="font-headline text-xl font-semibold text-fg">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-fg-2">{description}</p>}
        <div className="mt-4">{children}</div>
      </section>
    </Card>
  );
}

const nameSchema = z.object({
  display_name: z.string().trim().min(1, "Enter your name.").max(60, "Use at most 60 characters."),
});

function NameForm({ me, toast }: { me: Me; toast: (m: string) => void }) {
  const update = useUpdateMe();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState, reset } = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    mode: "onTouched",
    defaultValues: { display_name: me.display_name ?? "" },
  });
  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    update.mutate(values, {
      onSuccess: (next) => {
        reset({ display_name: next.display_name ?? "" });
        toast("Name saved");
      },
      onError: (e) => setFormError(applyServerError(e, setError, ["display_name"])),
    });
  });
  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex max-w-md flex-col gap-4">
      <FormError message={formError} />
      <TextField
        label="Name"
        autoComplete="name"
        error={formState.errors.display_name?.message}
        {...register("display_name")}
      />
      <Button type="submit" loading={update.isPending} disabled={!formState.isDirty} className="self-start">
        Save name
      </Button>
    </form>
  );
}

function EmailForm({ me }: { me: Me }) {
  const update = useUpdateMe();
  const location = useLocation();
  const needsPassword = me.email_verified;
  const schema = z.object({
    email: emailRule,
    current_password: needsPassword ? z.string().min(1, "Enter your current password.") : z.string(),
  });
  type Values = z.infer<typeof schema>;
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, setError, setFocus, formState, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: "", current_password: "" },
  });

  // "Add email" in the banner links here (US-1.7)
  useEffect(() => {
    if (location.hash === "#email") setFocus("email");
  }, [location.hash, setFocus]);

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    if (values.email.trim().toLowerCase() === me.email?.toLowerCase()) {
      setError("email", { message: "That's already your email." }, { shouldFocus: true });
      return;
    }
    update.mutate(
      { email: values.email.trim(), current_password: needsPassword ? values.current_password : null },
      {
        onSuccess: () => {
          setSentTo(values.email.trim());
          reset();
        },
        onError: (e) => {
          if (e instanceof ApiError && e.slug === "bad-current-password") {
            setError("current_password", { message: e.detail }, { shouldFocus: true });
            return;
          }
          setFormError(applyServerError(e, setError, ["email", "current_password"]));
        },
      },
    );
  });

  return (
    <div className="flex max-w-md flex-col gap-4">
      <dl className="text-sm">
        <dt className="text-fg-muted">Current email</dt>
        <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-fg">
          {me.email ? (
            <>
              <span className="break-all">{me.email}</span>
              {me.email_verified && <Badge tone="gain">Confirmed</Badge>}
            </>
          ) : (
            <span className="text-fg-2">None yet</span>
          )}
        </dd>
      </dl>
      {(sentTo ?? me.pending_email) && (
        <Banner tone="info" title={`Confirm ${sentTo ?? me.pending_email ?? ""}`}>
          {me.email
            ? "We sent a confirmation link to the new address. Your email changes once you open it."
            : "We sent a confirmation link. Open it to add this email to your account."}
        </Banner>
      )}
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField
          label={me.email ? "New email" : "Email"}
          type="email"
          autoComplete="email"
          inputMode="email"
          error={formState.errors.email?.message}
          {...register("email")}
        />
        {needsPassword && (
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            error={formState.errors.current_password?.message}
            {...register("current_password")}
          />
        )}
        <Button type="submit" loading={update.isPending} className="self-start">
          {me.email ? "Change email" : "Add email"}
        </Button>
      </form>
    </div>
  );
}

const passwordSchema = z
  .object({ current: z.string().min(1, "Enter your current password."), next: newPassword, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

function PasswordForm() {
  const update = useUpdateMe();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setError, control, formState, reset } = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    mode: "onTouched",
    defaultValues: { current: "", next: "", confirm: "" },
  });
  const next = useWatch({ control, name: "next" });
  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setDone(false);
    update.mutate(
      { current_password: values.current, new_password: values.next },
      {
        onSuccess: () => {
          reset();
          setDone(true);
        },
        onError: (e) => {
          if (e instanceof ApiError && e.slug === "bad-current-password") {
            setError("current", { message: e.detail }, { shouldFocus: true });
            return;
          }
          setFormError(applyServerError(e, setError, ["next"], { password: "next", new_password: "next" }));
        },
      },
    );
  });
  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex max-w-md flex-col gap-4">
      {done && <Banner tone="info">Password changed. Other devices have been signed out.</Banner>}
      <FormError message={formError} />
      <PasswordField
        label="Current password"
        autoComplete="current-password"
        error={formState.errors.current?.message}
        {...register("current")}
      />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        hint={passwordHint(next)}
        error={formState.errors.next?.message}
        {...register("next")}
      />
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        error={formState.errors.confirm?.message}
        {...register("confirm")}
      />
      <Button type="submit" loading={update.isPending} className="self-start">
        Change password
      </Button>
    </form>
  );
}

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function ThemePicker() {
  const [theme, setTheme] = useThemeChoice();
  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl label="Theme" value={theme} onChange={setTheme} options={THEMES} className="self-start" />
      <p className="text-xs text-fg-muted">
        {theme === "system" ? "Follows your device's light or dark setting. " : ""}Saved to your account.
      </p>
    </div>
  );
}

const dialogOverlay = "fixed inset-0 z-(--z-overlay) bg-canvas/70 backdrop-blur-sm";
const dialogContent =
  "fixed top-1/2 left-1/2 z-(--z-modal) w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-raised p-6 shadow-lg";

function SignOutEverywhere() {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button variant="secondary">Sign out of all devices</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={dialogOverlay} />
        <AlertDialog.Content className={dialogContent}>
          <AlertDialog.Title className="font-headline text-xl font-semibold text-fg">
            Sign out of all devices?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-fg-2">
            Every device signed in to your account is signed out, this one included. You'll need your password to sign
            in again.
          </AlertDialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              loading={logout.isPending}
              onClick={() =>
                logout.mutate("all", {
                  onSettled: () => void navigate("/login?reason=signed-out-all", { replace: true }),
                })
              }
            >
              Sign out everywhere
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function DeleteAccount({ me }: { me: Me }) {
  const remove = useDeleteMe();
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const expected = me.email ?? me.username ?? "";
  const matches = typed.trim().toLowerCase() === expected.toLowerCase() && expected !== "";
  return (
    <AlertDialog.Root
      onOpenChange={(open) => {
        if (!open) {
          setTyped("");
          setError(null);
        }
      }}
    >
      <AlertDialog.Trigger asChild>
        <Button variant="danger">Delete account</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={dialogOverlay} />
        <AlertDialog.Content className={dialogContent}>
          <AlertDialog.Title className="font-headline text-xl font-semibold text-fg">
            Delete your account?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-fg-2">
            This deletes your account, your watchlist and your AI usage, and signs you out everywhere. It can't be
            undone.
          </AlertDialog.Description>
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!matches) return;
              setError(null);
              remove.mutate(typed.trim(), {
                onSuccess: () => void navigate("/login?reason=deleted", { replace: true }),
                onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong."),
              });
            }}
          >
            <FormError message={error} />
            <TextField
              label={`Type ${me.email ? "your email" : "your username"} to confirm`}
              hint={expected}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <div className="flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <Button variant="ghost">Cancel</Button>
              </AlertDialog.Cancel>
              <Button type="submit" variant="danger" disabled={!matches} loading={remove.isPending}>
                Delete my account
              </Button>
            </div>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export default function AccountPage() {
  const { data: me } = useMe();
  const [toastNode, toast] = useToast();
  if (!me) return null; // RequireUser has already loaded it

  const since = me.created_at ? `Member since ${day(me.created_at)}` : null;
  return (
    <>
      <PageHeader title="Account" description={since} />
      <div className="flex max-w-3xl flex-col gap-6">
        <Section id="profile" title="Profile">
          <NameForm me={me} toast={toast} />
          {me.username && me.username !== me.email && (
            <p className="mt-4 text-xs text-fg-muted">
              Username from the previous app: <span className="text-fg-2">{me.username}</span>. You can keep signing in
              with it.
            </p>
          )}
        </Section>
        <Section
          id="email"
          title="Email"
          description={
            me.email
              ? "Where we send password resets and security notices."
              : "Add an email so you can reset your password if you forget it."
          }
        >
          <EmailForm me={me} />
        </Section>
        <Section id="password" title="Password" description="Changing it signs out your other devices.">
          <PasswordForm />
        </Section>
        <Section id="appearance" title="Appearance">
          <ThemePicker />
        </Section>
        <Section
          id="devices"
          title="Devices"
          description={
            me.last_login_at
              ? `Last sign-in ${day(me.last_login_at)}. Lost a phone? Sign out everywhere.`
              : "Lost a phone? Sign out everywhere."
          }
        >
          <SignOutEverywhere />
        </Section>
        <Section id="delete" title="Delete account" description="Permanently remove your account and your data." danger>
          <DeleteAccount me={me} />
        </Section>
      </div>
      {toastNode}
    </>
  );
}
