// Screenshots for the landing page (US-1.1), in both themes, plus the link-preview image.
//
//   EL_EMAIL=you@example.com EL_PASSWORD=… node scripts/landing-shots.mjs [base-url]
//
// Signs in to a running app (default http://localhost:4173, i.e. `npm run preview` with the
// backend on :8000), opens the market, a stock and the news, and writes
// public/landing/<name>-<dark|light>.jpg (1280×800) and public/og-image.png (1200×630).
// Run it against real data before launch: the images are what visitors see first.
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2] ?? "http://localhost:4173";
const { EL_EMAIL: email, EL_PASSWORD: password } = process.env;
if (!email || !password) {
  console.error("Set EL_EMAIL and EL_PASSWORD to an account on that server.");
  process.exit(1);
}

const SHOTS = [
  { name: "market", path: "/app/market" },
  { name: "stock", path: "/app/stocks/MTNN?overlays=sma50,bb20" },
  { name: "news", path: "/app/news" },
];
const out = join(root, "public", "landing");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: theme });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`);
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app/market");
  for (const shot of SHOTS) {
    await page.goto(`${base}${shot.path}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600); // chart animation and fonts
    const file = join(out, `${shot.name}-${theme}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 82 });
    console.log("wrote", file);
  }
  await ctx.close();
}

// Link preview (WhatsApp, X, LinkedIn): logo, tagline and one line, on the brand canvas.
const tokens = readFileSync(join(root, "..", "design", "tokens.css"), "utf8");
const logo = readFileSync(join(root, "..", "brand", "equitylens-logo-horizontal-dark.svg"), "utf8");
const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, colorScheme: "dark" });
await og.setContent(
  `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&display=block" />
<style>${tokens}
  body { margin: 0; width: 1200px; height: 630px; display: flex; flex-direction: column; justify-content: center;
         gap: 36px; padding: 0 96px; box-sizing: border-box; background: var(--color-bg-canvas);
         font-family: "IBM Plex Sans", system-ui, sans-serif; }
  .logo svg { height: 72px; width: auto; }
  h1 { margin: 0; font-size: 64px; line-height: 1.1; font-weight: 600; color: var(--color-text-primary); }
  p { margin: 0; font-size: 30px; color: var(--color-text-secondary); }
  .bar { width: 120px; height: 8px; border-radius: 4px; background: var(--color-brand); }
</style></head><body><div class="logo">${logo}</div><div class="bar"></div>
<h1>See the Nigerian market clearly.</h1><p>Prices, charts and news for every NGX stock, in plain language.</p></body></html>`,
  { waitUntil: "networkidle" },
);
await og.evaluate(() => document.fonts.ready);
await og.screenshot({ path: join(root, "public", "og-image.png") });
console.log("wrote", join(root, "public", "og-image.png"));
await browser.close();
