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

| Method         | Args                         | Returns    | Description                |
| -------------- | ---------------------------- | ---------- | -------------------------- |
| `listMemories` | none                         | `Memory[]` | All memories, newest first |
| `createMemory` | `key: string, value: string` | `Memory`   | Create a new memory entry  |
| `updateMemory` | `id, key, value`             | `Memory`   | Update an existing memory  |
| `deleteMemory` | `id: string`                 | `void`     | Delete a memory            |

## How memories reach the AI

In `sendMessage`, all memories are loaded and appended to the system prompt as a bullet list:

```
You have the following memories about this user. Use them to personalize your responses when relevant:
- Preferred language: TypeScript
- Role: Frontend engineer at Acme
```

## AI-initiated memory saving (tool)

Memory creation is **exclusively AI-driven** — users cannot manually create or edit memories. The AI has a `save_memory` tool registered in `createTools` and is instructed via the system prompt to proactively save noteworthy information (name, role, preferences, tech stack, goals, etc.).

The tool:
1. Appears in chat as a standard ToolCallCard (name: `save_memory`, args: key + value)
2. **Deduplicates** before saving: checks existing memories by key (case-insensitive). If a match exists with the same value, it skips. If the value differs, it updates the existing memory instead of creating a new one.
3. Executes via callbacks to `ChatAgent.createMemory` or `ChatAgent.updateMemory`
4. Returns `{ saved: true, key, value }` (or `{ saved: false, reason: "duplicate" }`) so the user sees confirmation inline
5. The frontend refreshes the memory list when streaming ends

Users can only **view** and **delete** memories from the panel. The `createMemory` and `updateMemory` methods are no longer exposed as callable RPCs — they're only invoked server-side by the tool.

## Frontend

### MemoryModel (`web/src/models/memory.ts`)

Signals-based state management for:
- Memory list (load + delete via agent RPC)
- Panel open/close state

### Components

- **MemoryPanel** (`web/src/components/MemoryPanel.tsx`): Right-side panel with memory list, delete buttons, empty state with brain icon. No add/edit forms — memories are created automatically by the AI.

### Keyboard shortcut

`Cmd/Ctrl + Shift + M` toggles the memory panel. Also accessible via "Memory" link in the top bar.

## Design decisions

- **AI-only creation**: Users don't create memories — the AI captures noteworthy info automatically. Users can delete memories they don't want.
- **Deduplication**: The `save_memory` tool checks existing memories by key before saving. Exact duplicates are skipped; changed values update the existing memory in-place.
- **Tool-based saving**: The AI saves memories via the `save_memory` tool, which uses the existing tool call UI for transparency. No custom suggestion UI needed.
- **Key-value model**: Simple and scannable. Key is the label ("Preferred language"), value is the content ("TypeScript").
- **Per-user DO storage**: Memories are scoped to the user's DO, not in D1. This keeps reads fast during chat (no network hop to D1).
- **Auto-refresh**: The memory panel refreshes after each conversation exchange to pick up any tool-saved memories.

## Future work

- Workspace-scoped memories (shared across team members)
- Memory search/filter in the panel
- Memory count badge on the top bar link
