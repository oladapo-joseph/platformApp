import { Star } from "lucide-react";

import { useSetWatched, useWatchlist } from "@/api/watchlist";
import { cn } from "@/lib/cn";
import { notify } from "@/lib/notify";

/**
 * ☆/★ (US-5.1): adds or removes the stock at once and puts it back, with a message, if the server
 * refuses. `label` adds visible text (the stock header's "Watchlist", a ticker on a chip); elsewhere
 * it's the icon. `undoable` offers "Undo" for 5 s after a removal (the watchlist page, US-5.2).
 */
export function WatchStar({
  symbol,
  label,
  undoable = false,
  className,
}: {
  symbol: string;
  label?: string;
  undoable?: boolean;
  className?: string;
}) {
  const { data } = useWatchlist();
  const set = useSetWatched();
  const on = !!data?.symbols.includes(symbol);
  const toggle = () => {
    set.mutate({ symbol, on: !on });
    if (on && undoable) {
      notify(`Removed ${symbol} from your watchlist`, {
        action: { label: "Undo", run: () => set.mutate({ symbol, on: true }) },
      });
    }
  };
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
      disabled={!data}
      onClick={toggle}
      className={cn(
        "touch-target inline-flex shrink-0 items-center justify-center gap-2 rounded-md transition-colors duration-(--duration-instant) hover:bg-hover disabled:opacity-50",
        label ? "h-8 border border-line px-3 text-sm font-medium" : "size-9",
        // one colour class at a time: cn() doesn't merge, so the later CSS rule would win
        on ? "text-brand" : label ? "text-fg" : "text-fg-muted hover:text-fg",
        className,
      )}
    >
      <Star aria-hidden className={cn("size-4", on && "fill-current")} />
      {label && <span className={label === symbol ? "num" : undefined}>{label}</span>}
    </button>
  );
}
