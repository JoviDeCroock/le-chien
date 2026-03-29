import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { useModel } from "@preact/signals";
import { AuthModel } from "../../models/auth";
import { ChatModel } from "../../models/chat";
import type { Message, Conversation } from "../../models/chat";

export function Chat() {
  const auth = useModel(AuthModel);
  const chat = useModel(ChatModel);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelBarRef = useRef<HTMLDivElement>(null);
  const modelBarScrollable = useSignal(false);
  const sidebarOpen = useSignal(false);

  useEffect(() => {
    auth.checkSession();
    chat.fetchModels();
  }, []);

  // Connect agent when authenticated
  useEffect(() => {
    if (auth.authenticated.value) {
      chat.connect();
    }
    return () => chat.disconnect();
  }, [auth.authenticated.value]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages.value.length, chat.messages.value[chat.messages.value.length - 1]?.content]);

  // Auto-resize textarea
  function handleTextareaInput(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    chat.input.value = el.value;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 168) + "px";
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (chat.canSend.value) {
        chat.send();
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }
    }
  }

  function handleSend() {
    chat.send();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  // Check model bar overflow
  useEffect(() => {
    const el = modelBarRef.current;
    if (!el) return;
    modelBarScrollable.value = el.scrollWidth > el.clientWidth;
  }, [chat.models.value]);

  if (auth.loading.value) {
    return (
      <div class="h-screen bg-neutral-950 flex items-center justify-center">
        <div class="flex items-center gap-3">
          <div class="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          <span class="text-neutral-500 text-sm tracking-wide">Loading</span>
        </div>
      </div>
    );
  }

  const hasMessages = chat.messages.value.length > 0;

  return (
    <div class="h-screen bg-neutral-950 flex overflow-hidden">
      {/* ── Sidebar ── */}
      <Sidebar
        open={sidebarOpen.value}
        onClose={() => (sidebarOpen.value = false)}
        conversations={chat.conversations.value}
        activeId={chat.activeConversationId.value}
        onSelect={(id) => {
          chat.selectConversation(id);
          sidebarOpen.value = false;
        }}
        onNew={() => {
          chat.clear();
          sidebarOpen.value = false;
        }}
        onDelete={(id) => chat.deleteConversation(id)}
      />

      {/* ── Main chat area ── */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* ── Top bar ── */}
        <div class="shrink-0 border-b border-neutral-800/60 bg-neutral-950">
          <div class="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              {/* Sidebar toggle */}
              {auth.authenticated.value && (
                <button
                  onClick={() => (sidebarOpen.value = !sidebarOpen.value)}
                  class="shrink-0 p-1 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
                  title="Toggle sidebar"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}

              <span class="text-sm font-semibold text-white shrink-0 tracking-tight">le chien</span>

              {/* New chat button */}
              {hasMessages && (
                <button
                  onClick={chat.clear}
                  class="shrink-0 p-1 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
                  title="New chat"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>

            <div class="flex items-center gap-3">
              {/* Connection indicator */}
              {auth.authenticated.value && (
                <div class={`w-1.5 h-1.5 rounded-full ${chat.connected.value ? "bg-green-500" : "bg-neutral-600"}`} title={chat.connected.value ? "Connected" : "Disconnected"} />
              )}

              {auth.authenticated.value ? (
                <button
                  onClick={() => { auth.signOut(); }}
                  class="text-xs text-neutral-500 hover:text-white transition-colors"
                >
                  Sign out
                </button>
              ) : (
                <a href="/auth" class="text-xs text-neutral-500 hover:text-white transition-colors">
                  Sign in
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── Model selector bar ── */}
        <div class="shrink-0 border-b border-neutral-800/40 bg-neutral-950/80">
          <div class="max-w-3xl mx-auto px-4 py-2">
            <div
              ref={modelBarRef}
              class="flex items-center gap-1.5 overflow-x-auto"
              style="scrollbar-width: none; -ms-overflow-style: none;"
            >
              {chat.models.value.map((m) => {
                const selected = chat.selectedModel.value === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => (chat.selectedModel.value = m.id)}
                    disabled={chat.streaming.value}
                    class={`
                      shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${
                        selected
                          ? "bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                          : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800/60"
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    title={m.description}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Messages area ── */}
        <div class="flex-1 overflow-y-auto">
          {!hasMessages ? (
            <EmptyState />
          ) : (
            <div class="max-w-3xl mx-auto px-4 py-6 space-y-1">
              {chat.messages.value.map((msg) => (
                <ChatBubble key={msg.id} message={msg} streaming={chat.streaming.value} />
              ))}
              <div ref={messagesEnd} />
            </div>
          )}
        </div>

        {/* ── Error banner ── */}
        {chat.error.value && (
          <div class="shrink-0 bg-red-950/40 border-t border-red-900/30">
            <div class="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-2">
              <svg class="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span class="text-red-300 text-xs">{chat.error.value}</span>
            </div>
          </div>
        )}

        {/* ── Input area ── */}
        <div class="shrink-0 border-t border-neutral-800/60 bg-neutral-950">
          <div class="max-w-3xl mx-auto px-4 py-3">
            <div class="flex items-end gap-2 bg-neutral-900 rounded-xl border border-neutral-800/80 focus-within:border-neutral-700 transition-colors px-3 py-2">
              <textarea
                ref={textareaRef}
                value={chat.input.value}
                onInput={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                rows={1}
                class="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 resize-none outline-none leading-relaxed py-1"
                style="max-height: 168px;"
                disabled={!auth.authenticated.value}
              />
              {chat.streaming.value ? (
                <button
                  onClick={chat.stop}
                  class="shrink-0 p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-all"
                  title="Stop generating"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!chat.canSend.value}
                  class="shrink-0 p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-violet-600"
                  title="Send message"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              )}
            </div>
            <p class="text-center text-[10px] text-neutral-600 mt-2 select-none">
              Responses generated by AI. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

function Sidebar({ open, onClose, conversations, activeId, onSelect, onNew, onDelete }: SidebarProps) {
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
          <button
            onClick={onNew}
            class="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
            title="New chat"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div class="flex-1 overflow-y-auto py-1">
          {conversations.length === 0 ? (
            <p class="text-xs text-neutral-600 px-3 py-4 text-center">No conversations yet</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                class={`group flex items-center gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-all ${
                  c.id === activeId
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                }`}
                onClick={() => onSelect(c.id)}
              >
                <span class="flex-1 text-xs truncate">{c.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  class="shrink-0 p-0.5 rounded text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete"
                >
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div class="h-full flex flex-col items-center justify-center px-6 select-none">
      {/* Soft glow behind the logo */}
      <div class="relative mb-8">
        <div class="absolute inset-0 blur-3xl bg-violet-600/10 rounded-full scale-150" />
        <div class="relative w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
          <span class="text-2xl">&#x1f436;</span>
        </div>
      </div>
      <h2 class="text-xl font-semibold text-white mb-2 tracking-tight">le chien</h2>
      <p class="text-sm text-neutral-500 max-w-xs text-center leading-relaxed">
        Pick a model above and start chatting. All models run on Cloudflare Workers AI.
      </p>
    </div>
  );
}

// ── Chat bubble ─────────────────────────────────────────────────────────────

function ChatBubble({ message, streaming }: { message: Message; streaming: boolean }) {
  const isUser = message.role === "user";
  const isStreaming = streaming && !isUser && !message.content;
  const isActiveAssistant = streaming && !isUser && message.content !== "";

  return (
    <div class={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
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
        {isStreaming ? (
          <StreamingDots />
        ) : (
          <div class="whitespace-pre-wrap break-words">{message.content}</div>
        )}
        {isActiveAssistant && (
          <span class="inline-block w-1.5 h-4 bg-violet-500 rounded-sm ml-0.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  );
}

// ── Streaming indicator ─────────────────────────────────────────────────────

function StreamingDots() {
  return (
    <div class="flex items-center gap-1 py-1 px-1">
      <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-[pulse_1.4s_ease-in-out_infinite]" />
      <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
      <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
    </div>
  );
}
