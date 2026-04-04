import type { Memory } from "../models/memory";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Skeleton } from "./ui/Layout";
import { CloseIcon, PlusIcon } from "./ui/Icons";

export type MemoryPanelProps = {
  open: boolean;
  onClose: () => void;
  memories: Memory[];
  loading: boolean;
  error: string | null;
  // Add form
  adding: boolean;
  addKey: string;
  addValue: string;
  onAddKeyChange: (v: string) => void;
  onAddValueChange: (v: string) => void;
  onStartAdding: () => void;
  onCancelAdding: () => void;
  onCreateMemory: () => void;
  // Edit form
  editingId: string | null;
  editKey: string;
  editValue: string;
  onEditKeyChange: (v: string) => void;
  onEditValueChange: (v: string) => void;
  onStartEditing: (memory: Memory) => void;
  onCancelEditing: () => void;
  onSaveEdit: () => void;
  onDeleteMemory: (id: string) => void;
};

export function MemoryPanel({
  open,
  onClose,
  memories,
  loading,
  error,
  adding,
  addKey,
  addValue,
  onAddKeyChange,
  onAddValueChange,
  onStartAdding,
  onCancelAdding,
  onCreateMemory,
  editingId,
  editKey,
  editValue,
  onEditKeyChange,
  onEditValueChange,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onDeleteMemory,
}: MemoryPanelProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div class="fixed inset-0 bg-black/40 z-20" onClick={onClose} />

      {/* Panel */}
      <aside
        class="fixed right-0 z-30 h-full w-72 shrink-0 bg-neutral-900 border-l border-neutral-800/60 flex flex-col"
        aria-label="Memory"
      >
        {/* Header */}
        <div class="h-12 shrink-0 flex items-center justify-between px-3 border-b border-neutral-800/60">
          <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">Memory</span>
          <div class="flex items-center gap-1">
            {!adding && (
              <Button variant="icon" onClick={onStartAdding} title="Add memory">
                <PlusIcon size={16} />
              </Button>
            )}
            <Button variant="icon" onClick={onClose} title="Close memory panel">
              <CloseIcon size={16} />
            </Button>
          </div>
        </div>

        {/* Add form */}
        {adding && (
          <div class="px-3 py-3 border-b border-neutral-800/60 space-y-2">
            <Input
              placeholder="Label (e.g. Preferred language)"
              value={addKey}
              onInput={(e) => onAddKeyChange((e.target as HTMLInputElement).value)}
              class="w-full text-xs"
              autoFocus
            />
            <textarea
              placeholder="Value (e.g. TypeScript)"
              value={addValue}
              onInput={(e) => onAddValueChange((e.target as HTMLTextAreaElement).value)}
              class="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-600 resize-none"
              rows={2}
            />
            <div class="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={onCreateMemory}
                disabled={!addKey.trim() || !addValue.trim()}
              >
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancelAdding}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div class="px-3 py-2 text-xs text-red-400 bg-red-950/50 border-b border-neutral-800/60">
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
            <MemoryEmptyState onAdd={onStartAdding} />
          ) : (
            <div class="space-y-1 px-1 py-1">
              {memories.map((m) => (
                <MemoryCard
                  key={m.id}
                  memory={m}
                  editing={editingId === m.id}
                  editKey={editKey}
                  editValue={editValue}
                  onEditKeyChange={onEditKeyChange}
                  onEditValueChange={onEditValueChange}
                  onStartEditing={() => onStartEditing(m)}
                  onCancelEditing={onCancelEditing}
                  onSaveEdit={onSaveEdit}
                  onDelete={() => onDeleteMemory(m.id)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function MemoryEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div class="flex flex-col items-center justify-center px-4 py-8 text-center">
      <div class="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-3">
        <span class="text-lg">&#x1f9e0;</span>
      </div>
      <p class="text-xs text-neutral-400 leading-relaxed mb-3">
        Nothing here yet. Add things you want le chien to remember between conversations.
      </p>
      <Button variant="secondary" size="sm" onClick={onAdd}>
        Add memory
      </Button>
    </div>
  );
}

function MemoryCard({
  memory,
  editing,
  editKey,
  editValue,
  onEditKeyChange,
  onEditValueChange,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onDelete,
}: {
  memory: Memory;
  editing: boolean;
  editKey: string;
  editValue: string;
  onEditKeyChange: (v: string) => void;
  onEditValueChange: (v: string) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}) {
  if (editing) {
    return (
      <div class="mx-1 p-2.5 rounded-lg bg-neutral-800 border border-violet-600/40 space-y-2">
        <Input
          value={editKey}
          onInput={(e) => onEditKeyChange((e.target as HTMLInputElement).value)}
          class="w-full text-xs"
          autoFocus
        />
        <textarea
          value={editValue}
          onInput={(e) => onEditValueChange((e.target as HTMLTextAreaElement).value)}
          class="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-600 resize-none"
          rows={2}
        />
        <div class="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onSaveEdit}
            disabled={!editKey.trim() || !editValue.trim()}
          >
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelEditing}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

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
            onClick={onStartEditing}
            class="p-1 rounded text-neutral-400 hover:text-white transition-colors"
            title="Edit"
          >
            <EditIcon size={12} />
          </button>
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

function EditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
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
