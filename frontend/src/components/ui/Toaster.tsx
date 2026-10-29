import { CircleAlert, CircleCheck } from "lucide-react";
import { useSyncExternalStore } from "react";

import { currentNote, dismissNote, holdNote, releaseNote, subscribeNote } from "@/lib/notify";

/** Mounted once, in the app shell: the polite live region every `notify` writes to. */
export function Toaster() {
  const note = useSyncExternalStore(subscribeNote, currentNote, () => null);
  const Icon = note?.tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--layout-bottomnav-h)+16px)] z-(--z-toast) flex justify-center px-4 md:bottom-6"
    >
      {note && (
        <p
          key={note.id}
          onMouseEnter={holdNote}
          onMouseLeave={releaseNote}
          onFocus={holdNote}
          onBlur={releaseNote}
          className="pointer-events-auto inline-flex items-center gap-3 rounded-md border border-line bg-raised px-4 py-2.5 text-sm text-fg shadow-md"
        >
          <Icon
            aria-hidden
            className={note.tone === "error" ? "size-4 shrink-0 text-danger" : "size-4 shrink-0 text-brand"}
          />
          {note.message}
          {note.action && (
            <button
              type="button"
              onClick={() => {
                note.action?.run();
                dismissNote();
              }}
              className="touch-target -my-1 rounded-sm px-1 font-medium text-brand underline-offset-2 hover:underline"
            >
              {note.action.label}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
