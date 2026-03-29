import type { Conversation } from "../models/chat";
import { Button } from "./ui/Button";
import { PlusIcon, CloseIcon } from "./ui/Icons";

export type SidebarProps = {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

export function Sidebar({ open, onClose, conversations, activeId, onSelect, onNew, onDelete }: SidebarProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div class="fixed inset-0 bg-black/40 z-20 sm:hidden" onClick={onClose} />

      {/* Panel */}
      <div class="fixed sm:relative z-30 h-full w-64 shrink-0 bg-neutral-900 border-r border-neutral-800/60 flex flex-col">
        {/* Header */}
        <div class="h-12 shrink-0 flex items-center justify-between px-3 border-b border-neutral-800/60">
          <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">Conversations</span>
          <Button variant="icon" onClick={onNew} title="New chat">
            <PlusIcon size={16} />
          </Button>
        </div>

        {/* List */}
        <div class="flex-1 overflow-y-auto py-1">
          {conversations.length === 0 ? (
            <p class="text-xs text-neutral-600 px-3 py-4 text-center">No conversations yet</p>
          ) : (
            conversations.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                onSelect={() => onSelect(c.id)}
                onDelete={() => onDelete(c.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function ConversationItem({
  conversation,
  active,
  onSelect,
  onDelete,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      class={`group flex items-center gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-all ${
        active
          ? "bg-neutral-800 text-white"
          : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
      }`}
      onClick={onSelect}
    >
      <span class="flex-1 text-xs truncate">{conversation.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        class="shrink-0 p-0.5 rounded text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        title="Delete"
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}
