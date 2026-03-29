# TODOs

## Design

## Engineering

## DO → D1 sync error handling

**Priority:** High (after DO architecture is built)
**What:** Add retry logic for when the Durable Object fails to write conversation metadata to the D1 index.
**Why:** Without this, conversations can exist in a DO but be invisible in the conversation list — a data consistency bug that confuses users.
**Context:** The DO holds the source of truth (messages in SQLite). D1 is a read-optimized index for listing/searching conversations. If the D1 write fails, the data isn't lost — just not discoverable. Options: immediate retry with exponential backoff, or a periodic reconciliation job that scans DOs and ensures D1 is in sync.
**Depends on:** DO + D1 dual storage architecture.
