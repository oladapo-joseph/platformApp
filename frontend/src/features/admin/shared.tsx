/** Pieces the admin pages share: confirm dialogs, timestamps with a relative hint, section cards. */
import { AlertDialog } from "radix-ui";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/feedback";
import { day, time } from "@/lib/dates";

import { ago } from "./format";

/** 26 Oct 2026 · 14:35 WAT, with "3 h ago" on hover and focus. */
export function When({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className={className}>—</span>;
  return (
    <time dateTime={value} title={ago(value)} className={className}>
      {day(value)} · {time(value)}
    </time>
  );
}

const overlay = "fixed inset-0 z-(--z-overlay) bg-canvas/70 backdrop-blur-sm";
const content =
  "fixed top-1/2 left-1/2 z-(--z-modal) w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-raised p-6 shadow-lg";

/** An action that needs a second look (deactivate, revoke, decline, bulk approve). */
export function Confirm({
  trigger,
  title,
  description,
  confirm,
  danger = false,
  onConfirm,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirm: string;
  danger?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content className={content}>
          <AlertDialog.Title className="font-headline text-xl font-semibold text-fg">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-fg-2">{description}</AlertDialog.Description>
          {children && <div className="mt-4">{children}</div>}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              variant={danger ? "danger" : "primary"}
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              {confirm}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-xl font-semibold text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-fg-2">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}
