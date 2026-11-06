/**
 * Public front door (US-1.1): what EquityLensNG does and who it's for, real screenshots (static
 * images in both themes, so no chart code loads here), how invite-only access works, and the
 * disclaimer. Signed-in visitors go straight to the market.
 */
import { CandlestickChart, Check, Clock, Mail, Newspaper, Signal, UserCheck, type LucideIcon } from "lucide-react";
import { Link, Navigate } from "react-router";

import { useMe } from "@/api/auth";
import { DISCLAIMER } from "@/components/layout/AuthLayout";
import { buttonClass } from "@/components/ui/buttonClass";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";

/** Captured by scripts/landing-shots.mjs: public/landing/<name>-<theme>.jpg at 1280×800 (2× density). */
function Screenshot({ name, alt, eager = false }: { name: string; alt: string; eager?: boolean }) {
  const common = {
    width: 1280,
    height: 800,
    loading: eager ? ("eager" as const) : ("lazy" as const),
    decoding: "async" as const,
    className: "h-auto w-full",
  };
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-elev-2">
      <img src={`/landing/${name}-dark.jpg`} alt={alt} {...common} className={cn(common.className, "only-dark")} />
      <img src={`/landing/${name}-light.jpg`} alt={alt} {...common} className={cn(common.className, "only-light")} />
    </div>
  );
}

const FEATURES: { icon: LucideIcon; title: string; body: string; points: string[]; shot: string; alt: string }[] = [
  {
    icon: CandlestickChart,
    title: "The whole market at a glance",
    body: "How the day went, in one screen: the biggest movers, every sector, and the full price list.",
    points: ["Gainers, losers and the most traded", "Sector map sized by market value", "Any past session or period"],
    shot: "market",
    alt: "The Market Today screen: summary figures, top gainers and losers, and a sector map.",
  },
  {
    icon: Signal,
    title: "Every NGX stock, charted",
    body: "Daily prices and volume with the classic indicators, and the signals they produced, in plain words.",
    points: [
      "Moving averages, Bollinger bands, RSI, MACD",
      "Bullish and bearish signals described, never advised",
      "Similar stocks and a CSV download",
    ],
    shot: "stock",
    alt: "A stock page: candlestick price chart with moving averages and a volume pane, and a list of signals.",
  },
  {
    icon: Newspaper,
    title: "News that's about the stock",
    body: "Headlines matched to the companies, sectors and regulators they mention, so you can see what moved a price.",
    points: ["Filter by topic: earnings, dividends, rates…", "Every story links to its source", "90 days of headlines"],
    shot: "news",
    alt: "The News page: headlines with ticker and topic chips, and filters for topic, stock and date.",
  },
];

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Mail, title: "Request an invite", body: "Your name and email. No password, no payment." },
  { icon: UserCheck, title: "We review every request", body: "A person on the team reads each one while we're small." },
  { icon: Check, title: "Open your invite", body: "Set a password and you're in, about a minute later." },
];

function Cta({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <Link to="/request-invite" className={buttonClass("primary", "lg")}>
        Request an invite
      </Link>
      <Link to="/login" className={buttonClass("secondary", "lg")}>
        Sign in
      </Link>
    </div>
  );
}

const wrap = "mx-auto w-full max-w-(--layout-content-max) px-4 md:px-8";

export default function LandingPage() {
  const { data: me } = useMe();
  if (me) return <Navigate to="/app/market" replace />;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className={cn(wrap, "flex items-center justify-between py-4")}>
        <Logo />
        <Link to="/login" className={buttonClass("ghost")}>
          Sign in
        </Link>
      </header>

      <main className="flex-1">
        <section
          aria-labelledby="hero"
          className={cn(wrap, "grid items-center gap-10 pt-8 pb-16 md:pt-16 lg:grid-cols-[5fr_7fr]")}
        >
          <div>
            <p className="eyebrow text-brand">For Nigerian Exchange investors</p>
            <h1
              id="hero"
              className="mt-3 font-headline text-5xl leading-[1.05] font-semibold tracking-tight text-fg md:text-6xl"
            >
              See the Nigerian market clearly.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-fg-2">
              Prices, charts and news for every NGX stock, in one calm place, explained in plain language. Built for
              people who invest their own money.
            </p>
            <Cta className="mt-8" />
            <p className="mt-4 flex items-center gap-2 text-sm text-fg-muted">
              <Clock aria-hidden className="size-4 shrink-0" />
              Free while invite-only. Market data refreshes about every 35 minutes while the market is open.
            </p>
          </div>
          <Screenshot name="market" alt={FEATURES[0]?.alt ?? ""} eager />
        </section>

        <section aria-labelledby="features" className="border-y border-line-subtle bg-surface py-16">
          <div className={wrap}>
            <h2
              id="features"
              className="max-w-2xl font-headline text-3xl font-semibold tracking-tight text-fg md:text-4xl"
            >
              What you can do with it
            </h2>
            <div className="mt-12 flex flex-col gap-16">
              {FEATURES.slice(1).map((f, i) => (
                <article key={f.title} className="grid items-center gap-8 lg:grid-cols-2">
                  <div className={cn(i % 2 === 1 && "lg:order-2")}>
                    <f.icon aria-hidden className="size-6 text-brand" />
                    <h3 className="mt-3 font-headline text-2xl font-semibold text-fg">{f.title}</h3>
                    <p className="mt-2 text-fg-2">{f.body}</p>
                    <ul className="mt-4 flex flex-col gap-2">
                      {f.points.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm text-fg-2">
                          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Screenshot name={f.shot} alt={f.alt} />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="honest" className={cn(wrap, "py-16")}>
          <h2 id="honest" className="max-w-2xl font-headline text-3xl font-semibold tracking-tight text-fg md:text-4xl">
            Information, not advice
          </h2>
          <p className="mt-4 max-w-2xl text-fg-2">
            EquityLensNG describes what the data shows. It never tells you to buy or sell. Every screen says when its
            data is from, in WAT, and every headline links to where it came from.
          </p>
        </section>

        <section aria-labelledby="access" className="border-t border-line-subtle bg-surface py-16">
          <div className={wrap}>
            <h2 id="access" className="font-headline text-3xl font-semibold tracking-tight text-fg md:text-4xl">
              How access works
            </h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span
                    aria-hidden
                    className="num flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="flex items-center gap-2 font-medium text-fg">
                      <s.icon aria-hidden className="size-4 text-fg-muted" />
                      {s.title}
                    </p>
                    <p className="mt-1 text-sm text-fg-2">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Cta className="mt-10" />
          </div>
        </section>
      </main>

      <footer className={cn(wrap, "border-t border-line-subtle py-8 text-xs text-fg-muted")}>
        <p className="max-w-3xl">{DISCLAIMER}</p>
        <nav aria-label="Legal" className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <Link to="/terms#disclaimer" className="underline-offset-2 hover:underline">
            Disclaimer
          </Link>
          <Link to="/terms#privacy" className="underline-offset-2 hover:underline">
            Privacy
          </Link>
          <Link to="/terms" className="underline-offset-2 hover:underline">
            Terms
          </Link>
        </nav>
        <p className="mt-3">© {new Date().getFullYear()} EquityLensNG</p>
      </footer>
    </div>
  );
}
