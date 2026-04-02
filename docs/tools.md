# Tool Use

le chien supports tool calling, allowing the LLM to take actions and fetch information during a conversation.

## Available Tools

| Tool                   | Description                                                                                                                           | Requires Config |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `get_current_datetime` | Returns current date, time, day of week, and Unix timestamp. Supports IANA timezones.                                                 | No              |
| `calculate`            | Evaluates math expressions safely (no eval). Supports arithmetic, exponents, functions (sqrt, sin, log, etc.), and constants (PI, E). | No              |
| `read_url`             | Fetches a URL and returns extracted text content. HTML is stripped to plain text. Truncated to 12k chars.                             | No              |
| `generate_image`       | Generates an image from a text prompt using Cloudflare Workers AI (Flux 1 Schnell). Returns a base64 data URL rendered inline.       | AI binding       |
| `run_javascript`       | Executes JavaScript code in an isolated environment (no network/FS). Returns the last expression's value. Requires `unsafe-eval` flag. | No              |

## Architecture

### Backend

Tools are defined in `api/src/lib/tools.ts` using the AI SDK's `tool()` helper with Zod input schemas. They're passed to `streamText()` in the chat agent's `sendMessage` method.

Multi-step tool use is enabled via `stopWhen: stepCountIs(5)` — the model can chain up to 5 tool calls in a single turn.

The `fullStream` iterator emits typed events (`text-delta`, `tool-call`, `tool-result`) which are forwarded to the client through the streaming callable.

Tool call metadata is stored in the `messages.tool_calls` column (JSON) so it persists across page loads.

### Frontend

The stream protocol sends:

- **String chunks** for text content (backwards compatible)
- **Objects with `__event` field** for tool events (`tool-call`, `tool-result`)

The `ChatModel.onChunk` handler distinguishes between these and updates the message's `tool_calls` array. Tool calls are rendered as collapsible cards via `ToolCallCard` inside `ChatBubble`.

### Stream Event Format

```
// Text: sent as plain string
stream.send("Hello ")

// Tool call started:
stream.send({ __event: "tool-call", id: "tc_123", name: "calculate", args: { expression: "2+2" } })

// Tool result:
stream.send({ __event: "tool-result", id: "tc_123", name: "calculate", result: { expression: "2+2", result: 4 } })
```

## Adding New Tools

1. Add the tool definition in `api/src/lib/tools.ts` inside `createTools()`
2. Use `tool({ description, inputSchema: z.object({...}), execute: async (input) => ... })`
3. Add a label/icon entry in `web/src/components/ToolCallCard.tsx` `TOOL_LABELS`
4. The tool will automatically be available to the model — no other wiring needed
