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

The AI has a `save_memory` tool registered in `createTools`. When the user shares a preference, fact, or important context, the model can call the tool directly — no separate suggestion flow needed.

The tool:
1. Appears in chat as a standard ToolCallCard (name: `save_memory`, args: key + value)
2. Executes immediately via a callback to `ChatAgent.createMemory`
3. Returns `{ saved: true, key, value }` so the user sees confirmation inline
4. The frontend refreshes the memory list when streaming ends

This is better than the XML-tag approach because:
- It uses the existing tool infrastructure (no custom parsing)
- The user sees exactly what was saved via the ToolCallCard UI
- The AI decides autonomously when to save (like any other tool)
- Memories can be deleted from the panel if unwanted

## Frontend

### MemoryModel (`web/src/models/memory.ts`)

Signals-based state management for:
- Memory list (CRUD operations via agent RPC)
- Panel open/close state
- Add/edit form state

### Components

- **MemoryPanel** (`web/src/components/MemoryPanel.tsx`): Right-side panel with memory list, add form, edit-in-place, empty state with brain icon. Matches sidebar visual patterns.

### Keyboard shortcut

`Cmd/Ctrl + Shift + M` toggles the memory panel. Also accessible via "Memory" link in the top bar.

## Design decisions

- **Tool-based saving**: The AI saves memories via the `save_memory` tool, which uses the existing tool call UI for transparency. No custom suggestion UI needed.
- **Key-value model**: Simple and scannable. Key is the label ("Preferred language"), value is the content ("TypeScript").
- **Per-user DO storage**: Memories are scoped to the user's DO, not in D1. This keeps reads fast during chat (no network hop to D1).
- **Auto-refresh**: The memory panel refreshes after each conversation exchange to pick up any tool-saved memories.

## Automatic memory extraction

After each exchange, a background LLM call (`glm-4.7-flash`) analyzes the user's message and the assistant's response for memorable facts. This runs via `ctx.waitUntil` so it never blocks or slows down the chat stream.

The extraction:
1. Loads existing memories to avoid duplicates
2. Sends both messages to a cheap model with a focused extraction prompt
3. Parses the JSON response and saves any new memories
4. Fails silently — auto-extraction is best-effort

This complements the `save_memory` tool: the tool handles explicit "remember this" requests, while auto-extraction catches facts the model didn't proactively save (common with smaller models).

## Future work

- Workspace-scoped memories (shared across team members)
- Memory search/filter in the panel
- Memory count badge on the top bar link
- Deduplication (don't save what's already remembered)
