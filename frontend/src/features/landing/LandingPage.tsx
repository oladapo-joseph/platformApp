/** Public front door (US-1.1). The full page, with screenshots and feature sections, comes in P3d. */
import { CandlestickChart, Newspaper, Sparkles } from "lucide-react";
import { Link } from "react-router";

import { useMe } from "@/api/auth";
import { DISCLAIMER } from "@/components/layout/AuthLayout";
import { buttonClass } from "@/components/ui/buttonClass";
import { Logo } from "@/components/ui/Logo";

const FEATURES = [
  {
    icon: CandlestickChart,
    title: "Every NGX stock, charted",
    body: "Prices, volume and the classic indicators, by the trading day.",
  },
  {
    icon: Newspaper,
    title: "News that's about the stock",
    body: "Headlines matched to the companies they mention, and to their sector.",
  },
  {
    icon: Sparkles,
    title: "Signals, explained",
    body: "Plain-language readings of what the indicators are showing. Never advice.",
  },
];

export default function LandingPage() {
  const { data: me } = useMe();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-(--layout-content-max) items-center justify-between px-4 py-4 md:px-8">
        <Logo />
        <Link to={me ? "/app/market" : "/login"} className={buttonClass("ghost")}>
          {me ? "Open the app" : "Sign in"}
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-(--layout-content-max) flex-1 flex-col justify-center px-4 py-16 md:px-8">
        <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-fg md:text-5xl">
          See the Nigerian Exchange clearly.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-fg-2">
          Market data, technical analysis and news for NGX equities, in one calm place. Built for people who invest
          their own money.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {me ? (
            <Link to="/app/market" className={buttonClass("primary", "lg")}>
              Go to the market
            </Link>
          ) : (
            <>
              <Link to="/request-invite" className={buttonClass("primary", "lg")}>
                Request an invite
              </Link>
              <Link to="/login" className={buttonClass("secondary", "lg")}>
                Sign in
              </Link>
            </>
          )}
        </div>
        <ul className="mt-16 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-2">
              <Icon aria-hidden className="size-6 text-brand" />
              <p className="font-medium text-fg">{title}</p>
              <p className="text-sm text-fg-2">{body}</p>
            </li>
          ))}
        </ul>
      </main>
      <footer className="mx-auto w-full max-w-(--layout-content-max) px-4 py-8 text-xs text-fg-muted md:px-8">
        <p className="max-w-3xl">{DISCLAIMER}</p>
        <p className="mt-2">
          <Link to="/terms" className="underline-offset-2 hover:underline">
            Terms and disclaimer
          </Link>
        </p>
      </footer>
    </div>
  );
}
