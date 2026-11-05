import type { MarketStatus } from "@/api/types";

import { isoDay, stamp, watMinutes, weekday } from "./dates";

/** The wording of US-2.3 and docs/06 §7, separated from rendering so it can be tested. */
export function freshness(status: MarketStatus, now: Date = new Date()) {
  const asOf = status.data_as_of;
  if (!asOf) return { text: "No data yet", stale: false };
  const age = status.data_age_minutes ?? 0;
  // Weekend, holiday, or before today's open: the newest session isn't today's (in WAT)
  const latest = status.latest_trade_date;
  if (!status.is_trading_hours && latest && latest < (isoDay(now) ?? latest)) {
    return { text: `Markets closed · showing ${weekday(latest)}`, stale: false };
  }
  const minutes = watMinutes(asOf) ?? 0;
  const closing = minutes >= 15 * 60 + 55; // NGX closes at 15:55 WAT
  return {
    text: `${closing ? "Closing data" : "Data as of"} ${stamp(asOf)}`,
    stale: status.is_trading_hours && age > 120,
  };
}
