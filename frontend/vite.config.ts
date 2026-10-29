import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// The SPA calls the API on the same origin (ADR-008): Vite proxies it in development,
// FastAPI serves both in production.
const api = process.env.API_URL ?? "http://localhost:8000";

// Screens whose code index.html's boot script fetches with the entry (P3 criterion 3), by path
// (a trailing "/" matches any child, e.g. /app/stocks/MTNN). Mirrors src/app/router.tsx; a
// missing screen only loses the head start.
const ROUTE_CHUNKS = {
  "/": "src/features/landing/LandingPage.tsx",
  "/login": "src/features/auth/LoginPage.tsx",
  "/app": "src/features/market/MarketPage.tsx",
  "/app/market": "src/features/market/MarketPage.tsx",
  "/app/stocks/": "src/features/stock/StockPage.tsx",
  "/app/news": "src/features/news/NewsPage.tsx",
  "/app/account": "src/features/account/AccountPage.tsx",
};

/** Writes each screen's chunk files (minus what the entry already loads) into index.html. */
function routeChunks(routes: Record<string, string>): Plugin {
  return {
    name: "route-chunks",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const chunks = Object.values(ctx.bundle ?? {}).flatMap((c) => (c.type === "chunk" ? [c] : []));
        const graph = (file: string, into = new Set<string>()) => {
          if (!into.has(file)) {
            into.add(file);
            chunks.find((c) => c.fileName === file)?.imports.forEach((f) => graph(f, into));
          }
          return into;
        };
        const entry = new Set(chunks.filter((c) => c.isEntry).flatMap((c) => [...graph(c.fileName)]));
        const map = Object.fromEntries(
          Object.entries(routes).map(([path, module]) => {
            const chunk = chunks.find((c) => c.facadeModuleId?.replaceAll("\\", "/").endsWith(module));
            if (!chunk) throw new Error(`route-chunks: no chunk for ${module}`);
            return [path, [...graph(chunk.fileName)].filter((f) => !entry.has(f)).map((f) => `/${f}`)];
          }),
        );
        return html.replace("/* ROUTE_CHUNKS */ {}", JSON.stringify(map));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), routeChunks(ROUTE_CHUNKS)],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    proxy: { "/api": api, "/email-assets": api },
  },
  build: { sourcemap: true, target: "es2022" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"], // e2e/ is Playwright's (npx playwright test -c e2e)
    css: false,
  },
});
