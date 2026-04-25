import { useEffect } from "preact/hooks";
import { useModel } from "@preact/signals";
import { Show } from "@preact/signals/utils";
import { Markdown } from "preact-md/lite";
import type { Message } from "../models/chat";
import { StreamingDots } from "./ui/Layout";
import { ToolCallCard } from "./ToolCallCard";
import { SandboxedArtifact } from "./SandboxedArtifact";
import { parseArtifacts } from "../lib/parse-artifacts";
import { ReadAloudModel } from "../models/read-aloud";

export function ChatBubble({ message, streaming }: { message: Message; streaming: boolean }) {
  const isUser = message.role === "user";
  const isStreaming = streaming && !isUser && !message.content;
  const isActiveAssistant = streaming && !isUser && message.content !== "";
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
  const hasReasoning = !!message.reasoning;
  const isStreamingReasoning = streaming && hasReasoning && !message.content;

  const segments = !isUser && message.content ? parseArtifacts(message.content) : [];
  const readableText = segments
    .filter((s) => s.kind === "markdown")
    .map((s) => s.text)
    .join("\n")
    .trim();
  const canReadAloud = !isUser && !streaming && readableText.length > 0;

  const readAloud = useModel(ReadAloudModel);

  useEffect(() => () => readAloud.dispose(), [readAloud]);

  const audioStatus = readAloud.status.value;
  const audioBusy = audioStatus === "loading";
  const audioPlaying = audioStatus === "playing";

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
        {hasReasoning && (
          <details class="mb-2" open={isStreamingReasoning}>
            <summary class="cursor-pointer text-xs text-neutral-500 hover:text-neutral-400 select-none flex items-center gap-1">
              {isStreamingReasoning && (
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              )}
              Thinking
            </summary>
            <div class="mt-1 pl-3 border-l-2 border-neutral-700/40 text-xs text-neutral-500 leading-relaxed">
              <Markdown className="markdown-body">{message.reasoning!}</Markdown>
            </div>
          </details>
        )}
        {hasToolCalls && (
          <div class="mb-1">
            {message.tool_calls!.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
        {isStreaming && !hasToolCalls && !hasReasoning ? (
          <StreamingDots />
        ) : isUser ? (
          message.content && <div class="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          segments.map((seg, i) => {
            if (seg.kind === "markdown") {
              if (!seg.text.trim()) return null;
              return (
                <Markdown key={`md-${i}`} className="markdown-body">
                  {seg.text}
                </Markdown>
              );
            }
            if (!seg.complete) {
              return (
                <div
                  key={`art-${seg.index}-loading`}
                  class="my-3 rounded-lg border border-neutral-700/40 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-500 flex items-center gap-2"
                >
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                  Compiling artifact…
                </div>
              );
            }
            return (
              <SandboxedArtifact
                key={`art-${message.id}-${seg.index}`}
                id={`${message.id}-${seg.index}`}
                code={seg.code}
              />
            );
          })
        )}
        {isActiveAssistant && (
          <span class="inline-block w-1.5 h-4 bg-violet-500 rounded-sm ml-0.5 animate-pulse align-text-bottom" />
        )}
        {isStreaming && hasToolCalls && <StreamingDots />}
        {canReadAloud && (
          <div class="mt-2 pt-2 border-t border-neutral-700/30 flex items-center gap-2">
            <button
              type="button"
              onClick={() => readAloud.play(readableText)}
              disabled={audioBusy}
              class={`
                inline-flex items-center gap-1.5 text-[11px] tracking-wide
                ${audioPlaying ? "text-violet-400" : "text-neutral-500 hover:text-neutral-300"}
                disabled:opacity-50 disabled:cursor-wait transition-colors
              `}
              title={audioPlaying ? "Stop reading" : "Read aloud"}
              aria-label={audioPlaying ? "Stop reading" : "Read aloud"}
            >
              <SpeakerIcon playing={audioPlaying} loading={audioBusy} />
              <span>{audioPlaying ? "Stop" : audioBusy ? "Loading" : "Read aloud"}</span>
            </button>
            <Show when={readAloud.errorMessage}>
              <span class="text-[11px] text-red-400">{readAloud.errorMessage.value}</span>
            </Show>
          </div>
        )}
      </div>
    </div>
  );
}

function SpeakerIcon({ playing, loading }: { playing: boolean; loading: boolean }) {
  if (loading) {
    return <span class="inline-block w-3 h-3 rounded-full bg-violet-500 animate-pulse" />;
  }
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      {playing && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
      {playing && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
    </svg>
  );
}
