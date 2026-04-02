import { Markdown } from "preact-md/lite";
import type { Message, Attachment } from "../models/chat";
import { StreamingDots } from "./ui/Layout";
import { ToolCallCard } from "./ToolCallCard";
import { FileIcon } from "./ui/Icons";

function isImageType(type: string) {
  return type.startsWith("image/");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentBadge({ attachment }: { attachment: Attachment }) {
  return (
    <div class="flex items-center gap-1.5 bg-neutral-900/60 border border-neutral-700/30 rounded-lg px-2 py-1 text-xs text-neutral-400">
      {isImageType(attachment.type) ? (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" class="shrink-0">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" />
          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="2" />
          <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" />
        </svg>
      ) : (
        <FileIcon size={12} class="shrink-0" />
      )}
      <span class="truncate max-w-[140px]">{attachment.name}</span>
      <span class="text-neutral-500">{formatFileSize(attachment.size)}</span>
    </div>
  );
}

export function ChatBubble({ message, streaming }: { message: Message; streaming: boolean }) {
  const isUser = message.role === "user";
  const isStreaming = streaming && !isUser && !message.content;
  const isActiveAssistant = streaming && !isUser && message.content !== "";
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
  const hasAttachments = message.attachments && message.attachments.length > 0;

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
        {hasAttachments && (
          <div class="flex flex-wrap gap-1.5 mb-2">
            {message.attachments!.map((att) => (
              <AttachmentBadge key={att.key} attachment={att} />
            ))}
          </div>
        )}
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
          message.content &&
          (isUser ? (
            <div class="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <Markdown className="markdown-body">{message.content}</Markdown>
          ))
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
