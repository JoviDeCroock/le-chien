# Files + RAG (Cloudflare AI Search)

The knowledge-base feature — uploaded files that the assistant can cite from
any chat — is built on Cloudflare AI Search (the managed RAG product,
formerly AutoRAG). This doc is the ground truth for how the pieces fit
together and the sharp edges worth remembering.

## Instance-per-tenant inside a namespace

We use the **`ai_search_namespaces` binding** (`AI_SEARCH` in the worker)
pointed at the `default` namespace. Every user gets their own AI Search
instance inside that namespace, created lazily on their first upload.

```ts
// wrangler.jsonc
"ai_search_namespaces": [
  { "binding": "AI_SEARCH", "namespace": "bark" }
]

// server/lib/ai-search.ts
env.AI_SEARCH.create({ id: tenantIdFor(userId) }); // first upload
env.AI_SEARCH.get(tenantIdFor(userId)).items.upload(filename, bytes);
env.AI_SEARCH.get(tenantIdFor(userId)).search({ messages });
env.AI_SEARCH.delete(tenantIdFor(userId));         // account deletion
```

Each instance uses **built-in managed storage** — no R2 bucket required.
Files flow `browser → worker → items.upload(...)` and never touch R2.

### Why instance-per-tenant

Isolation is **structural**: a search call routed to the wrong instance
would miss instead of leaking, because each tenant's vectors live in a
distinct index. There is no filter logic to get wrong. The earlier
drafts of this feature considered a single shared instance with a
`folder` range filter — that works, but a filter-syntax bug there would
silently return another user's chunks. With per-tenant instances, the
failure mode is "no results" instead of "wrong user's data".

### Tenant ID shape

Instance IDs must match `^[a-z0-9_]+(?:-[a-z0-9_]+)*$` and fit in 32
chars. better-auth user IDs are URL-safe and short; we lowercase,
replace anything outside the charset with `-`, prefix with `u-`, and
truncate. See `tenantIdFor` in `server/lib/ai-search.ts`.

### Lazy provisioning

`ensureTenant` is called on upload. We detect first-time use by counting
the user's rows in the `file` D1 table — zero rows means we haven't
created the instance. The create call is wrapped in try/catch so a
re-create after a partial failure is harmless. We never delete the
instance on file delete; it stays for future uploads. `deleteTenant` is
exposed for the eventual account-deletion flow.

## Required tooling

Namespace bindings require fresh-ish tooling:

- `wrangler` ≥ 4.68 (`4.83.0+` in this repo)
- `@cloudflare/workers-types` ≥ `4.20260415.1`

If `pnpm wrangler types` doesn't emit `AI_SEARCH: AiSearchNamespace` in
`worker-configuration.d.ts`, the types package is behind. Upgrade and
regenerate.

## Data flow

```
browser                           worker                      Cloudflare
───────                           ──────                      ──────────
POST /api/v1/files          →  files route:
(multipart)                    - pro-gate via plans.ts
                               - size/mime/count checks
                               - ensureTenant()         →    AI_SEARCH.create({ id: u-{uid} })
                               - uploadToTenant(...)    →    AI_SEARCH.get(u-{uid})
                                                               .items.upload(name, bytes)
                               - persist {fileId, itemId} in D1

chat message                →  ChatAgent.sendMessage:
(via DO WebSocket)             - if plan === "pro":
                                 retrieveForUser() → AI_SEARCH.get(u-{uid})
                                                       .search({ messages, retrieval.hybrid })
                               - append excerpts + [n] refs to system prompt
                               - stream.send({__event:"sources"}) so client
                                 attaches citation cards to assistant bubble
                               - streamText(...) → LLM answers with inline [n]
                               - persist sources as JSON on the message row
                                 so reload still renders citation cards
```

## Uploaded item naming

Inside an instance, item names must be unique. We upload each file as
`{fileId}-{filename}` so two uploads with the same display name never
collide. When rendering citations, we strip the leading `{fileId}-`
prefix (see `displayFilenameFromKey`).

## Plan gating

`plans.ts` is the single source of truth. Free has `maxFiles: 0`,
`maxFileBytes: 0` — the upload route returns 402 and the `FilesPanel`
shows an upgrade CTA. Pro has `maxFiles: 20` and `maxFileBytes: 25 MB`.
Retrieval in `ChatAgent#sendMessage` is also Pro-gated — skipping it for
free users avoids wasted AI Search calls for tenants that by definition
have no files.

## Persisted citations

Assistant messages store sources as JSON on the `messages.sources`
column, added via an `ALTER TABLE` inside the ChatAgent DO's `onStart`.
The frontend `getConversation` parser treats it the same way it treats
`tool_calls`. `ChatBubble` renders `CitationList` whenever
`message.sources?.length > 0`, so reloading a past chat still shows the
numbered source cards under the answer.

## Status values

AI Search item statuses are `'completed' | 'error' | 'skipped' |
'queued' | 'processing' | 'outdated'`. The DB column normalises to
`'indexing' | 'ready' | 'error'`:

- `completed` → `ready`
- `error` → `error`
- everything else → `indexing`

## Known gaps (follow-up work)

- **Status polling**: after upload the row is `indexing` and never
  flips. Either poll `instance.items.get(itemId).info()` from the
  worker, or add a client-side poller to refresh `/api/v1/files`
  periodically.
- **Account deletion hook**: `deleteTenant` exists but isn't wired
  into any broader account-delete flow yet.
- **EU pinning**: AI Search instances inherit namespace settings;
  verify in the dashboard.
- **Cross-type search**: the Cmd+K overlay over convos + memory + files
  is Phase 2 work.

## Testing

1. Pro user A uploads a PDF. Confirm in the dashboard that an instance
   named `u-{A_id}` appears under the `default` namespace, with one item.
2. Ask a question only answerable from the PDF. Expect an inline `[1]`
   and a source card under the bubble.
3. Pro user B asks the same question in a fresh chat. Expect no
   citations and a response that doesn't reference A's content. B has
   their own instance `u-{B_id}` (created only after they upload) — A
   and B's indexes are entirely separate.
4. Free user: upload UI is locked with an upgrade CTA; `POST /api/v1/files`
   returns 402.
