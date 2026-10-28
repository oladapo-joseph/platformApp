/** "Last session | Period" with presets and custom dates (US-2.5). Dates are WAT trade dates. */
import { Popover } from "radix-ui";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/controls";
import { earliestStart, matchPreset, presetRange, PRESETS, type Preset } from "@/lib/market";

import type { MarketParams } from "./useMarketParams";

type Choice = Preset | "custom";

export function PeriodControls({ p, latest }: { p: MarketParams; latest: string }) {
  const preset: Choice | null = p.period && p.start && p.end ? (matchPreset(p.start, p.end, latest) ?? "custom") : null;
  const [customOpen, setCustomOpen] = useState(false);

  const pick = (choice: Choice) => {
    if (choice === "custom") return setCustomOpen(true);
    p.update(presetRange(choice, latest));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        label="Market view"
        value={p.period ? "period" : "session"}
        onChange={(v) => (v === "session" ? p.update({ start: null, end: null }) : pick("1M"))}
        options={[
          { value: "session", label: "Last session" },
          { value: "period", label: "Period" },
        ]}
      />
      {p.period && (
        <>
          <SegmentedControl<Choice>
            label="Period"
            value={preset}
            onChange={pick}
            options={[...PRESETS.map((v) => ({ value: v, label: v })), { value: "custom" as const, label: "Custom" }]}
          />
          <CustomRange
            open={customOpen}
            onOpenChange={setCustomOpen}
            latest={latest}
            start={p.start ?? latest}
            end={p.end ?? latest}
            onApply={(start, end) => p.update({ start, end })}
          />
        </>
      )}
    </div>
  );
}

function CustomRange({
  open,
  onOpenChange,
  latest,
  start,
  end,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latest: string;
  start: string;
  end: string;
  onApply: (start: string, end: string) => void;
}) {
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  const min = earliestStart(latest);
  const valid = from >= min && to <= latest && from <= to;
  const input =
    "touch-target num h-10 w-full rounded-md border border-line-input bg-surface px-3 text-sm text-fg [color-scheme:inherit]";
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setFrom(start);
          setTo(end);
        }
        onOpenChange(o);
      }}
    >
      {/* the "Custom" segment opens it; this anchor keeps the popover beside the controls */}
      <Popover.Anchor />
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-(--z-dropdown) w-72 rounded-lg border border-line bg-raised p-4 shadow-md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              onApply(from, to);
              onOpenChange(false);
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-sm font-medium text-fg">Custom period</p>
            <label className="flex flex-col gap-1 text-sm text-fg-2">
              From
              <input
                type="date"
                className={input}
                value={from}
                min={min}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-fg-2">
              To
              <input
                type="date"
                className={input}
                value={to}
                min={from}
                max={latest}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <p className="text-xs text-fg-muted">Up to 3 years, ending on or before the latest session.</p>
            <Button type="submit" disabled={!valid}>
              Show period
            </Button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
