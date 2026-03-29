# Durable Object Chat Architecture

## Overview

Chat state is managed by a per-user Durable Object (`ChatAgent`) using the Cloudflare Agents SDK. Each authenticated user gets a single DO instance that persists conversations, messages, and (eventually) memories.

## How it works

### Backend

- `ChatAgent` extends `Agent<Cloudflare.Env>` from the `agents` package
- SQLite tables inside the DO: `conversations` and `messages`
- `@callable()` methods exposed over WebSocket RPC:
  - `createConversation(title, model?)` → creates a new conversation
  - `listConversations()` → returns all conversations sorted by recency
  - `getConversation(id)` → returns conversation + messages
  - `deleteConversation(id)` → deletes conversation and its messages
  - `updateConversationTitle(id, title)` → renames a conversation
  - `sendMessage(conversationId, content, model?)` → streaming callable that saves user message, streams AI response, saves assistant message
- Auto-titles conversations based on the first user message

### Routing & Auth

- Hono's `/api/v1/*` session middleware validates auth cookies
- `app.all("/api/v1/agent")` gets the user's DO stub via `getAgentByName(env.CHAT_AGENT, userId, { jurisdiction: "eu" })`
- Forwards both HTTP and WebSocket upgrade requests to the DO
- The DO itself performs no auth — it trusts the Worker layer

### Locality notes

- The chat Durable Object is now requested with `jurisdiction: "eu"`, which is a real Cloudflare Durable Objects jurisdiction constraint.
- This protects where the DO state runs and persists, but it does not make Workers AI inference EU-only.

### Frontend

- `AgentClient` from `agents/client` (vanilla JS, no React dependency) connects via WebSocket
- Singleton pattern in `web/src/lib/agent-client.ts` — survives component re-renders
- `ChatModel` (Preact signals) manages:
  - `conversations` — list of all user conversations
  - `activeConversationId` — currently selected conversation
  - `messages` — messages for the active conversation
  - `connected` — WebSocket connection state
- Streaming uses `callStream()` with `onChunk`/`onDone`/`onError` callbacks

### Key Files

| File                           | Purpose                           |
| ------------------------------ | --------------------------------- |
| `api/src/agents/chat-agent.ts` | ChatAgent DO class                |
| `api/src/index.ts`             | Agent route + DO class export     |
| `api/wrangler.jsonc`           | DO binding + migration            |
| `web/src/lib/agent-client.ts`  | AgentClient singleton wrapper     |
| `web/src/models/chat.ts`       | WebSocket-based chat state model  |
| `web/src/pages/Chat/index.tsx` | Chat UI with conversation sidebar |

### Data Model

Conversations and messages live in the DO's SQLite (not D1). D1 continues to handle auth, sessions, and subscriptions.

```
conversations
  id TEXT PK
  title TEXT
  model TEXT
  created_at INTEGER
  updated_at INTEGER

messages
  id TEXT PK
  conversation_id TEXT FK → conversations.id
  role TEXT (user | assistant | system)
  content TEXT
  created_at INTEGER
```

### Future Considerations

- **Memories**: Could live in the same per-user DO (SQL table) or a separate vector-backed DO
- **Search**: Full-text search over messages via SQLite FTS5 inside the DO
- **Collaboration**: Multiple WebSocket clients can connect to the same DO instance
- **Stream cancellation**: Currently client-side only — server finishes the stream
