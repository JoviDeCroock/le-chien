# Memory System

User memory is stored per-user in the ChatAgent Durable Object alongside conversations and messages.

## Architecture

Memories live in a `memories` SQLite table inside each user's DO:

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
)
```

This means memories are co-located with the user's conversations — no extra D1 queries needed during chat.

## API (callable methods on ChatAgent)

| Method         | Args          | Returns    | Description                |
| -------------- | ------------- | ---------- | -------------------------- |
| `listMemories` | none          | `Memory[]` | All memories, newest first |
| `deleteMemory` | `id: string`  | `void`     | Delete a memory            |

`createMemory` and `updateMemory` exist as internal methods (used by auto-extraction) but are not exposed as callable RPCs.

## How memories reach the AI

In `sendMessage`, all memories are loaded and appended to the system prompt as a bullet list:

```
Stuff you know about this person — use it when it's relevant, ignore it when it's not:
- Preferred language: TypeScript
- Role: Frontend engineer at Acme
```

## Automatic memory extraction

Memories are created automatically — users don't manually add or edit them.

After each message, a memory extraction is **scheduled for 1 hour later** using the Agents `schedule()` API. If more messages arrive in the same conversation before the hour is up, the timer resets (debounce). This means each conversation is processed once per quiet period, not per-message.

When the scheduled extraction fires:
1. Loads the **full conversation history** (all user messages) — gives richer context than a single exchange
2. Loads existing memories and passes them to the extraction model to avoid duplicates
3. Uses `glm-4.7-flash` (cheap/fast) to extract new or updated facts
4. For each extracted fact:
   - If it matches an existing memory key → **updates** the existing memory
   - If it's a new fact → creates it (after checking no exact duplicate exists)
5. Fails silently — auto-extraction is best-effort

## Frontend

### MemoryModel (`web/src/models/memory.ts`)

Signals-based state management for:
- Memory list (read + delete via agent RPC)
- Panel open/close state

### Components

- **MemoryPanel** (`web/src/components/MemoryPanel.tsx`): Right-side panel with memory list and delete-on-hover. Read-only — users can view and delete memories but not create or edit them.

### Keyboard shortcut

`Cmd/Ctrl + Shift + M` toggles the memory panel. Also accessible via "Memory" link in the top bar.

## Design decisions

- **Fully automatic**: Memories are extracted automatically from conversations — no manual creation or editing. Users can only delete memories they don't want.
- **Key-value model**: Simple and scannable. Key is the label ("Preferred language"), value is the content ("TypeScript").
- **Per-user DO storage**: Memories are scoped to the user's DO, not in D1. This keeps reads fast during chat (no network hop to D1).
- **Debounced extraction**: Scheduled 1 hour after last message per conversation, so we process each conversation once per quiet period instead of per-message.

## Future work

- Workspace-scoped memories (shared across team members)
- Memory search/filter in the panel
- Memory count badge on the top bar link
