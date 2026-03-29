/**
 * Generates PNG favicons from the SVG source.
 * Run: node scripts/generate-favicons.mjs
 * Requires: npm install sharp (dev dependency, not committed)
 *
 * If sharp is not available, the SVG favicon works in all modern browsers.
 * PNG fallbacks are optional for legacy browser support.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, "../public/favicon.svg");
const svg = readFileSync(svgPath);

async function main() {
  const sharp = (await import("sharp")).default;

  await Promise.all([
    sharp(svg).resize(32, 32).png().toFile(resolve(__dirname, "../public/favicon-32.png")),
    sharp(svg).resize(180, 180).png().toFile(resolve(__dirname, "../public/apple-touch-icon.png")),
  ]);

  console.log("Generated favicon-32.png and apple-touch-icon.png");
}

main().catch((e) => {
  console.warn("Could not generate PNG favicons:", e.message);
  console.warn("Install sharp as a dev dependency: pnpm add -D sharp");
  process.exit(0); // Non-fatal
});
