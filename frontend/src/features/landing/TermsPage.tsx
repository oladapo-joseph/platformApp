/** Terms, disclaimer and privacy (US-1.1, US-6.5). The full terms wait for the legal review (D-06). */
import { useEffect } from "react";
import { Link, useLocation } from "react-router";

import { DISCLAIMER } from "@/components/layout/AuthLayout";
import { Logo } from "@/components/ui/Logo";

export default function TermsPage() {
  const { hash } = useLocation();
  // the landing footer links to #disclaimer and #privacy
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" aria-label="EquityLensNG home">
        <Logo />
      </Link>
      <main className="mt-10">
        <h1 className="font-headline text-4xl font-semibold tracking-tight text-fg">Terms, disclaimer and privacy</h1>
        <h2 id="disclaimer" className="mt-8 scroll-mt-6 font-headline text-2xl font-semibold text-fg">
          Not investment advice
        </h2>
        <p className="mt-2 text-fg-2">{DISCLAIMER}</p>
        <h2 className="mt-8 font-headline text-2xl font-semibold text-fg">The data</h2>
        <p className="mt-2 text-fg-2">
          Prices come from the Nigerian Exchange's public market data, collected through the trading day. They are not
          real-time and may be delayed or incomplete. Every screen shows when its data is from, in WAT.
        </p>
        <h2 className="mt-8 font-headline text-2xl font-semibold text-fg">News</h2>
        <p className="mt-2 text-fg-2">
          Headlines are collected automatically from public sources and matched to stocks by software, so a match can be
          wrong. We show the source and link to it; we never reproduce full articles.
        </p>
        <h2 id="privacy" className="mt-8 scroll-mt-6 font-headline text-2xl font-semibold text-fg">
          Privacy
        </h2>
        <p className="mt-2 text-fg-2">
          We keep what the service needs: your name and email, your password (stored only as a one-way hash), your
          watchlist and theme, how many AI readings you've used today, and your sign-in sessions. For security, sign-ins
          and account changes are recorded with the IP address and browser that made them, and that record is kept for
          365 days. If you request an invite, we keep your request so the team can review it.
        </p>
        <p className="mt-2 text-fg-2">
          We don't sell your data or show ads. Email goes through our email provider only to send you account messages.
          You can delete your account at any time from the Account page; that removes your account, watchlist and usage,
          while the security record stays until its 365 days are up.
        </p>
        <p className="mt-10 text-sm text-fg-muted">
          The full terms of use and privacy policy are being finalised and will appear here.
        </p>
      </main>
    </div>
  );
}
