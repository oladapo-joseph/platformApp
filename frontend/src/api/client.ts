/**
 * The only way the app talks to the API: same-origin fetch with the session cookie,
 * the CSRF header on every unsafe method (ADR-005), and problem+json errors turned into
 * ApiError. A 401 "session-expired" is broadcast so the shell can send the user to sign in.
 */

const BASE = "/api/v1";
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiError extends Error {
  readonly status: number;
  /** Stable slug from the problem `type`, e.g. "bad-credentials", "rate-limited", "csrf" */
  readonly slug: string;
  readonly detail: string;
  readonly requestId: string | undefined;
  readonly field: string | undefined;
  readonly retryAfter: number | undefined;

  constructor(status: number, body: Record<string, unknown>) {
    const detail = typeof body.detail === "string" ? body.detail : "Something went wrong. Please try again.";
    super(detail);
    this.status = status;
    this.slug = typeof body.type === "string" ? (body.type.split("/problems/")[1] ?? "error") : "error";
    this.detail = detail;
    this.requestId = typeof body.request_id === "string" ? body.request_id : undefined;
    this.field = typeof body.field === "string" ? body.field : undefined;
    this.retryAfter = typeof body.retry_after === "number" ? body.retry_after : undefined;
  }
}

/** The server couldn't be reached at all (offline, DNS, server down). */
export class NetworkError extends Error {
  constructor() {
    super("Can't reach EquityLensNG. Check your connection and try again.");
  }
}

type SessionListener = () => void;
const sessionEnded = new Set<SessionListener>();

export function onSessionEnded(fn: SessionListener): () => void {
  sessionEnded.add(fn);
  return () => {
    sessionEnded.delete(fn);
  };
}

// Responses index.html's boot script requested while this code was downloading, by URL. A GET
// takes its match once, in the first seconds only (never a stale answer), so the first screen's
// data needn't wait for the app to start (P3 criterion 3).
const early: Partial<Record<string, Promise<Response>>> =
  (globalThis as { __early?: Partial<Record<string, Promise<Response>>> }).__early ?? {};

function takeEarly(href: string): Promise<Response> | undefined {
  const res = early[href];
  early[href] = undefined;
  return performance.now() < 10_000 ? res : undefined;
}

let csrfToken: Promise<string> | null = null;

function csrf(): Promise<string> {
  csrfToken ??= fetch(`${BASE}/auth/csrf`, { credentials: "same-origin" })
    .then((r) => r.json() as Promise<{ csrf_token: string }>)
    .then((b) => b.csrf_token)
    .catch((e: unknown) => {
      csrfToken = null;
      throw e;
    });
  return csrfToken;
}

export type Query = Record<string, string | number | boolean | null | undefined | readonly string[]>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Let a small write finish even if the page unloads (a ☆ tapped just before closing the tab) */
  keepalive?: boolean;
}

function url(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) v.forEach((item) => params.append(k, String(item)));
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ""}`;
}

async function send(path: string, opts: RequestOptions, retried = false): Promise<Response> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (UNSAFE.has(method)) headers["X-CSRF-Token"] = await csrf();

  const href = url(path, opts.query);
  const started = method === "GET" ? takeEarly(href) : undefined;
  if (started) {
    const res = await started.catch(() => null);
    if (res) return res; // a network failure falls through to a fresh request
  }

  let res: Response;
  try {
    res = await fetch(href, {
      method,
      headers,
      credentials: "same-origin",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      keepalive: opts.keepalive,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new NetworkError();
  }

  if (res.status === 403 && UNSAFE.has(method) && !retried) {
    const body = (await res
      .clone()
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.type === "string" && body.type.endsWith("/csrf")) {
      csrfToken = null; // cookie cleared or secret rotated: fetch a fresh token and retry once
      return send(path, opts, true);
    }
  }
  return res;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts);
  if (res.status === 204 || res.status === 304) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const err = new ApiError(res.status, (body ?? {}) as Record<string, unknown>);
    if (err.status === 401 && err.slug === "session-expired") sessionEnded.forEach((fn) => fn());
    throw err;
  }
  return body as T;
}

/** Fetch the CSRF token ahead of time, so a write sent as the page unloads (usage events) needn't wait for it. */
export function warmCsrf(): void {
  void csrf().catch(() => undefined);
}

/** For a body that isn't JSON (the audit CSV): the same CSRF and errors as `api`, the Response as is. */
export async function apiResponse(path: string, opts: RequestOptions = {}): Promise<Response> {
  const res = await send(path, opts);
  if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))) as Record<string, unknown>);
  return res;
}

/** Start with a fresh CSRF token after signing out. */
export function resetCsrf(): void {
  csrfToken = null;
}
