import type { Message } from "../models/chat";
import { StreamingDots } from "./ui/Layout";
import { ToolCallCard } from "./ToolCallCard";

export function ChatBubble({ message, streaming }: { message: Message; streaming: boolean }) {
  const isUser = message.role === "user";
  const isStreaming = streaming && !isUser && !message.content;
  const isActiveAssistant = streaming && !isUser && message.content !== "";
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;

  return (
    <div class={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 animate-fade-in`}>
      <div
        class={`
          max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${
            isUser
              ? "bg-violet-900/25 border border-violet-800/20 text-neutral-200"
              : "bg-neutral-800/60 border border-neutral-700/20 text-neutral-300"
          }
        `}
      >
        {hasToolCalls && (
          <div class="mb-1">
            {message.tool_calls!.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
        {isStreaming && !hasToolCalls ? (
          <StreamingDots />
        ) : (
          message.content && <div class="whitespace-pre-wrap break-words">{message.content}</div>
        )}
        {isActiveAssistant && (
          <span class="inline-block w-1.5 h-4 bg-violet-500 rounded-sm ml-0.5 animate-pulse align-text-bottom" />
        )}
        {/* Show streaming dots when tools are running but no text yet */}
        {isStreaming && hasToolCalls && <StreamingDots />}
      </div>
    </div>
  );
}
