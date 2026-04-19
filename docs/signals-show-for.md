# Show / For from `@preact/signals/utils`

Two tiny components from `@preact/signals/utils` that let us swap inline
`{signal.value && <X/>}` and `{arr.value.map(...)}` patterns for a form that
avoids re-running the parent component when only the condition or list
identity has changed.

## Why

- `Show` reads its `when` signal inside its own render, so changes to that
  signal update the subtree without re-rendering the parent.
- `For` caches each rendered `<Item>` JSX element by **item reference**. When
  the array is extended immutably (common pattern in our models, e.g. chat
  messages appended via `[...prev, next]`), only the newly-added items render
  fresh — the cached JSX for existing items is reused verbatim.

## API

```ts
// src: web/node_modules/@preact/signals/utils/src/index.tsx
<Show when={signal | () => boolean} fallback={...}>{children}</Show>
<For each={signalOfArray}>{(item, index) => <ChildElement/>}</For>
```

`For`'s child callback receives the **raw item value** (not a signal). Keying
works as usual — provide a stable `key` on the returned element.

## When to use / skip

Use `Show` when the condition is a simple signal or a callback closing over
signals. If the parent already reads the same signal elsewhere (e.g. for a
class toggle), the parent will still re-render on changes, so the perf win is
marginal — but using `Show` is still idiomatic and reads cleanly.

Use `For` for lists backed by a signal array. Especially valuable when:

- the array grows by append (existing items keep their references), or
- the individual items are moderately expensive to render (tool call cards,
  markdown bubbles, etc.).

Skip when:

- the condition mixes multiple unrelated booleans — wrap with a `computed`
  first, or leave as-is.
- the "array" is a plain static array (e.g. a constant tab list) — map is fine.

## Example

```tsx
import { Show, For } from "@preact/signals/utils";

<For each={chat.messages}>
  {(msg) => <ChatBubble key={msg.id} message={msg} streaming={chat.streaming.value} />}
</For>

<Show when={chat.error}>
  <ErrorBanner message={chat.error.value!} />
</Show>
```

## Gotchas

- `<Show when={form.error}>` — `form.error` is `Signal<string | null>`.
  Inside the children, reading `form.error.value` gives `string | null`. TS
  will complain when you pass it where only `string` is accepted. Use `!` if
  you're sure (Show only renders the children when truthy).
- `For` caches by item identity. If your model replaces the entire array with
  a new array of **cloned** objects on every tick, every item will be treated
  as new and the cache is useless. Keep existing item references stable on
  updates (spread prior items, only mutate the one that changed).
