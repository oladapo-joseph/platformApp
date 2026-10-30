/**
 * First-party usage analytics (US-7.8): page views and named feature events from the signed-in
 * app, batched to POST /events. Only route templates (/app/stocks/:symbol) and a few chosen values
 * (a ticker, a range) are sent, never anything typed; the server stores a pseudonym, not the user.
 * Nothing is sent while the account has it turned off.
 */
import { api, warmCsrf } from "@/api/client";
import type { EventBatch } from "@/api/types";

type Event = EventBatch["events"][number];
type Props = Record<string, string | number | boolean>;

const BATCH = 20;
const EVERY_MS = 10_000;

let queue: Event[] = [];
let enabled = false;
let timer = 0;
let session = "";
let current: { path: string; since: number } | null = null;

function newId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 24);
}

/** One session per tab and person: someone else signing in on this tab starts a new one. */
function sessionFor(user: string): string {
  try {
    const [who, id] = (sessionStorage.getItem("el-sid") ?? "").split(":");
    if (who === user && id) return id;
    const fresh = newId();
    sessionStorage.setItem("el-sid", `${user}:${fresh}`);
    return fresh;
  } catch {
    return newId();
  }
}

function device(): EventBatch["device"] {
  const w = window.innerWidth;
  return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

export function flush(): void {
  window.clearTimeout(timer);
  timer = 0;
  if (!queue.length || !session) return;
  const events = queue.splice(0, 50);
  // keepalive: a batch sent as the tab closes still arrives; a failure is dropped, never retried
  void api("/events", { method: "POST", body: { session, device: device(), events }, keepalive: true }).catch(
    () => undefined,
  );
}

const onHide = () => {
  if (document.visibilityState === "hidden") flush();
};

/** From the app shell: on for a signed-in user who hasn't turned it off; returns the stop function. */
export function startTracking(user: string, allowed: boolean): () => void {
  enabled = allowed;
  session = sessionFor(user);
  if (!allowed) queue = [];
  else warmCsrf(); // the last batch goes as the tab closes: no time then to fetch a token
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
  return () => {
    flush();
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", flush);
    enabled = false;
    current = null;
  };
}

function push(e: Omit<Event, "at">): void {
  if (!enabled) return;
  queue.push({ ...e, at: new Date().toISOString() });
  if (queue.length >= BATCH) flush();
  else if (!timer) timer = window.setTimeout(flush, EVERY_MS);
}

/** A new screen (not a filter change on the same one), with how long the last one was open. */
export function pageView(path: string, props: Props = {}): void {
  if (current?.path === path) return;
  const now = Date.now();
  push({ name: "page_view", path, prev: current?.path ?? null, prev_ms: current ? now - current.since : null, props });
  current = { path, since: now };
}

/** A feature used; names are listed with their plain words in lib/analytics-names.ts. */
export function track(name: string, props: Props = {}): void {
  if (current) push({ name, path: current.path, props });
}

/** /app/stocks/MTNN with { symbol: "MTNN" } → /app/stocks/:symbol */
export function routeTemplate(pathname: string, params: Record<string, string | undefined>): string {
  let path = pathname.replace(/\/+$/, "") || "/";
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "*")
      path = path.replace(`/${encodeURIComponent(value)}`, `/:${key}`).replace(`/${value}`, `/:${key}`);
  }
  return path;
}
