# Live UI Artifacts (`​```preact` fence)

Inline, sandboxed Preact components that the model can emit mid-response. The
chat UI extracts them from assistant messages and renders them as live widgets
between paragraphs of markdown.

## Wire protocol

The model is taught (via system prompt in `web/server/agents/chat-agent.ts`)
to wrap interactive UI in a `​```preact` fenced code block. Example:

````
```preact
function Counter() {
  const [n, setN] = useState(0);
  return h(
    "button",
    { class: "px-3 py-1 rounded bg-violet-600 text-white", onClick: () => setN(n + 1) },
    "Clicked " + n + " times"
  );
}
```
````

Rules enforced through the prompt (and partially by the sandbox runtime):

- No JSX. The runtime evaluates raw JavaScript via `new Function`, so JSX would
  not parse. Components use `h(tag, props, ...children)`.
- No `import`/`export`. The runtime provides `h`, `Fragment`, `useState`,
  `useEffect`, `useRef`, `useMemo`, `useCallback` as scope-injected globals.
- The component is a single PascalCase function placed last in the block.
- Tailwind utility classes via `class={…}` for styling — the artifact mounts
  inside the chat surface so it inherits the dark palette by default.

`web/src/lib/parse-artifacts.ts` splits the streamed content into alternating
`{ kind: "markdown" }` / `{ kind: "preact" }` segments. While a fence is open
but not yet closed, the segment is marked `complete: false` and the bubble
shows a "Compiling artifact…" placeholder instead of mounting half-written
code.

## Sandbox model

Ported from the `dynamui` prototype (see `/Users/jovi/Documents/SideProjects/dynamui`).
Lives entirely in `web/src/runtime/`:

| File | Role |
| --- | --- |
| `safe-dom-types.ts` | Shared `DomOp` and message envelope types. |
| `safe-dom-worker.ts` | Worker-side `SafeDocument`, `SafeElementBase`, etc. — a fake DOM that batches mutations into `DomOp[]` per microtask and posts them to the main thread. |
| `safe-dom-main.ts` | Main-thread `SafeDomApplier` — replays `DomOp[]` against a real container element and forwards real DOM events back to the worker. |
| `evaluator.ts` | Strips module syntax from the LLM source and runs it inside a `with(__sandbox__)` scope whose `Proxy` returns `undefined` for any identifier not explicitly whitelisted. |
| `artifact-worker.ts` | Worker entry. Boots `SafeDocument`, installs it as `globalThis.document`, calls Preact's `render()` against it. |
| `bridge.ts` | `SandboxBridge` — main-thread class that spawns the worker, wires up the applier, queues mounts until the worker says `ready`. |

The component wrapper is `web/src/components/SandboxedArtifact.tsx`. It owns
its own `SandboxBridge` per mount, exposes a Hide/Show toggle, and surfaces
worker errors inline.

## Why a worker, not an iframe

A sandboxed `<iframe srcdoc>` was the obvious alternative (and is what
`docs/roadmap-tools.md` originally proposed). The worker approach wins on a
few axes:

- No second document, no styling double-load, no scrollbars-in-scrollbars,
  no `iframe` resize calculations.
- The DOM the user sees lives in the parent document — Tailwind classes Just
  Work, dark theme is inherited, focus rings look right.
- The trust boundary is stronger in some respects: the worker has no access to
  cookies, `localStorage`, or any real DOM APIs. The Proxy-based scope blocks
  `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator`, and storage globals at
  the language level, so even a worker that breaks out of its top-level
  invocation has nowhere to go.
- The trust boundary is weaker in others: the worker shares the same origin's
  `postMessage` channel with the main thread. We mitigate by validating the
  shape of incoming messages (`type: "ops" | "ready" | "error"`) and never
  using DOM op payloads as code.

## Streaming behavior

`parseArtifacts` only mounts the worker when the closing ` ``` ` has been
streamed. This avoids spinning up a worker per token and re-evaluating
half-finished syntax. The placeholder card shows during streaming so the
user knows something is coming.

## Adding a new sandbox global

1. Import the symbol in `artifact-worker.ts`.
2. Add it to `SANDBOX_GLOBALS`.
3. Update the system prompt in `chat-agent.ts` so the model knows it exists.

If the new global needs a stub on the main thread (e.g., a remote-callable
API), extend `MainToWorkerMessage` / `WorkerToMainMessage` in
`safe-dom-types.ts` and add a handler in both ends.
