// @ts-nocheck

const TOKENS = {
  white: "oklch(100% 0 0)",
  "neutral-300": "oklch(87% 0 0)",
  "neutral-400": "oklch(70.8% 0 0)",
  "neutral-500": "oklch(55.6% 0 0)",
  "neutral-600": "oklch(43.9% 0 0)",
  "neutral-800": "oklch(26.9% 0 0)",
  "neutral-900": "oklch(20.5% 0 0)",
  "neutral-950": "oklch(14.5% 0 0)",
  "violet-600": "oklch(54.1% 0.281 293.009)",
  "red-400": "oklch(70.4% 0.191 22.216)",
  "red-950": "oklch(25.8% 0.092 26.042)",
  "green-400": "oklch(79.2% 0.209 151.711)",
  "green-900": "oklch(39.3% 0.095 152.535)",
};

const APPROVED_PAIRINGS = [
  { label: "Body text on base", fg: "neutral-300", bg: "neutral-950", min: 4.5 },
  { label: "Muted text on base", fg: "neutral-400", bg: "neutral-950", min: 4.5 },
  { label: "Muted text on surface", fg: "neutral-400", bg: "neutral-900", min: 4.5 },
  { label: "Muted text on surface alt", fg: "neutral-400", bg: "neutral-800", min: 4.5 },
  { label: "Primary button text", fg: "white", bg: "violet-600", min: 4.5 },
  { label: "Error alert text", fg: "red-400", bg: "red-950", min: 4.5 },
  { label: "Success alert text", fg: "green-400", bg: "green-900", min: 4.5 },
];

const CURRENT_UI_PAIRINGS = [
  {
    label: "Empty state helper copy",
    fg: "neutral-400",
    bg: "neutral-950",
    min: 4.5,
    source: "web/src/components/EmptyState.tsx",
  },
  {
    label: "Sidebar empty state",
    fg: "neutral-400",
    bg: "neutral-900",
    min: 4.5,
    source: "web/src/components/Sidebar.tsx",
  },
  {
    label: "Top-bar text links",
    fg: "neutral-400",
    bg: "neutral-950",
    min: 4.5,
    source: "web/src/components/ui/TextLink.tsx",
  },
  {
    label: "Page loader label",
    fg: "neutral-400",
    bg: "neutral-950",
    min: 4.5,
    source: "web/src/components/ui/Layout.tsx",
  },
  {
    label: "Input placeholders",
    fg: "neutral-400",
    bg: "neutral-800",
    min: 4.5,
    source: "web/src/components/ui/Input.tsx + web/src/components/ChatInput.tsx",
  },
  {
    label: "Input disclaimer copy",
    fg: "neutral-400",
    bg: "neutral-950",
    min: 4.5,
    source: "web/src/components/ChatInput.tsx",
  },
  {
    label: "Sidebar delete affordance",
    fg: "neutral-400",
    bg: "neutral-900",
    min: 3,
    source: "web/src/components/Sidebar.tsx",
  },
];

const DISALLOWED_PAIRINGS = [
  { label: "Accent text on dark surface", fg: "violet-600", bg: "neutral-800", max: 4.49 },
  { label: "Legacy muted text on base", fg: "neutral-500", bg: "neutral-950", max: 4.49 },
  { label: "Legacy muted text on surface", fg: "neutral-500", bg: "neutral-900", max: 4.49 },
  { label: "Low-contrast helper text on base", fg: "neutral-600", bg: "neutral-950", max: 4.49 },
  { label: "Low-contrast helper text on surface", fg: "neutral-600", bg: "neutral-900", max: 4.49 },
];

function parseOklch(value) {
  const match = value.match(/oklch\(([^%]+)%\s+([^\s]+)\s+([^)]+)\)/);

  if (!match) {
    throw new Error(`Unsupported color format: ${value}`);
  }

  return {
    l: Number(match[1]) / 100,
    c: Number(match[2]),
    h: (Number(match[3]) * Math.PI) / 180,
  };
}

function toGammaEncoded(channel) {
  const clamped = Math.max(0, Math.min(1, channel));
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function toLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(token) {
  const { l, c, h } = parseOklch(TOKENS[token]);
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

  const lCube = lPrime ** 3;
  const mCube = mPrime ** 3;
  const sCube = sPrime ** 3;

  const r = toGammaEncoded(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube);
  const g = toGammaEncoded(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube);
  const bChannel = toGammaEncoded(
    -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube,
  );

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(bChannel);
}

function contrastRatio(fg, bg) {
  const fgLuminance = relativeLuminance(fg);
  const bgLuminance = relativeLuminance(bg);
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function formatResult(pairing, ratio, status) {
  const threshold = pairing.min ? `>= ${pairing.min}:1` : `< ${pairing.max + 0.01}:1`;
  const source = pairing.source ? ` (${pairing.source})` : "";
  return `${status} ${pairing.label}: ${pairing.fg} on ${pairing.bg} = ${ratio.toFixed(2)}:1 ${threshold}${source}`;
}

let hasFailure = false;

console.log("Approved pairings\n");
for (const pairing of APPROVED_PAIRINGS) {
  const ratio = contrastRatio(pairing.fg, pairing.bg);
  const passed = ratio >= pairing.min;
  console.log(formatResult(pairing, ratio, passed ? "PASS" : "FAIL"));
  if (!passed) hasFailure = true;
}

console.log("\nCurrent UI pairings\n");
for (const pairing of CURRENT_UI_PAIRINGS) {
  const ratio = contrastRatio(pairing.fg, pairing.bg);
  const passed = ratio >= pairing.min;
  console.log(formatResult(pairing, ratio, passed ? "PASS" : "FAIL"));
  if (!passed) hasFailure = true;
}

console.log("\nPairings to avoid\n");
for (const pairing of DISALLOWED_PAIRINGS) {
  const ratio = contrastRatio(pairing.fg, pairing.bg);
  const staysBelowAa = ratio <= pairing.max;
  console.log(formatResult(pairing, ratio, staysBelowAa ? "WARN" : "CHECK"));
}

if (hasFailure) {
  console.error("\nContrast audit failed.");
  process.exit(1);
}

console.log("\nContrast audit passed.");
