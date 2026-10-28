// Copies the design tokens and logo files into the app. Edit them only in /design and /brand
// (docs/06 §10); the copies are git-ignored and refreshed before every dev and build run.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const copies = [
  ["../design/tokens.css", "src/styles/tokens.css"],
  ["../brand/equitylens-logo-horizontal-light.svg", "public/brand/logo-horizontal-light.svg"],
  ["../brand/equitylens-logo-horizontal-dark.svg", "public/brand/logo-horizontal-dark.svg"],
  ["../brand/equitylens-mark-light.svg", "public/brand/mark-light.svg"],
  ["../brand/equitylens-mark-dark.svg", "public/brand/mark-dark.svg"],
  ["../brand/favicon.svg", "public/favicon.svg"],
];
for (const [from, to] of copies) {
  mkdirSync(dirname(resolve(root, to)), { recursive: true });
  copyFileSync(resolve(root, from), resolve(root, to));
}
console.log(`synced ${copies.length} design files`);
