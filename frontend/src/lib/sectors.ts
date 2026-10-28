const ACRONYMS = new Set(["ICT", "ETF", "REIT"]);

/** "FINANCIAL SERVICES" → "Financial services", "ICT" stays "ICT" (NGX writes sectors in capitals). */
export function sectorName(sector: string): string {
  const lower = sector.toLowerCase();
  const sentence = lower.charAt(0).toUpperCase() + lower.slice(1);
  return sentence.replace(/[a-z]+/gi, (w) => (ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w));
}
