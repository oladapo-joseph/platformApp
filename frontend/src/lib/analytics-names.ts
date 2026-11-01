/** Plain names for the usage report (US-7.8): route templates and feature events as people say them. */

const PAGES: Record<string, string> = {
  "/app": "Market today",
  "/app/market": "Market today",
  "/app/stocks": "Stock search",
  "/app/stocks/:symbol": "Stock page",
  "/app/news": "News",
  "/app/watchlist": "Watchlist",
  "/app/account": "Account",
  "/app/admin": "Admin",
};

export function pageName(path: string): string {
  if (PAGES[path]) return PAGES[path];
  if (path.startsWith("/app/admin/")) return `Admin · ${path.slice("/app/admin/".length)}`;
  return path;
}

/** Every feature event the app sends (lib/analytics.ts and data-track attributes). */
export const FEATURES: Record<string, string> = {
  "watchlist.add": "Starred a stock",
  "watchlist.remove": "Unstarred a stock",
  "search.open": "Opened search",
  "search.pick": "Picked a search result",
  "market.view": "Switched session or period",
  "market.sector": "Filtered the market by sector",
  "market.movers": "Switched movers tab",
  "market.sectors_view": "Switched sector view",
  "market.period": "Picked a period length",
  "stock.range": "Changed chart range",
  "stock.chart": "Changed chart type",
  "stock.strategy": "Changed signal strategy",
  "stock.share": "Shared a stock",
  "stock.tab": "Switched stock panel",
  "stock.news_sort": "Sorted a stock's news",
  "stock.peers_sort": "Sorted peers",
  "ai.explain": "Asked for an AI reading",
  "news.filter": "Filtered news",
  "news.sort": "Sorted news",
  "news.open": "Opened a news story",
  "watchlist.period": "Changed watchlist period",
  "watchlist.tab": "Switched watchlist tab",
  "theme.change": "Changed theme",
};

export const featureName = (name: string) => FEATURES[name] ?? name;
