# Design System — le chien

## Product Context
- **What this is:** A Cloudflare-native AI workspace that gives users a ChatGPT/Claude-like experience on top of open models, with persistent memory, file retrieval, workspaces, and tool use.
- **Who it's for:** Developers, founders, small teams, AI-native operators, research-heavy users.
- **Space/industry:** AI chat / AI workspace. Peers: ChatGPT, Claude, Perplexity, TypingMind, Poe.
- **Project type:** Web app (dark-only for MVP).

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — function-first, information-dense when needed, quiet when idle. The product earns trust through clarity, not decoration.
- **Decoration level:** Minimal — typography and spacing do the work. No gradients, no patterns, no texture. The violet accent is the only visual "event" in the UI.
- **Mood:** Fast, serious, developer-grade. Like a tool that respects your time. The product feels instant and professional — not playful, not corporate.
- **Reference sites:** ChatGPT (system fonts, clean white), Claude (serif body, warm rust-orange), Perplexity (FK Grotesk, teal, Scandinavian-subway feel). le chien is starker than all of them.

## Typography
- **Display/Hero:** Geist Sans (Bold 700) — Sharp, modern geometric. Built for developer tools, excellent in dark UIs. Not overused like Inter but not obscure. Letter-spacing: -0.03em at display sizes.
- **Body:** Geist Sans (Regular 400 / Medium 500) — Clean at small sizes, great x-height, excellent readability on dark backgrounds.
- **UI/Labels:** Geist Sans (Medium 500) — Same family for cohesion. Medium weight distinguishes labels from body text.
- **Data/Tables:** Geist Sans with `font-variant-numeric: tabular-nums` — Same family, tabular figures align columns perfectly.
- **Code:** Geist Mono (Regular 400) — Paired companion to Geist Sans. Clean, modern monospace. Feels native to the system.
- **Loading:** Google Fonts CDN: `https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap`
- **Scale (1.25 modular ratio):**
  - 12px (0.75rem) — captions, timestamps, metadata. Weight: 500. Letter-spacing: 0.02em.
  - 14px (0.875rem) — secondary text, descriptions, UI labels. Weight: 400.
  - 16px (1rem) — body text, message content. Weight: 400. Line-height: 1.7.
  - 20px (1.25rem) — section headings, card titles. Weight: 600.
  - 24px (1.5rem) — page headings. Weight: 700. Letter-spacing: -0.01em.
  - 32px (2rem) — hero/display. Weight: 700. Letter-spacing: -0.02em.
  - 48px (3rem) — large display (rare). Weight: 700. Letter-spacing: -0.03em.

## Color
- **Approach:** Restrained — violet accent as sole chromatic presence. Color is rare and meaningful.
- **Primary (accent):** `#7c3aed` (violet-600) — Primary actions, selected states, focus rings, brand moments.
- **Primary hover:** `#8b5cf6` (violet-500) — Hover on primary actions.
- **Accent glow:** `rgba(124, 58, 237, 0.15)` — Selected model mode glow, focus rings. Stronger: `rgba(124, 58, 237, 0.3)`.
- **Neutrals (cool grays):**
  - Base: `#0a0a0a` (neutral-950) — Page background.
  - Surface: `#171717` (neutral-900) — Cards, sidebar, elevated surfaces.
  - Surface alt: `#262626` (neutral-800) — Input backgrounds, hover states.
  - Border: `#404040` (neutral-700) — Borders, dividers.
  - Text muted: `#a3a3a3` (neutral-400) — Secondary text, placeholders.
  - Text body: `#d4d4d4` (neutral-300) — Body text.
  - Text heading: `#ffffff` — Headings, primary labels.
- **Semantic:**
  - Success: `#4ade80` (green-400) / bg: `#14532d` (green-900)
  - Warning: `#fbbf24` (amber-400) / bg: `#451a03` (amber-950)
  - Error: `#f87171` (red-400) / bg: `#450a0a` (red-950)
  - Info: `#60a5fa` (blue-400) / bg: `#1e3a5f`
- **Dark mode:** Dark-only for MVP. No light mode planned.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined — sidebar + main content with strict alignment.
- **Grid:** Sidebar (256px expanded, 48px collapsed icon rail) + fluid main content.
- **Breakpoints:** Mobile (<768px), Tablet (768-1024px), Desktop (>1024px).
- **Max content width:** `max-w-3xl` (768px) for chat messages, `max-w-md` (448px) for forms.
- **Border radius:** Hierarchical — sm: 4px, md: 8px (cards, inputs, buttons), lg: 12px (larger containers), full: 9999px (pills, avatars).

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension. The product feels instant.
- **Easing:** enter: ease-out, exit: ease-in, move: ease-in-out.
- **Duration:** micro: 50-100ms (hover, focus), short: 150-250ms (fade, expand/collapse), medium: 250-400ms (sidebar toggle, overlays).
- **What gets motion:** Hover/focus state changes. Fade-in for new chat messages. Expand/collapse for tool call cards. Sidebar collapse/expand.
- **What does NOT get motion:** Page transitions, entrance animations, scroll-driven effects, loading skeletons (use opacity pulse only).

## Anti-Patterns (never use)
- Purple/violet gradients as backgrounds
- 3-column feature grid with icons in colored circles
- Centered everything with uniform spacing
- Uniform bubbly border-radius on all elements
- Gradient buttons as the primary CTA pattern
- Generic hero sections with stock imagery
- "Built for X" / "Designed for Y" marketing copy patterns
- Shadows for elevation (use border + background color shift instead)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-29 | Initial design system created | Created by /design-consultation based on vision doc + competitive research of ChatGPT, Claude, Perplexity, TypingMind, Poe |
| 2026-03-29 | Geist Sans + Geist Mono as sole type family | Developer-tool feel without code-editor coldness. Paired mono for free. Distinctive vs system-font competitors |
| 2026-03-29 | Zero decoration, violet glow as only flourish | Starker than all competitors. Fast/serious identity. Glow makes the accent feel significant |
| 2026-03-29 | Dark-only for MVP | Reduces surface area, matches developer audience. Every serious AI tool defaults to dark |
