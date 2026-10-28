/** Card, Badge, Banner, Skeleton, EmptyState and ErrorState (docs/06 §6). */
import { AlertTriangle, Info, OctagonAlert, Sparkles, type LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { ApiError, NetworkError } from "@/api/client";
import { cn } from "@/lib/cn";

import { Button } from "./Button";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card-shadow rounded-lg border border-line bg-surface", className)} {...rest} />;
}

export type Tone = "neutral" | "brand" | "gain" | "loss" | "warning" | "info" | "ai" | "danger";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-sunken text-fg-2",
  brand: "bg-brand-subtle text-brand",
  gain: "bg-gain-subtle text-gain",
  loss: "bg-loss-subtle text-loss",
  warning: "bg-warning-subtle text-warning",
  info: "bg-info-subtle text-info",
  ai: "bg-ai-subtle text-ai",
  danger: "bg-danger-subtle text-danger",
};

export function Badge({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
      {...rest}
    />
  );
}

type BannerTone = "info" | "warning" | "danger" | "ai";

const bannerStyle: Record<BannerTone, { box: string; icon: LucideIcon; iconClass: string }> = {
  info: { box: "bg-info-subtle border-info", icon: Info, iconClass: "text-info" },
  warning: { box: "bg-warning-subtle border-warning", icon: AlertTriangle, iconClass: "text-warning" },
  danger: { box: "bg-danger-subtle border-danger", icon: OctagonAlert, iconClass: "text-danger" },
  ai: { box: "bg-ai-subtle border-ai", icon: Sparkles, iconClass: "text-ai" },
};

/** role="status", or "alert" for errors (docs/06 §6). */
export function Banner({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const s = bannerStyle[tone];
  const Icon = s.icon;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-md border-l-4 px-4 py-3 text-sm text-fg", s.box, className)}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", s.iconClass)} />
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-fg-2")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-hover motion-reduce:animate-none", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {Icon && <Icon aria-hidden className="size-8 text-fg-muted" />}
      <p className="text-lg font-medium text-fg">{title}</p>
      {children && <div className="max-w-prose text-sm text-fg-2">{children}</div>}
      {action}
    </div>
  );
}

/** Plain-language cause + retry, with the request ID for support (docs/06 §6, US-8.4). */
export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const message =
    error instanceof ApiError || error instanceof NetworkError
      ? error.message
      : "Something went wrong on our side. Please try again.";
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <OctagonAlert aria-hidden className="size-8 text-danger" />
      <p className="text-lg font-medium text-fg">{title ?? "This didn't load"}</p>
      <p className="max-w-prose text-sm text-fg-2">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
      {requestId && <p className="text-xs text-fg-muted">Reference: {requestId}</p>}
    </div>
  );
}

/** A form-level error the user can act on, announced as it appears. */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-fg">
      {message}
    </p>
  );
}
