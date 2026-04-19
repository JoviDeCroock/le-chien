# Text-to-Speech (Read Aloud)

A speaker button on every settled assistant message synthesizes the text via
Workers AI and plays it back inline. No persistent storage, no per-user quota
yet — just on-demand synthesis and one in-flight audio element per bubble.

## Server

`web/server/routes/tts.ts` mounts at `POST /api/v1/tts` (auth-gated by the
session middleware in `web/server/index.ts`). Request body:

```json
{ "text": "Hello world" }
```

Steps:

1. Validate body and reject empty input.
2. Strip markdown formatting (`stripMarkdown`) so the synthesizer doesn't read
   asterisks, backticks, list markers, or link URLs aloud.
3. Truncate to `MAX_INPUT_CHARS` (4000) to keep model latency bounded.
4. Call the AI binding with `@cf/myshell-ai/melotts`, which returns
   `{ audio: <base64 mp3> }`.
5. Decode base64 and stream the bytes back as `audio/mpeg`.

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
to avoid synthesizing partial sentences.

## Trade-offs and known gaps

- **No caching.** Every click re-synthesizes. Adding R2-backed caching keyed
  by `(messageId, voice)` would cut latency and inference cost; deferred until
  there's user demand.
- **Single voice.** No voice selection — melotts default. The roadmap entry
  in `docs/roadmap-tools.md` covers extending this.
- **No quota integration.** Unlike chat completions and image generation, TTS
  does not increment any counter in `dailyMessageUsage`. This is fine for
  launch but should be revisited if the cost line becomes meaningful.
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
