# Text-to-Speech (Read Aloud)

A speaker button on settled assistant messages synthesizes the text via
Workers AI and plays it back inline. Per-user daily quota is enforced
server-side and one in-flight audio element per bubble.

The button is hidden whenever the bubble has no readable prose to speak:
streaming bubbles, artifact-only responses, and whitespace-only content all
suppress it. Synthesis cost scales with input length, so we never want to fire
a request that has nothing meaningful to read.

## Server

`web/server/routes/tts.ts` mounts at `POST /api/v1/tts` (auth-gated by the
session middleware in `web/server/index.ts`). Request body:

```json
{ "text": "Hello world" }
```

Steps:

1. Validate body and reject empty input.
2. Strip markdown formatting (`stripMarkdown`) so the synthesizer doesn't read
   asterisks, backticks, list markers, or link URLs aloud. Fenced code blocks
   are dropped entirely.
3. Truncate to `MAX_INPUT_CHARS` (1500) to bound per-call cost and latency,
   and reject anything shorter than `MIN_INPUT_CHARS` (4) as "Nothing to read".
4. Call the AI binding with `@cf/myshell-ai/melotts`, which returns
   `{ audio: <base64 mp3> }`.
5. Decode base64 and stream the bytes back as `audio/mpeg`.

The client never sends artifact (`\`\`\`preact … \`\`\``) blocks to this route —
`ChatBubble` parses the message into segments and only forwards the
concatenated markdown segments. Server-side `stripMarkdown` is the second line
of defense, not the first.

The response is `Cache-Control: private, no-store` — no edge caching of
user content.

## Client

State lives in `web/src/models/read-aloud.ts` as `ReadAloudModel`, a
`createModel` factory that returns per-instance signals:

- `status: "idle" | "loading" | "playing" | "error"`
- `errorMessage: string | null`
- `play(text)` — toggles: starts on idle/error, stops on playing, no-op on
  loading.
- `dispose()` — cleans up the `<audio>` element and revokes the object URL.

`ChatBubble.tsx` calls `useModel(ReadAloudModel)` per bubble (each instance is
independent because `useModel` runs the factory once via `useMemo([])`), and
disposes on unmount. The button is hidden while a message is still streaming
(to avoid synthesizing partial sentences) and also when the parsed markdown
segments contain no non-whitespace text — so artifact-only replies, tool-call
echoes, and the like never expose the speaker.

## Trade-offs and known gaps

- **No caching.** Every click re-synthesizes. Adding R2-backed caching keyed
  by `(messageId, voice)` would cut latency and inference cost; deferred until
  there's user demand.
- **Single voice.** No voice selection — melotts default. The roadmap entry
  in `docs/roadmap-tools.md` covers extending this.
- **Daily quota.** When `BILLING_ENABLED=true`, every successful synthesis
  increments `daily_tts_usage` (one row per `(user_id, usage_date)`). The
  `tryIncrementDailyTtsUsage` helper does an atomic `INSERT … ON CONFLICT DO
  UPDATE … WHERE message_count < limit RETURNING message_count`, so the route
  returns `429 Daily read-aloud limit reached` without firing a Worker AI call
  when the cap is hit. Free: `PLAN_LIMITS.free.dailyTtsRequests` (5/day). Pro:
  50/day. Self-hosted (`BILLING_ENABLED` unset) bypasses the check entirely.
- **No streaming audio.** We buffer the full MP3 server-side, then ship it.
  Users wait until synthesis completes before hearing anything. Streaming
  would shave time-to-first-sound but the worker AI binding doesn't expose a
  chunked output for melotts today.

## When the click does nothing

- Status stuck on `loading`: the AI binding hung. Check the Cloudflare
  dashboard for the worker AI namespace.
- Status flips straight to `error`: usually a 500 from the route. The error
  text bubbles up via `errorMessage`. Common cause: the model name is wrong
  for the deployed compatibility date.

## Gotcha: "Playback failed" after a successful read

Setting `audio.src = ""` to unload a media element fires the element's `error`
event in browsers (empty src is itself a load error). If the `error` handler
is still attached during teardown, a normal `ended` → teardown sequence ends
with status flipped to `"error"` and `errorMessage = "Playback failed"` right
after the `ended` handler had set it to `"idle"`.

Fix: null out `onended`/`onerror` before touching the element's src, then use
`removeAttribute("src")` + `load()` to release the resource cleanly. Keep the
listeners as `.on*` properties (not `addEventListener`) so nulling is enough
to detach them.
