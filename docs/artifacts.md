# Live UI Artifacts (`​```preact` fence)

Inline Preact-like components that the model can emit mid-response. The chat UI
extracts them from assistant messages and renders them as live widgets between
paragraphs of markdown.

## Wire protocol

The model is taught through the system prompt in
`web/server/agents/chat-agent.ts` to wrap interactive UI in a `​```preact`
fenced code block. Example:

````
```preact
function Counter() {
  const [n, setN] = useState(0);
  return h(
    "button",
    {
      onClick: () => setN(n + 1),
      style: {
        padding: "6px 12px",
        background: "#7c3aed",
        color: "#fff",
        borderRadius: "8px",
      },
    },
    "Clicked " + n + " times"
  );
}
```
````

Rules enforced through the prompt and by the renderer:

- No JSX. Components use `h(tag, props, ...children)`.
- No `import`/`export`. The renderer injects `h`, `Fragment`, `useState`,
  `useEffect`, `useRef`, `useMemo`, and `useCallback`.
- The component is a single PascalCase function or const placed last in the
  block.
- Network, storage, timers, `document`, `window`, and browser globals are
  unavailable inside the renderer.
- Use inline `style={{ ... }}` objects instead of Tailwind classes. The host
  page's Tailwind is JIT-compiled from source, so invented utility classes may
  not exist at runtime.

`web/src/lib/parse-artifacts.ts` splits streamed content into alternating
markdown and `preact` segments. While a fence is open but not yet closed, the
bubble shows a "Compiling artifact..." placeholder instead of rendering
half-written code.

## Sandbox model

Artifact code no longer runs in the browser. `SandboxedArtifact` posts an
`artifactId`, the code, and an optional event payload to
`POST /api/v1/artifacts/render`. The browser does not own or replay hook state.
The server routes the render through an `ArtifactSession` Durable Object keyed
by authenticated user id plus artifact id, and that DO loads the code into a
Cloudflare Dynamic Worker via the `LOADER` Worker Loader binding with
`globalOutbound: null`.

The Dynamic Worker loads the app's pinned `preact` and `preact/hooks` ESM
bundles as Worker Loader modules, then renders the component with native
Preact `h`, `Fragment`, and hook implementations. A small server-side renderer
walks the resulting Preact VNode tree and converts it into the same sanitized
JSON VDOM contract used by the browser.

Import those runtime bundles through the exported package entrypoints
(`preact?raw` and `preact/hooks?raw`). The Cloudflare Worker build runs under
`workerd` export conditions and rejects unexported deep imports such as
`preact/hooks/dist/hooks.module.js?raw`, even if a client-only Vite build
accepts them.

Element VNode props are filtered through Preact's `options.vnode` hook as soon
as `h()` creates them. That keeps unsafe DOM/SVG attributes out of normal
element VNodes before the renderer walks the tree. Component props are left
alone so generated helper components can still pass internal values around;
the final JSON serializer applies the same allowlist again before anything
reaches the browser.

- `useState()` uses native Preact hook state during render and serializes
  JSON-safe values back to the `ArtifactSession` DO between requests.
- `useEffect()` is flushed synchronously after render for deterministic local
  state derivations; re-renders are capped to keep execution bounded.
- `useRef()` persists JSON-safe `.current` values.
- `useMemo()` and `useCallback()` use native Preact during a render pass, but
  non-serializable memoized values are intentionally recomputed on later
  requests instead of being restored as stale placeholders.

Hook state is serialized per function component in render order. That keeps
correctness independent from Worker Loader isolate reuse while still allowing
nested function components to use hooks. The browser never receives this
serialized hook state.

The worker sanitizes the returned tree into an allowlisted JSON VDOM shape:

- only known HTML/SVG tags are preserved;
- event handlers become opaque event ids;
- dangerous props, `on*` props, `dangerouslySetInnerHTML`, unsafe URLs, and
  unsafe style values are dropped;
- node count, depth, text length, prop length, code size, and serialized state
  are bounded.

The browser renders that JSON VDOM with Preact. It never evaluates artifact
JavaScript and never replays arbitrary DOM operations. When a user clicks,
types, changes a control, or submits a form, the browser sends the opaque event
id back to the render endpoint. The Dynamic Worker re-renders, invokes the
matching handler inside the isolated worker, updates hook state, sanitizes the
next tree, and returns it to the `ArtifactSession` DO.

During event re-renders, the browser keeps the previous sanitized VDOM mounted
until the next response arrives. Only the initial render or a changed artifact
source shows the full "Rendering artifact..." placeholder, so interactive
artifacts do not flicker between user actions.

## Interactivity contract

Dynamic Workers still allow interactive JavaScript, but not browser-resident
artifact JavaScript. Interactivity is event-driven:

1. Initial render sends `{ artifactId, code }` to the server.
2. The `ArtifactSession` DO initializes empty hook state and calls the Dynamic
   Worker with `{ code, state: [] }`.
3. The browser renders that inert VDOM and wires allowed event ids to a fetch
   back to `/api/v1/artifacts/render`.
4. The next request sends `{ artifactId, code, event }`; the DO retrieves the
   stored hook state, the Dynamic Worker rebuilds the handler map, invokes the
   matched handler, and returns the next sanitized VDOM/state pair to the DO.
5. The DO persists the updated hook state and returns only the sanitized VDOM
   to the browser.

This supports stateful buttons, forms, controls, small calculators, simple
event-driven games, and deterministic `useEffect` state derivations. It
intentionally does not support arbitrary browser APIs, DOM reads/writes,
network/storage access, or long-running effects. If future artifacts need
requestAnimationFrame-style animation or timers, add an explicit runtime
primitive instead of allowing artifact code to run in the browser again.

## Dynamic Worker binding

Local and production Worker configs need a Worker Loader binding:

```jsonc
"worker_loaders": [
  {
    "binding": "LOADER",
  },
]
```

The Dynamic Worker module is created at request time in
`web/server/lib/dynamic-workers.ts`. Artifact renders use `LOADER.get()` with a
SHA-256 cache id derived from the generated worker source, so Cloudflare can
reuse a warm isolate for identical artifact code when available. Hook state is
stored in the `ArtifactSession` DO, so correctness still does not depend on the
Dynamic Worker cache being warm. Outbound network is disabled through the Worker
Loader `globalOutbound: null` setting, so artifact code and the `run_javascript`
tool do not inherit the app Worker's fetch capability.

## ArtifactSession Durable Object

`web/server/agents/artifact-session.ts` owns per-user, per-artifact runtime
state. The API Worker validates the user session, resolves the DO using
`userId:artifactId`, and forwards the render request with the authenticated user
id. The DO stores:

- owner user id;
- artifact id;
- SHA-256 hash of the current source code;
- serialized hook state returned by the Dynamic Worker;
- a monotonically increasing render version;
- creation and update timestamps.

Requests to the same artifact session are queued inside the DO so rapid events
process serially against the latest stored hook state. If the same `artifactId`
receives different code, the DO resets hook state, updates the code hash, and
does a fresh render without replaying the stale event.

Artifact sessions are ephemeral chat UI state. Each render attempt schedules a
DO alarm for 24 hours after the latest update. When the alarm fires, stale
sessions delete their storage; active sessions push the alarm forward.

## Streaming behavior

`parseArtifacts` only renders the artifact after the closing ` ``` ` has been
streamed. This avoids compiling a Dynamic Worker per token and avoids evaluating
half-finished syntax. The placeholder card shows during streaming so the user
knows something is coming.

## Containment and theme defaults

The artifact mount (`.sandboxed-artifact-body` in `style.css`) still protects
the surrounding chat bubble from badly styled output:

- **Height clamp.** The container is `max-h-[480px] overflow-auto`.
- **Default text color.** The container sets `text-neutral-200` so components
  that forget a text color still render readable text on the dark card.
- **`contain: layout paint`.** Keeps artifact layout independent from the
  surrounding chat stream.

Keep the system prompt, server sanitizer, client renderer, and CSS container in
sync when adding a new supported tag, prop, event type, or hook.
