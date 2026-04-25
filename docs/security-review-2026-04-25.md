# Security Review - 2026-04-25

## Executive Summary

This review covered the Cloudflare Worker/Hono backend, Better Auth integration, Durable Object chat RPCs, LLM tools, live artifact runtime, frontend rendering paths, deployment config, and production dependency posture.

The highest-risk issues are in code execution boundaries. The live artifact runtime evaluates LLM-generated code and trusts messages from that worker enough to replay arbitrary DOM operations in the main document. The server-side `run_javascript` tool also evaluates model/user-controlled JavaScript with `new Function` in the Durable Object isolate. Both need stronger isolation or removal before handling untrusted production traffic.

## Critical Findings

### SEC-001 - Live artifact sandbox can escape into main-origin script execution

Severity: Critical

Location:

- `web/src/components/ChatBubble.tsx:86`
- `web/src/runtime/evaluator.ts:56`
- `web/src/runtime/evaluator.ts:66`
- `web/src/runtime/bridge.ts:31`
- `web/src/runtime/safe-dom-main.ts:29`
- `web/src/runtime/safe-dom-main.ts:64`

Evidence:

```ts
// web/src/components/ChatBubble.tsx:86
<SandboxedArtifact id={`${message.id}-${seg.index}`} code={seg.code} />

// web/src/runtime/evaluator.ts:56-68
const sandbox = new Proxy(globals, { ... });
const factory = new Function("__sandbox__", `with(__sandbox__){${stripped}\nreturn ${componentName};}`);

// web/src/runtime/bridge.ts:31-43
this.worker.addEventListener("message", (e: MessageEvent<WorkerToMainMessage>) => {
  const msg = e.data;
  if (msg.type === "ops") {
    this.applier.apply(msg.ops);
  }
});

// web/src/runtime/safe-dom-main.ts:29-66
const el = document.createElement(op.tag);
el?.setAttribute(op.name, op.value);
```

Impact:

LLM-generated ` ```preact ` artifact code is untrusted output but is evaluated with `new Function`. The `with`/`Proxy` boundary does not provide a JavaScript security sandbox: object/function constructor escape patterns can recover worker globals. Once escaped, artifact code can send forged `ops` messages directly to the main thread. The main thread trusts those ops and can create arbitrary elements and attributes in the app origin, including active content paths such as script-like elements, `on*` handler attributes, dangerous URL attributes, or credentialed same-origin requests from injected script.

Who can exploit:

Any flow that causes the assistant to emit a malicious or prompt-injected `preact` artifact. Today conversations are per-user, but this still compromises that authenticated user's origin context and becomes worse if conversations/artifacts are later shared.

Fix:

Replace this runtime with a real isolation boundary. Prefer a sandboxed iframe on a separate origin or opaque origin, for example `sandbox="allow-scripts"` without `allow-same-origin`, with a tight iframe CSP and a narrow, schema-validated postMessage API. If the worker bridge stays, do all of the following before treating it as safe:

- remove `new Function` for untrusted code or run it in a hardened JS interpreter;
- validate every worker message at runtime with a strict schema;
- allowlist tags, attributes, properties, CSS properties, and event types;
- block `script`, `iframe`, `object`, `embed`, `link`, `meta`, `base`, SVG script-capable surfaces, `srcdoc`, all `on*` attributes, and `javascript:`/dangerous `data:` URLs;
- add resource/time limits and fail closed on malformed ops.

Mitigation:

Until fixed, disable artifact rendering for production or show artifact source as inert text. A page-level CSP is useful defense-in-depth but should not be the primary isolation control here.

False Positive Notes:

The worker lacks direct cookie/localStorage access in the intended path, but the issue is that evaluated code can escape the intended path and the main thread trusts forged DOM ops.

## High Findings

### SEC-002 - `run_javascript` executes untrusted code in the Durable Object isolate

Severity: High

Location:

- `web/server/lib/tools.ts:118`
- `web/server/lib/tools.ts:191`
- `web/server/lib/tools.ts:198`
- `web/server/agents/chat-agent.ts:1029`

Evidence:

```ts
// web/server/lib/tools.ts:118-199
run_javascript: tool({
  ...
  const wrappedCode = `
    with (sandbox) {
      return (async () => {
        ${code}
      })();
    }
  `;
  const fn = new Function("sandbox", wrappedCode);
  const result = await fn(sandbox);
})

// web/server/agents/chat-agent.ts:1029
run_javascript to run code. Always run code rather than just showing it when asked to test something.
```

Impact:

The tool description says the code has no network or filesystem access, but the sandbox is not robust. JavaScript constructor escape patterns can recover the global object despite the `Proxy`, enabling access to host globals such as `fetch` and long-running CPU/memory abuse inside the Durable Object. The model is also instructed to use this tool proactively when asked to test code, so normal user prompts can reach this sink.

Who can exploit:

Authenticated users, or prompt-injection content that convinces the model to run attacker-controlled JavaScript.

Fix:

Remove the tool or move it into a real sandbox with enforced host isolation, CPU timeout, memory limit, and no network. Practical options include a hardened QuickJS/WASM interpreter, a dedicated isolated service with strict egress disabled, or a deterministic evaluator for the supported use cases. Do not use `new Function` for this feature.

Mitigation:

Disable `run_javascript` in production while replacing it. If a temporary version remains, gate it behind explicit user approval and strict length/runtime limits, but treat that as a stopgap only.

False Positive Notes:

Cloudflare Workers do not expose environment bindings as normal `globalThis` values, so this is not automatically a secret-read issue. It is still arbitrary server-side code execution with network and availability impact.

### SEC-003 - `read_url` is an unrestricted server-side fetch/browser-rendering primitive

Severity: High

Location:

- `web/server/lib/tools.ts:307`
- `web/server/lib/tools.ts:313`
- `web/server/lib/tools.ts:323`
- `web/server/lib/tools.ts:329`
- `web/server/lib/tools.ts:352`
- `web/server/lib/tools.ts:355`

Evidence:

```ts
// web/server/lib/tools.ts:307-355
read_url: tool({
  inputSchema: z.object({
    url: z.url().describe("The URL to fetch"),
  }),
  execute: async ({ url }) => {
    const res = await fetch(url, {
      headers: { "User-Agent": "le-chien/1.0", Accept: "..." },
      redirect: "follow",
    });
    ...
    const browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 15000 });
  }
})
```

Impact:

Authenticated users can cause the Worker and Cloudflare Browser Rendering to request arbitrary URLs. The code does not restrict protocol, host, private/link-local ranges, redirects, response size, or rendered-page egress. This can be abused for SSRF-style probing, unexpected requests from Cloudflare infrastructure, large-response resource exhaustion, or using the browser renderer against URLs the app should never touch.

Who can exploit:

Authenticated users with "Web access" enabled for a message, and prompt-injection content that causes the model to call `read_url`.

Fix:

Create a shared URL safety gate before both `fetch` and `page.goto`:

- allow only `http:` and `https:`;
- reject localhost, loopback, private, link-local, multicast, and metadata IP ranges after DNS resolution;
- re-check every redirect target or disable redirects and handle them manually;
- enforce max response bytes before buffering text;
- keep short timeouts and add per-user/tool rate limits;
- consider domain allowlists for high-risk deployments.

Mitigation:

Keep this tool opt-in and log destination hosts. Do not enable it for workspace/team-shared contexts until the URL gate exists.

False Positive Notes:

Cloudflare Workers are not a traditional LAN server, so the exact SSRF blast radius depends on deployment bindings and Cloudflare egress behavior. The primitive is still security-sensitive and currently unrestricted.

### SEC-004 - Agent RPC methods lack server-side input size and shape limits

Severity: High

Location:

- `web/server/agents/chat-agent.ts:582`
- `web/server/agents/chat-agent.ts:645`
- `web/server/agents/chat-agent.ts:655`
- `web/server/agents/chat-agent.ts:806`
- `web/server/agents/chat-agent.ts:997`
- `web/server/agents/chat-agent.ts:1007`

Evidence:

```ts
// web/server/agents/chat-agent.ts:582-590
createConversation(title: string, model?: string): Conversation {
  ...
  VALUES (${id}, ${title}, ${selectedModel}, ${now}, ${now})
}

// web/server/agents/chat-agent.ts:806-812
async sendMessage(stream, conversationId: string, content: string, model?: string, enabledExtras?: string[])

// web/server/agents/chat-agent.ts:997-1011
INSERT INTO messages ... ${content}
SELECT role, content FROM messages WHERE conversation_id = ${conversationId}
```

Impact:

Any authenticated client can bypass the UI and call Durable Object methods with oversized strings or malformed arrays. Chat messages, titles, and memories are persisted before model calls and there is no explicit maximum size for stored user content. This can increase Durable Object storage, inflate prompt construction, raise model cost, and degrade availability.

Who can exploit:

Authenticated users, malicious scripts running in the app origin, or a cross-origin WebSocket issue if cookies are accepted for that handshake.

Fix:

Add schema validation at every callable boundary. Suggested starting limits:

- `conversationId`: UUID format;
- `model`: enum of public model IDs only;
- `enabledExtras`: enum array with max length and deduping;
- `title`: 1-120 chars;
- `content`: product-defined cap, for example 16k-32k chars;
- memory key/value: bounded lengths and count per user.

Mitigation:

Keep the current history trimming, but do not rely on it as a storage/cost control because it happens after content is already persisted.

False Positive Notes:

SQL injection is not the concern here; the SQL template bindings are parameterized. The issue is resource exhaustion and cost control.

## Medium Findings

### SEC-005 - Agent WebSocket route does not validate request origin

Severity: Medium

Location:

- `web/server/index.ts:138`
- `web/server/index.ts:168`
- `web/server/index.ts:174`

Evidence:

```ts
// web/server/index.ts:138-150
app.use("/api/v1/*", async (c, next) => {
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
  ...
});

// web/server/index.ts:168-174
app.all("/api/v1/agent", async (c) => {
  const user = c.get("user");
  const agent = await getAgentByName(c.env.CHAT_AGENT as any, user.id, ...);
  return agent.fetch(c.req.raw);
});
```

Impact:

The WebSocket/RPC endpoint relies on cookie authentication and forwards the raw request to the user's Durable Object without checking `Origin`. If auth cookies are sent on a cross-site WebSocket request, a malicious origin could drive state-changing Agent RPCs such as sending messages, deleting conversations, or deleting memories.

Who can exploit:

A malicious website visited by an authenticated user if browser cookie `SameSite` behavior and Better Auth cookie settings allow the WebSocket handshake to include the session cookie.

Fix:

Reject unsafe origins before forwarding to the Durable Object:

- read `Origin`;
- allow exactly `getAppOrigin(c.env)` and local dev origins as needed;
- reject missing/foreign origins for browser WebSocket upgrades;
- consider a per-session CSRF token or signed WebSocket nonce for the Agent handshake.

Mitigation:

Verify Better Auth cookie flags in production. `SameSite=Lax` helps, but explicit origin validation is still the clearer control for cookie-authenticated WebSockets.

False Positive Notes:

This may be mitigated by current cookie defaults. It is still not visible in this route, and future `SameSite=None` settings for integrations would reopen the issue.

### SEC-006 - Frontend app shell security headers are not visible in app code

Severity: Medium

Location:

- `web/server/index.ts:26`
- `web/server/index.ts:34`
- `web/index.html:3`
- `web/index.html:52`

Evidence:

```ts
// web/server/index.ts:26-35
app.use("/api/*", async (c, next) => {
  ...
  headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
});
```

```html
<!-- web/index.html has no CSP meta/header source in repo -->
<script prerender type="module" src="/src/index.tsx"></script>
```

Impact:

Security headers are only set for `/api/*`. The SPA shell and static assets are served from the same Worker deployment, but no app-shell CSP, `frame-ancestors`, `X-Content-Type-Options`, referrer policy, permissions policy, or HSTS configuration is visible in repo code. This removes defense-in-depth for the exact pages that render model output, markdown, and artifacts.

Who can exploit:

This is defense-in-depth, but it materially increases impact if any XSS or artifact escape occurs.

Fix:

Set headers for the frontend shell and static responses at the Worker/Cloudflare layer. Start with report-only CSP, then enforce. Include at least:

- `Content-Security-Policy` with a tight `script-src`, `worker-src`, `connect-src`, `img-src`, `style-src`, and `frame-ancestors 'none'`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy`;
- `Permissions-Policy`;
- production HSTS if TLS is guaranteed.

Mitigation:

The current API CSP is useful but does not protect the document that runs the app.

False Positive Notes:

These headers may exist in external Cloudflare dashboard settings. They are not visible in this repository, so verify with production response headers.

### SEC-007 - Checkout success marks Pro without verifying the subscribed product

Severity: Medium

Location:

- `web/server/index.ts:68`
- `web/server/index.ts:75`
- `web/server/index.ts:93`
- `web/server/index.ts:109`

Evidence:

```ts
// web/server/index.ts:68-87
const subscriptions = await polarClient.subscriptions.list({
  customerId: checkout.customerId,
  active: true,
});
...
activeSubscription = page.items[0];

// web/server/index.ts:93-117
plan: "pro",
status: "active",
polarSubscriptionId: activeSubscription.id,
```

Impact:

The public checkout success route accepts a Polar `checkout_id`, lists active subscriptions for that customer, then writes `plan: "pro"` without checking that the active subscription product equals `POLAR_PRO_PRODUCT_ID`. If the Polar customer can have another active subscription in the same account, or if future products are added, this endpoint can grant Pro based on the wrong product.

Who can exploit:

Likely limited to users who can complete or reference a valid checkout tied to their Polar customer. The risk increases with multiple products or lower-priced products in the same Polar account.

Fix:

Verify both checkout and subscription product identity before upserting:

- require `activeSubscription.productId === c.env.POLAR_PRO_PRODUCT_ID`;
- require an active/valid status;
- if available in the SDK response, verify checkout line items/product ID directly;
- otherwise rely on the signed Polar webhook as source of truth and make success route read-only/polling.

Mitigation:

Keep the webhook handlers as the authoritative billing update path.

False Positive Notes:

The configured Better Auth checkout currently only exposes the Pro product slug, so this may be low likelihood in the current single-product setup.

### SEC-008 - Production dependency audit has unresolved critical/high advisories

Severity: Medium

Location:

- `web/package.json:25`
- `web/package.json:28`
- `web/package.json:31`
- `web/package.json:37`
- `pnpm-lock.yaml:55`
- `pnpm-lock.yaml:2742`
- `pnpm-lock.yaml:3091`
- `pnpm-lock.yaml:3637`

Evidence:

`pnpm audit --prod` reported 34 vulnerabilities: 1 critical, 13 high, 19 moderate, 1 low.

Notable locked versions:

```yaml
# pnpm-lock.yaml
hono: 4.11.8
dompurify: 3.3.3
protobufjs: 7.5.4
vite: 7.3.1
rollup: 4.57.1
kysely: 0.28.11
```

Impact:

Not every advisory is exploitable in this app, but several affect packages in production dependency paths:

- `hono@4.11.8` is a direct server dependency and is below patched versions for multiple advisories.
- `protobufjs@7.5.4` appears through `posthog-js`/OpenTelemetry and has a critical arbitrary-code-execution advisory when attacker-controlled protobuf definitions are compiled.
- build/runtime tooling packages are in `dependencies`, so `pnpm audit --prod` includes Vite/Rollup/PostCSS/Picomatch advisories that should be triaged or moved to dev-only where appropriate.

Who can exploit:

Depends on each package's usage path. The direct `hono` dependency should be updated even if specific vulnerable middleware is not currently used.

Fix:

Update direct dependencies and regenerate the lockfile. Prioritize:

- `hono >= 4.12.14`;
- dependency graph resolving `protobufjs >= 7.5.5`;
- `vite >= 7.3.2` and `rollup >= 4.59.0`;
- `kysely >= 0.28.14` through `better-auth`/`drizzle-orm` graph;
- `dompurify >= 3.4.0` through `posthog-js`.

Mitigation:

Add a scheduled dependency audit or Dependabot/Renovate flow. Keep `pnpm install --frozen-lockfile` in CI; it is already present in `.github/workflows/ci.yml:29`.

False Positive Notes:

`pnpm audit` can over-report transitive and build-tool risks. Treat this as a triage queue, not proof that every advisory is exploitable in production.

### SEC-009 - AI-driven memory writes persist personal data without explicit approval

Severity: Medium

Location:

- `web/server/agents/chat-agent.ts:968`
- `web/server/agents/chat-agent.ts:1031`
- `web/server/agents/chat-agent.ts:1047`
- `web/server/lib/tools.ts:218`
- `web/server/lib/tools.ts:231`

Evidence:

```ts
// web/server/agents/chat-agent.ts:968-970
const tools = createTools(this.env, {
  onSaveMemory: (key, value) => this.createMemory(key, value),
  onUpdateMemory: (id, key, value) => this.updateMemory(id, key, value),
});

// web/server/agents/chat-agent.ts:1031
Proactively use save_memory when the person shares something worth remembering...

// web/server/agents/chat-agent.ts:1047-1049
const memoryBlock = memories.map((m) => `- ${m.key}: ${m.value}`).join("\n");
systemPrompt += `...${memoryBlock}`;
```

Impact:

The model can persist memories without an explicit user approval step, and all memories are injected into later prompts. Prompt injection or model error can save sensitive personal data, secrets, or incorrect facts and keep re-exposing them to future model calls.

Who can exploit:

Prompt-injection content within a conversation or any model behavior that incorrectly classifies sensitive content as worth remembering.

Fix:

Require user approval before creating or updating memories, especially for sensitive categories. Add server-side deny rules for likely secrets and sensitive fields, max memory counts, and a clear audit trail.

Mitigation:

The UI lets users view/delete memories, but that is after persistence has already happened.

False Positive Notes:

This is a privacy and data-minimization issue more than a classic exploit. It conflicts with the MVP design expectation that memory suggestions are user-approved.

## Low Findings

### SEC-010 - TTS route has input length cap but no cost/rate integration

Severity: Low

Location:

- `web/server/routes/tts.ts:6`
- `web/server/routes/tts.ts:29`
- `docs/tts.md:39`

Evidence:

```ts
// web/server/routes/tts.ts:6-41
const MAX_INPUT_CHARS = 4000;
...
const cleaned = stripMarkdown(body.text).slice(0, MAX_INPUT_CHARS);
```

Impact:

The route is auth-gated and length-limited, but it can be called repeatedly and docs explicitly note it does not increment quota. This is mainly a cost/abuse risk.

Fix:

Track daily TTS usage or fold TTS into existing message/tool quotas. Add per-user rate limits if the model cost becomes meaningful.

False Positive Notes:

This is not urgent compared with the code-execution findings.

## Positive Notes

- SQL usage in reviewed app code is parameterized through Drizzle or D1 prepared statements.
- Secrets are documented as out-of-repo values, and `.dev.vars`/`wrangler.jsonc` are treated as local ignored config.
- API JSON responses set a restrictive CSP, `nosniff`, frame denial, and HSTS.
- TTS input is length-limited and returns `Cache-Control: private, no-store`.
- Web search result links use `rel="noopener noreferrer"` with `target="_blank"`.

## Verification Performed

- Read all project docs in `docs/`.
- Loaded applicable JavaScript/TypeScript frontend and server security guidance.
- Searched for high-risk sinks: `new Function`, `innerHTML`, markdown rendering, postMessage, WebSocket, storage, URL/navigation sinks, fetch, auth/session, headers, billing, and dependency posture.
- Ran `pnpm audit --prod`; it failed with findings and reported 34 vulnerabilities.
- Ran `pnpm -w run check`; it could not run because dependencies are not installed in this workspace (`oxlint: command not found`; local `node_modules` is missing).
