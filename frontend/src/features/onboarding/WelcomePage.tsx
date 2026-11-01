/**
 * First run (US-1.8): "Which stocks do you follow?" on one screen, straight after accepting an
 * invite. Up to 10 picks from the most traded or a search join the watchlist and lead Market;
 * "Skip for now" goes straight to Market. Only the invite leads here, so it's seen once.
 */
import { useQueryClient } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { api } from "@/api/client";
import { useDirectory, useSnapshot } from "@/api/market";
import type { DirectoryEntry, Watchlist } from "@/api/types";
import { watchlistKey } from "@/api/watchlist";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, FormError, Skeleton } from "@/components/ui/feedback";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { POPULAR_FALLBACK, rankStocks } from "@/lib/search";

const MAX = 10;
const POPULAR = 8;

function Pick({
  entry,
  on,
  full,
  onToggle,
}: {
  entry: DirectoryEntry;
  on: boolean;
  full: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!on && full}
      onClick={onToggle}
      className={cn(
        "touch-target flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
        on ? "border-brand bg-brand-subtle" : "border-line bg-surface hover:border-line-input",
        !on && full && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          on ? "border-brand bg-brand text-on-brand" : "border-line-input",
        )}
      >
        {on && <Check className="size-3.5" />}
      </span>
      <span className="min-w-0">
        <span className="num block text-sm font-semibold text-fg">{entry.symbol}</span>
        <span className="block truncate text-xs text-fg-2">{entry.company}</span>
      </span>
    </button>
  );
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const directory = useDirectory();
  const snapshot = useSnapshot();
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bySymbol = useMemo(() => new Map((directory.data ?? []).map((e) => [e.symbol, e])), [directory.data]);
  // the most traded by value in the latest session; a fixed list if there's no data (US-1.8)
  const popular = useMemo(() => {
    const traded = [...(snapshot.data?.stocks ?? [])]
      .filter((s) => (s.value ?? 0) > 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .map((s) => s.symbol);
    const symbols = traded.length ? traded.slice(0, POPULAR) : POPULAR_FALLBACK;
    return symbols.map((s) => bySymbol.get(s)).filter((e): e is DirectoryEntry => !!e);
  }, [snapshot.data, bySymbol]);
  const matches = rankStocks(directory.data ?? [], q, 6);
  const full = picked.length >= MAX;

  const toggle = (symbol: string) =>
    setPicked((p) => (p.includes(symbol) ? p.filter((s) => s !== symbol) : p.length < MAX ? [...p, symbol] : p));

  const toMarket = () => void navigate("/app/market", { replace: true });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      let list: Watchlist | undefined;
      for (const symbol of picked) list = await api<Watchlist>(`/me/watchlist/${symbol}`, { method: "PUT" });
      if (list) qc.setQueryData(watchlistKey, list);
      track("onboarding.picked", { count: picked.length });
      toMarket();
    } catch {
      setError("Some stocks weren't added. Try again, or skip and star them later.");
      void qc.invalidateQueries({ queryKey: watchlistKey });
    } finally {
      setSaving(false);
    }
  };

  const chosen = picked.map((s) => bySymbol.get(s)).filter((e): e is DirectoryEntry => !!e);
  const extra = chosen.filter((e) => !popular.some((p) => p.symbol === e.symbol));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Which stocks do you follow?"
        description="Pick up to 10 you own or watch. They go on your watchlist and lead the Market page. You can change them any time."
      />
      <Card className="flex flex-col gap-5 p-5 md:p-6">
        <div>
          <h2 className="eyebrow text-fg-muted">Most traded</h2>
          {directory.isPending ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: POPULAR }, (_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[...popular, ...extra].map((e) => (
                <Pick
                  key={e.symbol}
                  entry={e}
                  on={picked.includes(e.symbol)}
                  full={full}
                  onToggle={() => toggle(e.symbol)}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="welcome-q" className="eyebrow text-fg-muted">
            Find another
          </label>
          <div className="relative mt-2">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
            />
            <input
              id="welcome-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ticker or company, e.g. Dangote"
              className="touch-target h-10 w-full rounded-xl border border-line-input bg-surface pr-3 pl-9 text-base text-fg placeholder:text-fg-muted"
            />
          </div>
          {q.trim() && (
            <div aria-label="Matching stocks" role="group" className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {matches.length ? (
                matches.map((e) => (
                  <Pick
                    key={e.symbol}
                    entry={e}
                    on={picked.includes(e.symbol)}
                    full={full}
                    onToggle={() => toggle(e.symbol)}
                  />
                ))
              ) : (
                <p className="text-sm text-fg-2">No stock matches “{q.trim()}”.</p>
              )}
            </div>
          )}
        </div>

        <FormError message={error} />
        <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
          <Button onClick={() => void save()} loading={saving} disabled={!picked.length}>
            {picked.length ? `Add ${picked.length} and continue` : "Pick a stock to continue"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              track("onboarding.skipped");
              toMarket();
            }}
          >
            Skip for now
          </Button>
          <p role="status" className="ml-auto text-sm text-fg-muted">
            {picked.length} of {MAX} picked
          </p>
        </div>
      </Card>
    </div>
  );
}
