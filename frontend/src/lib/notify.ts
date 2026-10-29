/** One app-wide toast (docs/06 §6), for messages raised from many places at once: watchlist stars. */

export type Note = {
  id: number;
  message: string;
  tone: "success" | "error";
  action?: { label: string; run: () => void };
};

let note: Note | null = null;
let timer = 0;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function subscribeNote(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const currentNote = (): Note | null => note;

export function dismissNote() {
  window.clearTimeout(timer);
  note = null;
  emit();
}

/** While the pointer or focus is on the toast it stays (an Undo must be reachable). */
export const holdNote = () => window.clearTimeout(timer);

export function releaseNote() {
  window.clearTimeout(timer);
  timer = window.setTimeout(dismissNote, 5000);
}

/** Shows `message` in the shell's toast for 5 s, replacing any other. */
export function notify(message: string, opts: { tone?: Note["tone"]; action?: Note["action"] } = {}) {
  note = { id: ++seq, message, tone: opts.tone ?? "success", action: opts.action };
  emit();
  releaseNote();
}
