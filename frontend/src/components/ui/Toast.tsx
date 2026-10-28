import { CircleCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/** Brief confirmation (docs/06 §6 Toast): polite live region, gone after 5 s. Never for errors that need action. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(t);
  }, [message]);
  const show = useCallback((m: string) => setMessage(m), []);
  const node = (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--layout-bottomnav-h)+16px)] z-(--z-toast) flex justify-center px-4 md:bottom-6"
    >
      {message && (
        <p className="inline-flex items-center gap-2 rounded-md border border-line bg-raised px-4 py-2.5 text-sm text-fg shadow-md">
          <CircleCheck aria-hidden className="size-4 text-brand" />
          {message}
        </p>
      )}
    </div>
  );
  return [node, show] as const;
}
