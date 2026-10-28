/** Terms and disclaimer (US-6.5). The full terms wait for the legal review (D-06). */
import { Link } from "react-router";

import { DISCLAIMER } from "@/components/layout/AuthLayout";
import { Logo } from "@/components/ui/Logo";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" aria-label="EquityLensNG home">
        <Logo />
      </Link>
      <main className="mt-10">
        <h1 className="text-3xl font-semibold tracking-tight text-fg">Terms and disclaimer</h1>
        <h2 className="mt-8 text-xl font-semibold text-fg">Not investment advice</h2>
        <p className="mt-2 text-fg-2">{DISCLAIMER}</p>
        <h2 className="mt-8 text-xl font-semibold text-fg">The data</h2>
        <p className="mt-2 text-fg-2">
          Prices come from the Nigerian Exchange's public market data, collected through the trading day. They are not
          real-time and may be delayed or incomplete. Every screen shows when its data is from, in WAT.
        </p>
        <h2 className="mt-8 text-xl font-semibold text-fg">News</h2>
        <p className="mt-2 text-fg-2">
          Headlines are collected automatically from public sources and matched to stocks by software, so a match can be
          wrong. We show the source and link to it; we never reproduce full articles.
        </p>
        <p className="mt-10 text-sm text-fg-muted">The full terms of use are being finalised and will appear here.</p>
      </main>
    </div>
  );
}
