import { useSignal } from "@preact/signals";
import type { ToolCall } from "../models/chat";

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  get_current_datetime: { label: "Date & Time", icon: "clock" },
  calculate: { label: "Calculate", icon: "calculator" },
  read_url: { label: "Read URL", icon: "globe" },
  generate_image: { label: "Generate Image", icon: "image" },
  run_javascript: { label: "Run Code", icon: "code" },
  web_search: { label: "Web Search", icon: "search" },
};

function ToolIcon({ type }: { type: string }) {
  const s = {
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round" as const,
    "stroke-linejoin": "round" as const,
    fill: "none",
  };

  return (
    <svg width={14} height={14} viewBox="0 0 24 24" class="shrink-0">
      {type === "clock" && (
        <>
          <circle cx="12" cy="12" r="10" {...s} />
          <path d="M12 6v6l4 2" {...s} />
        </>
      )}
      {type === "calculator" && (
        <>
          <rect x="4" y="2" width="16" height="20" rx="2" {...s} />
          <path d="M8 6h8M8 14h2M14 14h2M8 18h2M14 18h2M8 10h8" {...s} />
        </>
      )}
      {type === "globe" && (
        <>
          <circle cx="12" cy="12" r="10" {...s} />
          <path
            d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
            {...s}
          />
        </>
      )}
      {type === "image" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" {...s} />
          <circle cx="8.5" cy="8.5" r="1.5" {...s} />
          <path d="M21 15l-5-5L5 21" {...s} />
        </>
      )}
      {type === "code" && (
        <>
          <polyline points="16 18 22 12 16 6" {...s} />
          <polyline points="8 6 2 12 8 18" {...s} />
        </>
      )}
      {type === "search" && (
        <>
          <circle cx="11" cy="11" r="8" {...s} />
          <path d="M21 21l-4.35-4.35" {...s} />
        </>
      )}
    </svg>
  );
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  if (entries.length === 1) return String(entries[0][1]);
  return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
}

function formatResult(result: unknown): string {
  if (result === null || result === undefined) return "";
  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
}

function formatResultSummary(result: unknown): string {
  if (result === null || result === undefined) return "";
  if (isImageResult(result)) return "";
  const text = typeof result === "string" ? result : JSON.stringify(result);
  return text.length > 120 ? text.slice(0, 120) + "…" : text;
}

function isImageResult(result: unknown): result is { image: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "image" in result &&
    typeof (result as { image: string }).image === "string" &&
    (result as { image: string }).image.startsWith("data:image/")
  );
}

export function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const expanded = useSignal(false);
  const meta = TOOL_LABELS[toolCall.name] ?? { label: toolCall.name, icon: "search" };
  const isPending = toolCall.status === "pending";
  const argsSummary = formatArgs(toolCall.args);
  const resultSummary = !isPending ? formatResultSummary(toolCall.result) : "";

  return (
    <div class="my-2 rounded-lg border border-neutral-700/40 bg-neutral-900/60 overflow-hidden text-xs">
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800/40 transition-colors duration-75"
        onClick={() => (expanded.value = !expanded.value)}
      >
        <span class="text-neutral-400">
          <ToolIcon type={meta.icon} />
        </span>
        <span class="font-medium text-neutral-300">{meta.label}</span>
        {argsSummary && <span class="text-neutral-500 truncate max-w-[200px]">{argsSummary}</span>}
        <span class="ml-auto flex items-center gap-1.5">
          {isPending ? (
            <span class="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          ) : (
            <span class="w-1.5 h-1.5 rounded-full bg-green-400" />
          )}
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            class={`text-neutral-500 transition-transform duration-100 ${expanded.value ? "rotate-180" : ""}`}
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </button>

      {!expanded.value && resultSummary && (
        <div class="px-3 pb-2 -mt-1">
          <pre class="text-neutral-400 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all line-clamp-3">
            {resultSummary}
          </pre>
        </div>
      )}

      {isImageResult(toolCall.result) && (
        <div class="px-3 py-2">
          <img
            src={(toolCall.result as { image: string }).image}
            alt={(toolCall.result as { prompt?: string }).prompt || "Generated image"}
            class="rounded-lg max-w-full"
          />
        </div>
      )}

      {expanded.value && (
        <div class="border-t border-neutral-700/40 px-3 py-2 space-y-2">
          {Object.keys(toolCall.args).length > 0 && (
            <div>
              <span class="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">
                Input
              </span>
              <pre class="mt-1 text-neutral-400 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.result !== undefined && !isImageResult(toolCall.result) && (
            <div>
              <span class="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">
                Result
              </span>
              <pre class="mt-1 text-neutral-400 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                {formatResult(toolCall.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
