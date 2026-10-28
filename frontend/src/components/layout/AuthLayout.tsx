import type { ReactNode } from "react";
import { Link } from "react-router";

import { Card } from "@/components/ui/feedback";
import { Logo } from "@/components/ui/Logo";

export const DISCLAIMER =
  "EquityLensNG provides market data and educational analysis, not investment advice. Signals and AI interpretations can be wrong. Do your own research or consult a licensed adviser.";

/** Centred card for sign-in, invites and password pages: logo, one task, the standard disclaimer. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:justify-center">
      <Link to="/" className="mb-8" aria-label="EquityLensNG home">
        <Logo />
      </Link>
      <main className="w-full max-w-md">
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-fg-2">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
        {footer && <div className="mt-6 text-center text-sm text-fg-2">{footer}</div>}
      </main>
      <p className="mt-10 max-w-md text-center text-xs text-fg-muted">{DISCLAIMER}</p>
    </div>
  );
}

export const textLink = "font-medium text-brand underline-offset-2 hover:underline";
