# URL ↔ Model state sync

When a page has two effects that bidirectionally sync a route param with a model signal, the "model → URL" direction must be gated on a "ready" marker (e.g. `chat.connected.value`). Otherwise, on reload the effect fires on initial mount while the model is still in its uninitialised state (`activeConversationId = null`) and strips the id from the URL before the "URL → model" direction has a chance to hydrate from the param.

Concretely in `web/src/pages/Chat/index.tsx`:

- `URL → model` waits for `auth.authenticated && chat.connected`, then calls `chat.selectConversation(id)` which sets `activeConversationId` synchronously before awaiting.
- `Model → URL` must also gate on `chat.connected`, otherwise on a hard reload of `/chat/:id` it runs first with `active=null, conversationId=<id>` and redirects to `/chat`, losing the id.

Rule: any sync effect that can *remove* data from the URL needs to know the model is actually initialised, not just empty.
