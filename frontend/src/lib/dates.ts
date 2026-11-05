/** Dates and times in WAT (Africa/Lagos), labelled, never numeric day/month (docs/06 §3). */
import { TZDate } from "@date-fns/tz";
import { format, isValid, parseISO } from "date-fns";

export const TZ = "Africa/Lagos";

type When = string | Date | null | undefined;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toWat(value: When): TZDate | null {
  if (!value) return null;
  // a trade date ("2026-10-24") is a WAT calendar day: never shift it through the browser's zone
  const m = typeof value === "string" ? DATE_ONLY.exec(value) : null;
  if (m) return new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), TZ);
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? new TZDate(d, TZ) : null;
}

/** 26 Oct 2026 */
export function day(value: When): string {
  const d = toWat(value);
  return d ? format(d, "d MMM yyyy") : "—";
}

/** Fri 24 Oct */
export function weekday(value: When): string {
  const d = toWat(value);
  return d ? format(d, "EEE d MMM") : "—";
}

/** 14:35 WAT */
export function time(value: When): string {
  const d = toWat(value);
  return d ? `${format(d, "HH:mm")} WAT` : "—";
}

/** 14:35 WAT · 26 Oct */
export function stamp(value: When): string {
  const d = toWat(value);
  return d ? `${format(d, "HH:mm")} WAT · ${format(d, "d MMM")}` : "—";
}

/** 2026-10-26 (the WAT calendar day, as the API's trade dates are written) */
export function isoDay(value: When): string | null {
  const d = toWat(value);
  return d ? format(d, "yyyy-MM-dd") : null;
}

/** Minutes past midnight in WAT, for "closing data after 15:55" */
export function watMinutes(value: When): number | null {
  const d = toWat(value);
  return d ? d.getHours() * 60 + d.getMinutes() : null;
}
