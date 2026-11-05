/**
 * The glossary on /app/help (US-6.5): plain-English terms used across the app. Each entry's id is
 * its anchor (/app/help#rsi), which in-app explainers link to. Definitions describe; none advise.
 */
export interface Term {
  id: string;
  term: string;
  /** Other names people search for */
  aka?: string[];
  body: string;
  group: "Prices" | "Market" | "Indicators" | "Signals and AI" | "Company events";
}

export const GLOSSARY: Term[] = [
  // ── prices ────────────────────────────────────────────────────────────────
  {
    id: "ohlc",
    term: "Open, high, low, close",
    aka: ["OHLC"],
    group: "Prices",
    body: "The first, highest, lowest and last prices of a stock in one trading session. The close is the price most charts and changes are based on.",
  },
  {
    id: "previous-close",
    term: "Previous close",
    group: "Prices",
    body: "The closing price of the session before. Today's change is measured from it.",
  },
  {
    id: "change",
    term: "Change",
    aka: ["% change", "percentage change"],
    group: "Prices",
    body: "How far the price moved from the previous close, in naira (₦) and as a percentage. Over a period, it's measured from the first session's open to the last session's close.",
  },
  {
    id: "candlestick",
    term: "Candlestick",
    aka: ["candle"],
    group: "Prices",
    body: "One bar per session on the chart. The thick body spans the open and close, and the thin wicks reach the high and low. Green means the close was above the open; red means below.",
  },
  {
    id: "volume",
    term: "Volume",
    group: "Prices",
    body: "How many shares changed hands in a session. A move on high volume involved more trading than the same move on thin volume.",
  },
  {
    id: "value",
    term: "Value traded",
    aka: ["turnover"],
    group: "Prices",
    body: "The naira amount of all the trades in a stock in a session: roughly volume × price. Most traded on Market Today ranks stocks by it.",
  },
  {
    id: "deals",
    term: "Deals",
    aka: ["trades"],
    group: "Prices",
    body: "The number of separate trades in a session. Many deals means many buyers and sellers took part, not just a few large orders.",
  },
  {
    id: "liquidity",
    term: "Liquidity",
    aka: ["thin trading"],
    group: "Prices",
    body: "How easily a stock trades without its price jumping. Thinly traded stocks can move sharply on a single small order, so their charts and signals need more care.",
  },
  // ── market ────────────────────────────────────────────────────────────────
  {
    id: "ngx",
    term: "NGX",
    aka: ["Nigerian Exchange"],
    group: "Market",
    body: "The Nigerian Exchange, where the stocks in EquityLensNG are listed and traded. Prices are in naira.",
  },
  {
    id: "session",
    term: "Trading session",
    aka: ["trade date"],
    group: "Market",
    body: "One trading day on NGX, Monday to Friday, 09:30 to 15:55 WAT, except public holidays. Prices are grouped by the session NGX reports them for, not by when we collected them.",
  },
  {
    id: "market-cap",
    term: "Market capitalisation",
    aka: ["market cap"],
    group: "Market",
    body: "What the market values a whole company at: shares outstanding × the latest close.",
  },
  {
    id: "shares-outstanding",
    term: "Shares outstanding",
    group: "Market",
    body: "The number of a company's shares held by all its shareholders.",
  },
  {
    id: "sector",
    term: "Sector and subsector",
    group: "Market",
    body: "The industry group NGX lists a company under, such as Financial Services, with a narrower subsector such as Banking.",
  },
  {
    id: "breadth",
    term: "Market breadth",
    aka: ["gainers", "losers", "advancers", "decliners"],
    group: "Market",
    body: "How many stocks rose (gainers), fell (losers) or didn't move in a session. It shows whether a move was broad or carried by a few stocks.",
  },
  {
    id: "asi",
    term: "All-Share Index",
    aka: ["ASI", "NGX ASI"],
    group: "Market",
    body: "NGX's index of all listed stocks, weighted by their size; the most quoted measure of the Nigerian market. EquityLensNG will add it when the data source does.",
  },
  // ── indicators ────────────────────────────────────────────────────────────
  {
    id: "sma",
    term: "Simple moving average",
    aka: ["SMA", "SMA 50", "SMA 200", "moving average"],
    group: "Indicators",
    body: "The average close of the last N sessions, drawn as a line that smooths out daily noise. SMA 50 follows the medium-term trend; SMA 200 the long-term trend.",
  },
  {
    id: "ema",
    term: "Exponential moving average",
    aka: ["EMA", "EMA 12", "EMA 26"],
    group: "Indicators",
    body: "A moving average that gives recent sessions more weight, so it turns sooner than a simple average. EMA 12 and EMA 26 are the building blocks of MACD.",
  },
  {
    id: "rsi",
    term: "Relative Strength Index",
    aka: ["RSI", "RSI 14"],
    group: "Indicators",
    body: "A score from 0 to 100 comparing the size of recent gains with recent losses, here over 14 sessions. Readings above 70 are called overbought and below 30 oversold.",
  },
  {
    id: "overbought",
    term: "Overbought and oversold",
    group: "Indicators",
    body: "Labels for an RSI above 70 (the price has risen fast) or below 30 (it has fallen fast). They describe how stretched a move is; a stock can stay overbought or oversold for a long time.",
  },
  {
    id: "macd",
    term: "MACD",
    aka: ["moving average convergence divergence", "MACD 12/26/9"],
    group: "Indicators",
    body: "The gap between the 12-day and 26-day EMAs. When it's positive and growing, the short-term average is pulling away above the long-term one: momentum is up.",
  },
  {
    id: "signal-line",
    term: "Signal line",
    group: "Indicators",
    body: "The 9-day EMA of MACD. MACD crossing it is what the MACD Crossover strategy marks.",
  },
  {
    id: "macd-histogram",
    term: "MACD histogram",
    group: "Indicators",
    body: "The bars under the MACD lines: MACD minus its signal line. Bars above zero mean MACD is above the signal line; shrinking bars mean the two are converging.",
  },
  {
    id: "bollinger",
    term: "Bollinger Bands",
    aka: ["Bollinger 20", "BB"],
    group: "Indicators",
    body: "A band two standard deviations either side of the 20-day average. The band widens when prices swing more; a close outside it is an unusually large move for that stock.",
  },
  {
    id: "volatility",
    term: "Volatility",
    group: "Indicators",
    body: "How much a price swings from day to day. EquityLensNG measures it as the spread (standard deviation) of daily percentage changes over the last 20 sessions.",
  },
  {
    id: "trend",
    term: "Trend",
    group: "Indicators",
    body: "The general direction of a price over weeks or months. Moving averages help show it: a price above a rising average is in an uptrend.",
  },
  {
    id: "momentum",
    term: "Momentum",
    group: "Indicators",
    body: "How strongly and quickly a price is moving in its current direction. RSI and MACD are momentum indicators.",
  },
  {
    id: "support",
    term: "Support",
    group: "Indicators",
    body: "A price level where falls have tended to stop, often a recent low or a moving average.",
  },
  {
    id: "resistance",
    term: "Resistance",
    group: "Indicators",
    body: "A price level where rises have tended to stall, often a recent high.",
  },
  // ── signals and AI ────────────────────────────────────────────────────────
  {
    id: "signal",
    term: "Signal",
    group: "Signals and AI",
    body: "A dated event where a strategy's rule was met, such as MACD crossing its signal line. A signal describes what an indicator did; it isn't a recommendation to buy or sell.",
  },
  {
    id: "crossover",
    term: "Crossover",
    aka: ["bullish crossover", "bearish crossover"],
    group: "Signals and AI",
    body: "One line crossing another on the chart. A bullish crossover is the faster line moving above the slower one; a bearish crossover is the reverse.",
  },
  {
    id: "golden-cross",
    term: "Golden cross",
    group: "Signals and AI",
    body: "The 50-day average crossing above the 200-day average: the medium-term trend turning up through the long-term one.",
  },
  {
    id: "death-cross",
    term: "Death cross",
    group: "Signals and AI",
    body: "The 50-day average crossing below the 200-day average: the reverse of a golden cross.",
  },
  {
    id: "bullish",
    term: "Bullish and bearish",
    aka: ["bullish", "bearish", "neutral"],
    group: "Signals and AI",
    body: "Bullish describes signs pointing to rising prices; bearish, to falling prices; neutral, to neither. An AI reading's stance uses these words.",
  },
  {
    id: "confidence",
    term: "Confidence",
    group: "Signals and AI",
    body: "In an AI reading, how much the signals and indicators agree: high when they point the same way, low when they disagree, history is short or trading is thin.",
  },
  {
    id: "ai-reading",
    term: "AI reading",
    aka: ["AI signal interpretation"],
    group: "Signals and AI",
    body: "A plain-English summary, written by an AI model on request, of what a strategy's signals and the indicators show, with the headlines it considered. It can be wrong and never tells you what to do.",
  },
  // ── company events ────────────────────────────────────────────────────────
  {
    id: "dividend",
    term: "Dividend",
    group: "Company events",
    body: "Part of a company's profit paid to its shareholders, usually per share. Shareholders on the register by the qualification date receive it.",
  },
  {
    id: "bonus-issue",
    term: "Bonus issue",
    group: "Company events",
    body: "Free new shares given to existing shareholders in proportion to what they hold, for example 1 for every 10. The share price usually adjusts down to match.",
  },
  {
    id: "rights-issue",
    term: "Rights issue",
    group: "Company events",
    body: "An offer to existing shareholders to buy new shares, usually below the market price, in proportion to what they hold. It raises money for the company.",
  },
];

/** Matches the term, its other names, or its definition. */
export function searchGlossary(query: string, terms: Term[] = GLOSSARY): Term[] {
  const q = query.trim().toLowerCase();
  if (!q) return terms;
  return terms.filter(
    (t) =>
      t.term.toLowerCase().includes(q) ||
      t.aka?.some((a) => a.toLowerCase().includes(q)) ||
      t.body.toLowerCase().includes(q),
  );
}
