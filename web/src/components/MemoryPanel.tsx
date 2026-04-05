import type { Memory } from "../models/memory";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Layout";
import { CloseIcon } from "./ui/Icons";

export type MemoryPanelProps = {
  open: boolean;
  onClose: () => void;
  memories: Memory[];
  loading: boolean;
  error: string | null;
  onDeleteMemory: (id: string) => void;
};

export function MemoryPanel({
  open,
  onClose,
  memories,
  loading,
  error,
  onDeleteMemory,
}: MemoryPanelProps) {
  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        class={`fixed inset-0 z-20 transition-opacity duration-200 ${
          open ? "bg-black/40 pointer-events-auto" : "bg-black/0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        class={`fixed right-0 z-30 h-full w-72 shrink-0 bg-neutral-900 border-l border-neutral-800 flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Memory"
        aria-hidden={!open}
      >
        {/* Header */}
        <div class="h-12 shrink-0 flex items-center justify-between px-3 border-b border-neutral-800">
          <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">Memory</span>
          <Button variant="icon" onClick={onClose} title="Close memory panel">
            <CloseIcon size={16} />
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div class="px-3 py-2 text-xs text-red-400 bg-red-950/50 border-b border-neutral-800">
            {error}
          </div>
        )}

        {/* List */}
        <div class="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div class="space-y-2 px-3 py-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} class="h-14" />
              ))}
            </div>
          ) : memories.length === 0 ? (
            <MemoryEmptyState />
          ) : (
            <div class="space-y-1 px-1 py-1">
              {memories.map((m) => (
                <MemoryCard key={m.id} memory={m} onDelete={() => onDeleteMemory(m.id)} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function MemoryEmptyState() {
  return (
    <div class="flex flex-col items-center justify-center px-4 py-8 text-center">
      <div class="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-3">
        <span class="text-lg">&#x1f9e0;</span>
      </div>
      <p class="text-xs text-neutral-400 leading-relaxed">
        Nothing here yet. le chien will automatically remember noteworthy things from your
        conversations.
      </p>
    </div>
  );
}

function MemoryCard({ memory, onDelete }: { memory: Memory; onDelete: () => void }) {
  const date = new Date(memory.updated_at * 1000);
  const timeAgo = formatTimeAgo(date);

  return (
    <div class="group mx-1 px-2.5 py-2 rounded-lg hover:bg-neutral-800/50 transition-colors">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-white truncate">{memory.key}</p>
          <p class="text-xs text-neutral-400 mt-0.5 line-clamp-2 leading-relaxed">{memory.value}</p>
        </div>
        <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onDelete}
            class="p-1 rounded text-neutral-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <CloseIcon size={12} />
          </button>
        </div>
      </div>
      <p class="text-[10px] text-neutral-500 mt-1">{timeAgo}</p>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}
