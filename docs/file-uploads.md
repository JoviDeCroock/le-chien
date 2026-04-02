# File Uploads

Users can attach files (images, PDFs, text files) to their messages. The AI model receives these as part of the conversation context.

## Supported File Types

| Type | MIME Types | How It's Processed |
| --- | --- | --- |
| Images | `image/png`, `image/jpeg`, `image/webp`, `image/gif` | Sent as image content parts to the AI model (vision input) |
| PDFs | `application/pdf` | Sent as file content parts to the AI model |
| Text files | `text/plain`, `text/csv`, `text/markdown` | Contents decoded as text and included in the user message |

Maximum file size: **10 MB**.

## Architecture

### Upload Flow

1. User selects files via the paperclip button, drag-and-drop, or paste
2. Files are uploaded to Cloudflare R2 via `POST /api/v1/upload`
3. The upload endpoint returns `{ key, name, type, size }`
4. Attachment metadata is stored in the `ChatModel.attachments` signal
5. When the user sends a message, attachment metadata is passed to `sendMessage`
6. The chat agent fetches file contents from R2 and builds multimodal content parts

### Storage

- **R2 bucket**: `le-chien-uploads` (binding: `UPLOADS`)
- **Object key format**: `{userId}/{uuid}-{filename}`
- **Message metadata**: Stored in `messages.attachments` column (JSON array)

### Frontend Components

- `ChatInput` — Paperclip button, drag-and-drop zone, paste handler, attachment chips with remove buttons
- `ChatBubble` — Displays attachment badges on user messages showing file name, type icon, and size

### Backend Processing

In `chat-agent.ts`, the `sendMessage` method:
1. Saves attachment metadata as JSON in the `messages.attachments` column
2. When building AI messages from history, parses attachments and fetches from R2
3. Constructs content parts based on file type:
   - Images → `{ type: 'image', image: bytes, mimeType }`
   - PDFs → `{ type: 'file', data: bytes, mimeType }`
   - Text → `{ type: 'text', text: fileContents }`

### R2 Setup

The R2 bucket must be created before deploying:

```sh
wrangler r2 bucket create le-chien-uploads
```

The binding is configured in `wrangler.jsonc` and typed in `server/env.d.ts`.

## Future: Audio File Transcription

Allow users to upload audio files (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.webm`) and have them transcribed to text before being included in the conversation.

### How it would work

1. Accept audio MIME types in the upload endpoint (`audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp4`, `audio/webm`)
2. In `sendMessage`, when an attachment has an `audio/*` type, run it through a Workers AI speech-to-text model (e.g. `@cf/openai/whisper`) before building the message
3. Include the transcribed text as a text content part: `[Transcription of {filename}]: {text}`
4. Store the transcription result alongside the attachment metadata so it doesn't need to be re-transcribed when loading history

### Decisions to make

| Decision | Options | Notes |
| --- | --- | --- |
| Transcription model | `@cf/openai/whisper` vs external API | Whisper via Workers AI keeps it in-network; check language support and accuracy |
| Max audio duration | 5 min vs 30 min | Longer files = more processing time and larger transcripts; may need chunking |
| Caching | Store transcript in attachment metadata vs separate column | Metadata is simpler; avoids re-transcription on every history load |
| UI indicator | Show "Transcribing..." status vs silent | Users should probably see that transcription is happening since it adds latency |
| Accepted formats | Start narrow (mp3/wav) vs broad | mp3 and wav cover most cases; expand later |
