/**
 * News markers under the price chart (US-9.2): one per trading day with news about the stock, a
 * count when there's more than one story. Hover, focus or tap shows the day's headlines; picking
 * one shows it in the News panel. They sit in their own band, so they never cover signal markers.
 */
import { ArrowUpRight, Newspaper } from "lucide-react";
import { Popover } from "radix-ui";
import { useRef, useState } from "react";

import type { NewsDay } from "@/api/types";
import { day } from "@/lib/dates";

export type Headline = NewsDay["headlines"][number];

/** What a picked headline can do: be shown in the News panel when it's there, else open at the source. */
export interface NewsPick {
  inPanel: (id: string) => boolean;
  show: (h: Headline) => void;
}

/** A marker at `x` px across the chart; nearby days are merged, so `dates` can hold several. */
export interface NewsSpot {
  key: string;
  x: number;
  dates: string[];
  count: number;
  headlines: Headline[];
}

const stories = (n: number) => `${n} news ${n === 1 ? "story" : "stories"}`;

function Marker({ spot, pick }: { spot: NewsSpot; pick: NewsPick }) {
  const [open, setOpen] = useState(false);
  const how = useRef<"hover" | "focus" | "press">("press");
  const timer = useRef(0);
  const show = (via: "hover" | "focus") => {
    window.clearTimeout(timer.current);
    if (!open) how.current = via;
    setOpen(true);
  };
  const hideSoon = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 200);
  };
  const when = spot.dates.length > 1 ? `${day(spot.dates[0])} – ${day(spot.dates.at(-1))}` : day(spot.dates[0]);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) how.current = "press";
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${stories(spot.count)}, ${when}`}
          // a click on headlines already shown by hover or focus keeps them open (and holds them there)
          onClick={(e) => {
            if (open && how.current !== "press") {
              e.preventDefault();
              how.current = "press";
            }
          }}
          onPointerEnter={(e) => e.pointerType === "mouse" && show("hover")}
          onPointerLeave={(e) => e.pointerType === "mouse" && how.current === "hover" && hideSoon()}
          onFocus={() => show("focus")}
          onBlur={() => how.current === "focus" && hideSoon()}
          style={{ left: spot.x }}
          className="absolute top-1 flex h-6 min-w-6 -translate-x-1/2 items-center justify-center gap-0.5 rounded-full border border-line bg-sunken px-1 text-xs text-fg-2 hover:border-brand hover:text-fg focus-visible:border-brand"
        >
          <Newspaper aria-hidden className="size-3.5" />
          {spot.count > 1 && <span className="num">{spot.count}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          // opened by hover or focus: leave focus where it is; pressed: move into the list
          onOpenAutoFocus={(e) => how.current !== "press" && e.preventDefault()}
          onPointerEnter={() => window.clearTimeout(timer.current)}
          onPointerLeave={() => how.current === "hover" && hideSoon()}
          className="z-(--z-dropdown) w-[min(20rem,calc(100vw-24px))] rounded-lg border border-line bg-raised p-3 text-sm shadow-md"
        >
          <p className="eyebrow text-fg-muted">
            {when} · {stories(spot.count)}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {spot.headlines.map((h) => (
              <li key={h.id}>
                {pick.inPanel(h.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      pick.show(h);
                    }}
                    className="text-left text-fg underline-offset-2 hover:text-brand hover:underline"
                  >
                    {h.title || h.source}
                  </button>
                ) : (
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-fg underline-offset-2 hover:text-brand hover:underline"
                  >
                    {h.title || h.source}
                    <ArrowUpRight aria-hidden className="ml-0.5 inline size-3.5 text-fg-muted" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
                <span className="block text-xs text-fg-muted">{h.source}</span>
              </li>
            ))}
          </ul>
          {spot.count > spot.headlines.length && (
            <p className="mt-2 text-xs text-fg-muted">and {spot.count - spot.headlines.length} more</p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function NewsStrip({ spots, pick }: { spots: NewsSpot[]; pick: NewsPick }) {
  return (
    <div role="group" aria-label="Days with news" className="relative h-8">
      {spots.map((s) => (
        <Marker key={s.key} spot={s} pick={pick} />
      ))}
    </div>
  );
}
