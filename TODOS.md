# TODOs

## Design

### Create DESIGN.md via /design-consultation
**Priority:** Medium (before building new components)
**What:** Run `/design-consultation` to produce a full DESIGN.md with typography, motion, spacing rationale, and component patterns.
**Why:** The plan has minimal design tokens documented from the existing codebase, but a full design system prevents drift as new features are built and the team scales.
**Pros:** Single source of truth for all design decisions. New contributors can ship consistent UI without guessing.
**Cons:** ~30 min of CC time. Not blocking any current implementation.
**Context:** The vision_mvp.md plan now documents existing color tokens, spacing, and component inventory. DESIGN.md would formalize typography choices, motion principles, and component API patterns.
**Depends on:** Nothing. Can be done anytime before building new components.

### WCAG contrast audit on existing color tokens
**Priority:** Medium (pre-launch)
**What:** Verify contrast ratios for all text/background combinations in the existing palette (neutral-300 on neutral-950, neutral-400 on neutral-900, violet-600 on neutral-800, etc.).
**Why:** The plan now specifies WCAG 2.1 AA compliance. Shipping without verifying means accessibility requirements exist on paper but not in practice.
**Pros:** Catches issues before they're baked into every component. Cheap to fix now, expensive to fix later.
**Cons:** May require adjusting some color tokens, which would cascade through existing components.
**Context:** Tailwind's neutral palette generally passes AA, but combinations like neutral-400 text on neutral-800 backgrounds may fall short.
**Depends on:** Nothing. Can be done independently.

### Define full keyboard shortcut map
**Priority:** Low (during sidebar/navigation build)
**What:** Design a complete keyboard shortcut system beyond basic navigation. Include: Cmd+N (new chat), Cmd+Shift+M (toggle memory), Cmd+/ (model switcher), Cmd+Shift+S (toggle sidebar), etc.
**Why:** Target users are developers who expect keyboard-first workflows. Most AI chat products are mouse-only — this is a differentiator.
**Pros:** Makes the product feel native and fast for power users. Aligns with "fast by default" principle.
**Cons:** Requires coordination with OS/browser shortcuts. Needs to be documented and discoverable (? key for shortcut overlay).
**Context:** The plan specifies basic keyboard nav. This extends it to a full power-user shortcut system.
**Depends on:** Sidebar and navigation components being designed.

## Engineering

## DO → D1 sync error handling
**Priority:** High (after DO architecture is built)
**What:** Add retry logic for when the Durable Object fails to write conversation metadata to the D1 index.
**Why:** Without this, conversations can exist in a DO but be invisible in the conversation list — a data consistency bug that confuses users.
**Context:** The DO holds the source of truth (messages in SQLite). D1 is a read-optimized index for listing/searching conversations. If the D1 write fails, the data isn't lost — just not discoverable. Options: immediate retry with exponential backoff, or a periodic reconciliation job that scans DOs and ensures D1 is in sync.
**Depends on:** DO + D1 dual storage architecture.

## Third-party data flow audit for EU sovereignty claim
**Priority:** Medium (post-MVP)
**What:** Audit all third-party services (Polar billing, email delivery, Cloudflare analytics/logging) to verify whether user data leaves EU infrastructure.
**Why:** The product pitches "your data stays in Europe" but Polar is US-based, BetterAuth email delivery may use a US provider, and Cloudflare's internal analytics may process data outside EU. The sovereignty claim has legal gaps beyond the DO/Worker pinning.
**Context:** For MVP, DO + Worker EU pinning covers the core data (conversations, messages). This audit tightens the claim from "mostly EU" to "fully EU." May require switching to EU-based email delivery and reviewing Polar's data processing agreements.
**Depends on:** Nothing — can be done in parallel with development.

## Cache createAuth() per Worker isolate
**Priority:** Low (optimization)
**What:** Cache the BetterAuth instance at module level instead of creating a new one on every request (`api/src/index.ts:119` and `api/src/index.ts:129`).
**Why:** Each authenticated request creates BetterAuth + Drizzle + Polar client twice. A module-level WeakMap keyed by env would reuse instances within the same Worker isolate.
**Context:** Trivial at MVP scale — Workers AI inference latency dominates response time. Only matters at hundreds of concurrent users. ~5 min fix with CC.
**Depends on:** Nothing.
