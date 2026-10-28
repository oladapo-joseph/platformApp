import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  /** Sits at the right of the label row, e.g. "Forgot password?" (US-1.5) */
  labelAside?: ReactNode;
}

const inputClass = (invalid: boolean) =>
  cn(
    "touch-target h-10 w-full rounded-md border bg-surface px-3 text-base text-fg placeholder:text-fg-muted",
    "read-only:bg-sunken read-only:text-fg-2 disabled:opacity-50",
    invalid ? "border-danger" : "border-line-input",
  );

function Frame({
  id,
  label,
  hint,
  error,
  labelAside,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  labelAside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {labelAside}
      </div>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

/** Labelled input: the label is always visible, errors are linked by aria-describedby (docs/06 §6). */
export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, hint, error, labelAside, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Frame id={fieldId} label={label} hint={hint} error={error} labelAside={labelAside}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(inputClass(!!error), className)}
        {...rest}
      />
    </Frame>
  );
});

/** Password with a show/hide toggle; paste and password managers always work (ASVS 6.2.6, 6.2.7). */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, "type">>(function PasswordField(
  { label, hint, error, labelAside, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  const [shown, setShown] = useState(false);
  return (
    <Frame id={fieldId} label={label} hint={hint} error={error} labelAside={labelAside}>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, hint, error)}
          className={cn(inputClass(!!error), "pr-11", className)}
          spellCheck={false}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="touch-target absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-md text-fg-muted hover:text-fg"
        >
          {shown ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
        </button>
      </div>
    </Frame>
  );
});

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  error?: string | undefined;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={cn("mt-0.5 size-5 shrink-0 accent-(--color-brand)", className)}
          {...rest}
        />
        <label htmlFor={fieldId} className="text-sm text-fg-2">
          {label}
        </label>
      </div>
      {error && (
        <p id={`${fieldId}-error`} className="pl-8 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
});

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Frame id={fieldId} label={label} hint={hint} error={error}>
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(inputClass(!!error), "h-auto min-h-20 py-2", className)}
        {...rest}
      />
    </Frame>
  );
});
