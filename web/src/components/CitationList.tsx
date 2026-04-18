import type { MessageSource } from "../models/chat";
import { FileIcon } from "./ui/Icons";

export function CitationList({ sources }: { sources: MessageSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div class="mt-3 pt-2 border-t border-neutral-700/40 space-y-1.5">
      <p class="text-[10px] font-medium uppercase tracking-wider text-neutral-500">Sources</p>
      {sources.map((src, i) => (
        <details key={src.id} class="group">
          <summary class="cursor-pointer flex items-start gap-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors list-none">
            <span class="shrink-0 font-mono text-[11px] text-neutral-500 w-4 text-right pt-0.5">
              {i + 1}
            </span>
            <span class="shrink-0 text-neutral-500 mt-0.5">
              <FileIcon size={12} />
            </span>
            <span class="min-w-0 flex-1 truncate">{src.filename}</span>
          </summary>
          <p class="mt-1 ml-6 pl-2 border-l border-neutral-700/60 text-[11px] text-neutral-500 leading-relaxed">
            {src.snippet}
          </p>
        </details>
      ))}
    </div>
  );
}
