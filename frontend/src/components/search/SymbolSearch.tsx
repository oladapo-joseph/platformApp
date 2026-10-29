/**
 * Find any stock (US-3.1): "/" or Ctrl/⌘ K anywhere, or the search button. A combobox over the
 * cached directory: arrows move, Enter opens, Esc closes. Empty query → recent and popular
 * stocks. Full-screen on phones, a centred palette on desktop.
 */
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Search, TrendingUp, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { useDirectory } from "@/api/market";
import type { DirectoryEntry, Snapshot } from "@/api/types";
import { cn } from "@/lib/cn";
import { OPEN_SEARCH_EVENT, POPULAR_FALLBACK, rankStocks, recentStocks, rememberStock, splitMatch } from "@/lib/search";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function Highlight({ text, query }: { text: string; query: string }) {
  const [before, match, after] = splitMatch(text, query);
  return (
    <>
      {before}
      {match && <mark className="rounded-sm bg-brand-subtle text-fg">{match}</mark>}
      {after}
    </>
  );
}

export function SymbolSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const palette = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (palette || (e.key === "/" && !isTyping(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="touch-target flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-fg-muted shadow-elev-1 hover:border-line-input max-md:w-10 max-md:justify-center max-md:px-0 md:w-80"
        aria-keyshortcuts="/ Control+K Meta+K"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="max-md:sr-only">Search stocks</span>
        <kbd className="num ml-auto rounded-sm border border-line px-1.5 text-xs text-fg-muted max-md:hidden">/</kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-canvas/70 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed z-(--z-modal) flex flex-col bg-raised shadow-lg",
            "inset-0 md:inset-x-0 md:top-[12vh] md:bottom-auto md:mx-auto md:max-h-[70vh] md:w-full md:max-w-xl md:rounded-xl md:border md:border-line",
          )}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Search stocks</Dialog.Title>
          {open && <Palette onClose={() => setOpen(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: directory = [], isPending } = useDirectory();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  const bySymbol = useMemo(() => new Map(directory.map((d) => [d.symbol, d])), [directory]);
  const popular = useMemo(() => {
    // the most traded names from today's snapshot when it's cached, else the fallback list
    const snap = qc.getQueryData<Snapshot>(["market", "snapshot", "latest"]);
    const symbols = snap
      ? [...snap.stocks]
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
          .slice(0, 5)
          .map((s) => s.symbol)
      : POPULAR_FALLBACK;
    return symbols.map((s) => bySymbol.get(s)).filter((d): d is DirectoryEntry => !!d);
  }, [qc, bySymbol]);
  const recent = useMemo(
    () =>
      recentStocks()
        .map((s) => bySymbol.get(s))
        .filter((d): d is DirectoryEntry => !!d),
    [bySymbol],
  );

  const results = rankStocks(directory, query);
  const sections: { title: string; icon: typeof Clock; items: DirectoryEntry[] }[] = query.trim()
    ? results.length
      ? [{ title: "Stocks", icon: Search, items: results }]
      : [{ title: "Popular", icon: TrendingUp, items: popular }]
    : [
        ...(recent.length ? [{ title: "Recent", icon: Clock, items: recent }] : []),
        { title: "Popular", icon: TrendingUp, items: popular.filter((p) => !recent.includes(p)) },
      ];
  const flat = sections.flatMap((s) => s.items);
  const current = Math.min(active, Math.max(flat.length - 1, 0));

  const go = (entry: DirectoryEntry | undefined) => {
    if (!entry) return;
    rememberStock(entry.symbol);
    onClose();
    void navigate(`/app/stocks/${entry.symbol}`);
  };

  let index = -1;
  return (
    <>
      <div className="flex items-center gap-2 border-b border-line-subtle px-4">
        <Search aria-hidden className="size-5 shrink-0 text-fg-muted" />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={flat.length ? `${listId}-${current}` : undefined}
          aria-label="Search by ticker or company name"
          placeholder="Ticker or company name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((current + 1) % Math.max(flat.length, 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((current - 1 + flat.length) % Math.max(flat.length, 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(flat[current]);
            }
          }}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-muted"
          autoComplete="off"
          spellCheck={false}
        />
        <Dialog.Close
          aria-label="Close search"
          className="touch-target flex size-9 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"
        >
          <X aria-hidden className="size-5" />
        </Dialog.Close>
      </div>
      <div className="overflow-y-auto p-2">
        {query.trim() && !results.length && !isPending && (
          <p role="status" className="px-3 pt-3 pb-1 text-sm text-fg-2">
            No stocks match “{query.trim()}”.
          </p>
        )}
        <ul id={listId} role="listbox" aria-label="Stocks">
          {sections.map((section) => (
            <li key={section.title} role="presentation">
              <p className="eyebrow flex items-center gap-1.5 px-3 pt-3 pb-1 text-fg-muted" aria-hidden>
                <section.icon className="size-3.5" />
                {section.title}
              </p>
              <ul role="group" aria-label={section.title}>
                {section.items.map((entry) => {
                  index += 1;
                  const i = index;
                  return (
                    <li
                      key={`${section.title}-${entry.symbol}`}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === current}
                      onPointerMove={() => setActive(i)}
                      onClick={() => go(entry)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5",
                        i === current && "bg-hover",
                      )}
                    >
                      <span className="num w-28 shrink-0 text-sm font-medium text-fg">
                        <Highlight text={entry.symbol} query={query} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-fg-2">
                        <Highlight text={entry.company} query={query} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <p className="hidden border-t border-line-subtle px-4 py-2 text-xs text-fg-muted md:block">
        ↑ ↓ to move · Enter to open · Esc to close
      </p>
    </>
  );
}
