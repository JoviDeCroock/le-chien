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
- Plain JavaScript only. The prompt bans TypeScript annotations and `as`
  assertions; the renderer also strips common `as const` / `value as Type`
  assertions because models still occasionally emit them.
- No `import`/`export`. The renderer injects `h`, `Fragment`, `useState`,
  `useEffect`, `useRef`, `useMemo`, `useCallback`, and `useInterval`.
- The component is a single PascalCase function or const placed last in the
  block.
- Network, storage, arbitrary timers, `document`, `window`, and browser
  globals are unavailable inside the renderer. Periodic UI updates must use
  the controlled `useInterval(callback, delayMs)` primitive.
- Use inline `style={{ ... }}` objects instead of Tailwind classes. The host
  page's Tailwind is JIT-compiled from source, so invented utility classes may
  not exist at runtime.

`web/src/lib/parse-artifacts.ts` splits streamed content into alternating
markdown and `preact` segments. While a fence is open but not yet closed, the
bubble shows a "Compiling artifact..." placeholder instead of rendering
half-written code.

## Sandbox model

Artifact code no longer runs in the browser. `SandboxedArtifact` posts the code,
current hook state, and optional event payloads to
`POST /api/v1/artifacts/render`. The server loads the code into a Cloudflare
Dynamic Worker via the `LOADER` Worker Loader binding with `globalOutbound:
null`.

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
  JSON-safe values back to the browser between requests.
- `useEffect()` is flushed synchronously after render for deterministic local
  state derivations; re-renders are capped to keep execution bounded.
- `useRef()` persists JSON-safe `.current` values.
- `useMemo()` and `useCallback()` use native Preact during a render pass, but
  non-serializable memoized values are intentionally recomputed on later
  requests instead of being restored as stale placeholders.
- `useInterval(callback, delayMs)` registers a bounded host-managed timer for
  the current render. The browser owns the real `setInterval` and sends opaque
  `timer` events back to the render endpoint; artifact code still never gets
  direct access to browser timers.

Hook state is serialized per function component in render order. That keeps
correctness independent from Worker Loader isolate reuse while still allowing
nested function components to use hooks.

The worker sanitizes the returned tree into an allowlisted JSON VDOM shape:

- only known HTML/SVG tags are preserved;
- event handlers become opaque event ids;
- dangerous props, `on*` props, `dangerouslySetInnerHTML`, unsafe URLs, and
  unsafe style values are dropped;
- node count, depth, text length, prop length, code size, and serialized state
  are bounded.

The browser renders that JSON VDOM with Preact. It never evaluates artifact
JavaScript and never replays arbitrary DOM operations. When a user clicks,
types, changes a control, submits a form, or a registered `useInterval` timer
ticks, the browser sends the opaque event id back to the render endpoint. The
Dynamic Worker re-renders, invokes the matching handler inside the isolated
worker, updates hook state, sanitizes the next tree, and returns it.

During event re-renders, the browser keeps the previous sanitized VDOM mounted
until the next response arrives. Only the initial render or a changed artifact
source shows the full "Rendering artifact..." placeholder, so interactive
artifacts do not flicker between user actions.

## Interactivity contract

Dynamic Workers still allow interactive JavaScript, but not browser-resident
artifact JavaScript. Interactivity is event-driven:

1. Initial render sends `{ code, state: [] }` to the server.
2. The Dynamic Worker returns sanitized JSON VDOM plus serialized hook state.
3. The browser renders that inert VDOM and wires allowed event ids to a fetch
   back to `/api/v1/artifacts/render`.
4. The next request sends `{ code, state, event }`; the Dynamic Worker rebuilds
   the handler map, invokes the matched handler, and returns the next sanitized
   VDOM/state pair.

This supports stateful buttons, forms, controls, small calculators, simple
event-driven games, deterministic `useEffect` state derivations, and coarse
periodic updates through `useInterval`. It intentionally does not support
arbitrary browser APIs, DOM reads/writes, network/storage access, raw timers,
or long-running effects. If future artifacts need requestAnimationFrame-style
animation, add another explicit runtime primitive instead of allowing artifact
code to run in the browser again.

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
reuse a warm isolate for identical artifact code when available. Hook state
still round-trips explicitly between browser and server, so correctness does
not depend on that cache being warm. Outbound network is disabled through the
Worker Loader `globalOutbound: null` setting, so artifact code and the
`run_javascript` tool do not inherit the app Worker's fetch capability.

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
