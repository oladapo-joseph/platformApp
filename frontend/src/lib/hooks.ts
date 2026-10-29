import { useEffect, useState, useSyncExternalStore } from "react";

/** `useMediaQuery("(min-width: 1024px)")`: true while the query matches. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Current values of CSS custom properties (chart colours), re-read when the theme changes:
 * the user's choice (el-theme-change) or the OS setting. Charts never hard-code colours.
 */
export function useCssVars<K extends string>(names: readonly K[]): Record<K, string> {
  const read = () =>
    Object.fromEntries(
      names.map((n) => [n, getComputedStyle(document.documentElement).getPropertyValue(n).trim()]),
    ) as Record<K, string>;
  const [values, setValues] = useState(read);
  const key = names.join(",");
  useEffect(() => {
    const update = () => setValues(read());
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    window.addEventListener("el-theme-change", update);
    mql.addEventListener("change", update);
    return () => {
      window.removeEventListener("el-theme-change", update);
      mql.removeEventListener("change", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures `names`
  }, [key]);
  return values;
}

/** A value that settles `ms` after the last change (search-as-you-type). */
export function useDebounced<T>(value: T, ms = 200): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/**
 * False until the frame after `ready` first turns true has painted. Lets a page show what's above
 * the fold before it builds heavy sections below it (P3 criterion 3); stays true afterwards.
 */
export function useAfterPaint(ready: boolean): boolean {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    if (!ready || painted) return;
    let timer = 0;
    // a frame callback runs just before the paint; the timeout after it
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setPainted(true));
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [ready, painted]);
  return ready && painted;
}
