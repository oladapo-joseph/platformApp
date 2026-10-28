/** SegmentedControl and Tabs (docs/06 §6), on Radix ToggleGroup and Tabs. */
import { Tabs as RadixTabs, ToggleGroup } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface Segment<T extends string> {
  value: T;
  label: ReactNode;
  /** Spoken label when `label` is short or an icon */
  ariaLabel?: string;
}

/** Single choice from 2–6 options: range, chart type, Snapshot/Period. Never empty. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: Segment<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value ?? ""}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("inline-flex rounded-md border border-line bg-sunken p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          aria-label={o.ariaLabel}
          className={cn(
            "touch-target rounded-[6px] px-3 font-medium whitespace-nowrap text-fg-2 transition-colors duration-(--duration-instant)",
            "hover:text-fg data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-sm",
            size === "sm" ? "h-7 text-xs" : "h-8 text-sm",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: ReactNode; content: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={(v) => onChange(v as T)} className={className}>
      <RadixTabs.List aria-label={label} className="flex gap-1 border-b border-line-subtle">
        {tabs.map((t) => (
          <RadixTabs.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              "touch-target -mb-px h-10 border-b-2 border-transparent px-3 text-sm font-medium text-fg-2 hover:text-fg",
              "data-[state=active]:border-brand data-[state=active]:text-fg",
            )}
          >
            {t.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((t) => (
        <RadixTabs.Content key={t.value} value={t.value} className="pt-2">
          {t.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
