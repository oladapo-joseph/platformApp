/** Only same-app paths are accepted as a post-sign-in destination (no open redirects). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app/market";
}
