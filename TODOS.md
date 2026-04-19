# TODOs

## Design

- [x] **FINDING-007 (polish):** Add visual markers (checkmarks or bullets) to pricing feature lists for better scannability. Fixed by /design-review on main, 2026-03-29.

## Engineering

## Implement free tier daily message limits

**Priority:** P1 (needed before launch)
**What:** Add usage counting and enforcement for free-tier users. When daily limit is reached: current conversation completes, upgrade banner appears, input is disabled until daily reset or upgrade.
**Why:** Without enforcement, the free tier is identical to pro. No reason to upgrade. Revenue-critical for sustainability.
**Context:** Billing scaffolding exists (Polar integration, subscription table in D1, `/api/billing-success` endpoint). Need to: (1) choose where to store the daily counter (D1 or DO), (2) decide the daily limit number, (3) implement the check in `sendMessage`, (4) build the upgrade banner UI per vision_mvp.md spec (soft limit, respectful tone, never cut mid-response).
**Effort:** S (human: ~4 hours / CC: ~15 min)
**Depends on:** Deciding the daily message limit number and pricing.

## Fix sendMessage error handling

**Priority:** P2 (fix before real users)
**What:** Improve error handling in `ChatAgent#sendMessage`: wrap SQL writes in try/catch, guard against empty AI responses, surface meaningful error types to the user.
**Why:** Currently, SQL writes for saving the user message (line 127 of chat-agent.ts) are outside the try/catch block — a DB error would be unhandled. Empty AI responses get saved as empty messages in the DB. All errors surface as generic "Stream failed" regardless of cause.
**Context:** The fix is straightforward: (1) move user message SQL insert + conversation update inside the try block, (2) after streaming completes, check if `fullContent` is empty and handle it (don't save, send error), (3) distinguish error types in `stream.error()` — "AI service unavailable" vs "something went wrong".
**Effort:** S (human: ~2 hours / CC: ~10 min)
**Depends on:** Nothing.

## DO → D1 sync error handling

**Priority:** High (after DO architecture is built)
**What:** Add retry logic for when the Durable Object fails to write conversation metadata to the D1 index.
**Why:** Without this, conversations can exist in a DO but be invisible in the conversation list — a data consistency bug that confuses users.
**Context:** The DO holds the source of truth (messages in SQLite). D1 is a read-optimized index for listing/searching conversations. If the D1 write fails, the data isn't lost — just not discoverable. Options: immediate retry with exponential backoff, or a periodic reconciliation job that scans DOs and ensures D1 is in sync.
**Depends on:** DO + D1 dual storage architecture.
