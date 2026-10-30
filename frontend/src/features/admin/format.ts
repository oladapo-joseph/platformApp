/** Admin helpers that aren't components. */
import { ApiError } from "@/api/client";
import { notify } from "@/lib/notify";

/** "3 h ago", for the title of an absolute time (US-7.7 UX notes). */
export function ago(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "";
  const s = Math.round((now - new Date(value).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** A failed admin action: the API's plain-words detail when there is one. */
export function failed(error: unknown, fallback = "That didn't work. Try again.") {
  notify(error instanceof ApiError ? error.detail : fallback, { tone: "error" });
}

export const selectClass = "touch-target h-9 rounded-md border border-line-input bg-surface px-2 text-sm text-fg";
export const inputClass =
  "touch-target h-9 rounded-md border border-line-input bg-surface px-3 text-sm text-fg placeholder:text-fg-muted";
