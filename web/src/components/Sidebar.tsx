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

export function Sidebar({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div class="fixed inset-0 bg-black/40 z-20" onClick={onClose} />

      {/* Panel */}
      <nav
        class="fixed z-30 h-full w-64 shrink-0 bg-neutral-900 border-r border-neutral-800/60 flex flex-col"
        aria-label="Conversations"
      >
        {/* Header */}
        <div class="h-12 shrink-0 flex items-center justify-between px-3 border-b border-neutral-800/60">
          <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Conversations
          </span>
          <Button variant="icon" onClick={onNew} title="New chat (Cmd/Ctrl+N)">
            <PlusIcon size={16} />
          </Button>
        </div>

        {/* List */}
        <div class="flex-1 overflow-y-auto py-1" data-sidebar-list="true">
          {conversations.length === 0 ? (
            <p class="text-xs text-neutral-400 px-3 py-4 text-center">No conversations yet</p>
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
      </nav>
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
  function moveFocus(event: KeyboardEvent) {
    let direction = 0;

    if (event.key === "ArrowDown") {
      direction = 1;
    } else if (event.key === "ArrowUp") {
      direction = -1;
    } else if (event.key === "Home") {
      direction = Number.NEGATIVE_INFINITY;
    } else if (event.key === "End") {
      direction = Number.POSITIVE_INFINITY;
    } else {
      return;
    }

    const currentButton = event.currentTarget as HTMLButtonElement | null;
    const list = currentButton?.closest("[data-sidebar-list='true']");
    const items = Array.from(
      list?.querySelectorAll<HTMLButtonElement>("[data-conversation-button='true']") ?? [],
    );
    const currentIndex = currentButton ? items.indexOf(currentButton) : -1;

    if (currentIndex === -1 || items.length === 0) return;

    event.preventDefault();

    if (direction === Number.NEGATIVE_INFINITY) {
      items[0]?.focus();
      return;
    }

    if (direction === Number.POSITIVE_INFINITY) {
      items[items.length - 1]?.focus();
      return;
    }

    const nextIndex = (currentIndex + direction + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  return (
    <div
      class={`group flex items-center gap-2 px-1 py-0.5 mx-1 rounded-lg transition-all ${
        active ? "bg-neutral-800" : "hover:bg-neutral-800/50"
      }`}
    >
      <button
        type="button"
        class={`flex-1 px-2 py-2 text-left text-xs truncate rounded-lg transition-colors ${
          active ? "text-white" : "text-neutral-400 hover:text-neutral-200"
        }`}
        onClick={onSelect}
        onKeyDown={moveFocus}
        data-conversation-button="true"
        aria-current={active ? "page" : undefined}
      >
        {conversation.title}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        class="shrink-0 p-0.5 rounded text-neutral-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        title="Delete"
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}
