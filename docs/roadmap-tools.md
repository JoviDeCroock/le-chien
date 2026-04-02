# Roadmap: Future Tools

Four tools on the roadmap, in rough priority order. Each section covers what the tool does, how it works on Cloudflare Workers, and what needs deciding before building.

## 1. Image & File Understanding (Multimodal Input)

### What it does

Users can attach images directly in chat. The model sees them as vision inputs and can describe, analyze, or answer questions about them.

### Implementation

- Add a file upload endpoint that accepts images and stores them in R2 (Cloudflare's object storage).
- Modify the message format sent to the model to include image URLs or base64-encoded data alongside the text content.
- Use Workers AI models that support vision inputs (check model cards for multimodal support).
- Store R2 object keys in the message metadata so images persist in conversation history.

### Key decisions

| Decision | Options | Notes |
| --- | --- | --- |
| Storage | R2 vs inline base64 | R2 is cleaner for persistence, base64 is simpler but bloats message payloads |
| Max file size | 5MB vs 10MB | Workers has a request body limit; R2 upload can handle larger files via presigned URLs |
| Supported formats | PNG, JPEG, WebP, GIF | Start narrow, expand later |
| Conversation history | Store R2 URL vs re-encode | R2 URLs keep history lightweight; need signed URLs if bucket is private |

## 2. Text-to-Speech (Read Aloud)

### What it does

A "read aloud" button on assistant messages that synthesizes speech from the message text. Users hear the response instead of reading it.

### Implementation

- Add an API endpoint that accepts text and returns audio using Workers AI TTS models (e.g. `@cf/myshell-ai/melotts`).
- Client-side: add a speaker icon button to `ChatBubble` for assistant messages. On click, call the endpoint and play the returned audio via the Web Audio API or an `<audio>` element.
- Strip markdown formatting from the text before sending to TTS.

### Key decisions

| Decision | Options | Notes |
| --- | --- | --- |
| Response mode | Streaming chunks vs full audio | Full audio is simpler; streaming gives faster time-to-first-sound but adds complexity |
| Audio format | MP3 vs WAV vs OGG | MP3 is smaller and universally supported; WAV is lossless but large |
| Voice selection | Single default vs user-selectable | Start with one good default voice, add selection later |
| Which messages | All assistant messages vs long ones only | All messages keeps it simple; gating on length adds logic for marginal benefit |
| Caching | Cache generated audio in R2 | Avoids re-synthesizing the same message; keyed by message ID + voice |

## 3. Document Summarization (PDF/File Upload)

### What it does

Users upload PDFs or text documents. The system extracts the text and feeds it to the model for summarization, Q&A, or analysis.

### Implementation

- Builds on the file upload infrastructure from tool #1 (R2 storage, upload endpoint).
- Extract text from PDFs using a library that works in the Workers runtime. `pdf-parse` is Node-native and may not work directly; alternatives include `pdfjs-dist` (can run in Workers with some setup) or calling an external extraction service.
- Feed extracted text into the LLM context as part of the user message or as a system-level attachment.
- For long documents, chunk the text and include the most relevant chunks (or summarize in stages).

### Key decisions

| Decision | Options | Notes |
| --- | --- | --- |
| Extraction library | `pdfjs-dist` in Workers vs external service | `pdfjs-dist` avoids network hops but needs testing in the Workers runtime |
| Max document size | 10MB vs 25MB | Larger docs need chunking regardless; the limit is more about upload UX |
| Chunking strategy | Fixed-size chunks vs semantic splitting | Semantic splitting (by headers/paragraphs) gives better results but is harder |
| Storage | Ephemeral (process and discard) vs persist in R2 | Persisting lets users reference the doc later; ephemeral is simpler |
| Long doc handling | Summarize-then-detail vs RAG-style retrieval | Summarize-then-detail is simpler for v1; RAG is more powerful for large docs |

## 4. Canvas / Artifact Rendering

### What it does

When the model generates HTML, SVG, or interactive code, it renders inline in the chat as a live preview. Users can iterate on the artifact through conversation.

### Implementation

- Detect code blocks with specific language markers (e.g. ` ```html `, ` ```svg `, ` ```mermaid `) or a custom ` ```artifact ` fence.
- Render the content in a sandboxed `<iframe>` using `srcdoc` with strict CSP headers to prevent escaping the sandbox.
- Add UI controls: "Open in panel", "Copy code", "Edit" (opens a side editor).
- Store artifact source in message metadata so it survives page reloads.

### Key decisions

| Decision | Options | Notes |
| --- | --- | --- |
| Sandboxing | `srcdoc` iframe with `sandbox` attribute | Use `sandbox="allow-scripts"` but no `allow-same-origin` to prevent parent access |
| Supported content | HTML/CSS/JS, SVG, Mermaid | HTML/SVG first, Mermaid needs a renderer library loaded in the iframe |
| Layout | Inline in chat vs side panel | Inline keeps flow; side panel gives more space. Could offer both with a toggle |
| Persistence | Save artifacts to R2 vs ephemeral | Saving lets users share or revisit; ephemeral is simpler |
| Edit-in-place | Editable code alongside preview | Two-pane layout (code left, preview right) when user clicks "Edit" |
| Iteration | User describes changes in chat | Model receives current artifact source + user request, generates updated version |
