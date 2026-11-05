/**
 * Help (US-6.5): how EquityLensNG works, where the data comes from and how fresh it is, a
 * searchable glossary (each term an anchor that explainers link to), and the fine print.
 */
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import { DISCLAIMER } from "@/components/layout/AuthLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/feedback";
import { GLOSSARY, searchGlossary, type Term } from "@/lib/glossary";
import { useMediaQuery } from "@/lib/hooks";

const GROUPS: Term["group"][] = ["Prices", "Market", "Indicators", "Signals and AI", "Company events"];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="scroll-mt-24 p-5 md:p-6" id={id}>
      <h2 className="font-headline text-2xl font-semibold text-fg">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-fg-2">{children}</div>
    </Card>
  );
}

export default function HelpPage() {
  const [q, setQ] = useState("");
  const { hash } = useLocation();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const found = searchGlossary(q);

  // /app/help#rsi from an explainer: bring the term into view and mark it for a moment
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    el.setAttribute("data-flash", "");
    const t = window.setTimeout(() => el.removeAttribute("data-flash"), 2500);
    return () => window.clearTimeout(t);
  }, [hash, reduced]);

  return (
    <>
      <PageHeader
        title="Help"
        description="How EquityLensNG works, where its data comes from, and what the terms mean."
      />
      <nav aria-label="On this page" className="mb-6 flex flex-wrap gap-2 text-sm">
        {[
          ["#how", "How it works"],
          ["#data", "Data and freshness"],
          ["#glossary", "Glossary"],
          ["#fine-print", "Fine print"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="touch-target rounded-full border border-line px-3 py-1 text-fg-2 hover:border-line-input hover:text-fg"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="flex max-w-3xl flex-col gap-6">
        <Section id="how" title="How EquityLensNG works">
          <p>
            EquityLensNG follows every stock on the Nigerian Exchange (NGX). <strong className="text-fg">Market</strong>{" "}
            shows the latest session or any period: what rose, what fell, what traded most and how each sector did.
          </p>
          <p>
            A <strong className="text-fg">stock page</strong> has the price chart with indicators you can add, and{" "}
            <strong className="text-fg">signals</strong>: dates when one of three strategies' rules was met. Signals are
            worked out on a stock's whole history, so the range you pick doesn't change them. They describe what an
            indicator did; they aren't advice.
          </p>
          <p>
            <strong className="text-fg">AI readings</strong> explain, in plain English and only when you ask, what the
            signals and indicators show for the stock and range you're looking at, and which headlines were considered.
            You have 5 new readings a day; a reading someone already asked for on the same data is shared and free. AI
            can be wrong.
          </p>
          <p>
            Your <strong className="text-fg">watchlist</strong> keeps the stocks you follow at the top of Market, with
            their news. <strong className="text-fg">News</strong> gathers headlines about Nigerian companies and
            markets, tagged with the stocks, sectors and topics they mention.
          </p>
        </Section>

        <Section id="data" title="Data and freshness">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-fg">Prices</strong> come from NGX's public market data, collected about every 35
              minutes from 09:00 to 16:40 WAT on weekdays. The time in the top bar says how fresh they are.
            </li>
            <li>
              NGX trades from 09:30 to 15:55 WAT on weekdays. Each session's close is the last price NGX reports for
              that trading day. On weekends and public holidays you see the last session.
            </li>
            <li>
              <strong className="text-fg">News</strong> is collected automatically about every 4 hours and kept for 90
              days. Headlines link to the original article; we never copy full articles. Tagging is automatic and can
              miss or misplace a story.
            </li>
            <li>
              <strong className="text-fg">Company details</strong> (name, sector, shares outstanding) come from NGX's
              listings.
            </li>
          </ul>
        </Section>

        <Section id="glossary" title="Glossary">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
            />
            <label htmlFor="glossary-q" className="sr-only">
              Search the glossary
            </label>
            <input
              id="glossary-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search terms, e.g. RSI or market cap"
              className="touch-target h-10 w-full rounded-xl border border-line-input bg-surface pr-3 pl-9 text-base text-fg placeholder:text-fg-muted"
            />
          </div>
          <p role="status" className="text-sm text-fg-muted">
            {q.trim() ? `${found.length} of ${GLOSSARY.length} terms` : `${GLOSSARY.length} terms`}
          </p>
          {found.length === 0 && <p>No term matches “{q.trim()}”. Try a shorter word.</p>}
          {GROUPS.map((group) => {
            const terms = found.filter((t) => t.group === group);
            if (!terms.length) return null;
            return (
              <section key={group} aria-labelledby={`g-${group}`}>
                <h3 id={`g-${group}`} className="eyebrow mt-2 text-fg-muted">
                  {group}
                </h3>
                <dl className="mt-1 divide-y divide-line-subtle">
                  {terms.map((t) => (
                    <div
                      key={t.id}
                      id={t.id}
                      className="scroll-mt-24 rounded-sm py-3 transition-[background-color,box-shadow] duration-(--duration-slow) data-flash:bg-selected data-flash:shadow-[0_0_0_8px_var(--color-selected)]"
                    >
                      <dt className="font-medium text-fg">
                        {t.term}
                        {t.aka?.length ? (
                          <span className="font-normal text-fg-muted"> · {t.aka.join(", ")}</span>
                        ) : null}
                      </dt>
                      <dd className="mt-1">{t.body}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </Section>

        <Section id="fine-print" title="Disclaimer, privacy and terms">
          <p>{DISCLAIMER}</p>
          <p>
            Read the full{" "}
            <Link to="/terms" className="font-medium text-brand underline underline-offset-2">
              terms
            </Link>{" "}
            and the{" "}
            <Link to="/terms#privacy" className="font-medium text-brand underline underline-offset-2">
              privacy notice
            </Link>
            . You can turn off usage statistics or delete your account in{" "}
            <Link to="/app/account" className="font-medium text-brand underline underline-offset-2">
              Account
            </Link>
            .
          </p>
        </Section>
      </div>
    </>
  );
}
