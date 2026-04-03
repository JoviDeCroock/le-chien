import { useEffect, useRef } from "preact/hooks";
import { useLocation } from "preact-iso";
import { useSignal } from "@preact/signals";
import { useModel } from "@preact/signals";
import { AuthModel } from "../../models/auth";
import { ChatModel } from "../../models/chat";
import { MemoryModel } from "../../models/memory";
import { PageShell, ContentContainer, PageLoader } from "../../components/ui/Layout";
import { MenuIcon, PlusIcon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Button";
import { StatusDot } from "../../components/ui/StatusDot";
import { TextLink } from "../../components/ui/TextLink";
import { TopBar } from "../../components/TopBar";
import { ModelSelector } from "../../components/ModelSelector";
import { Sidebar } from "../../components/Sidebar";
import { ShortcutOverlay } from "../../components/ShortcutOverlay";
import { ChatBubble } from "../../components/ChatBubble";
import { ChatInput } from "../../components/ChatInput";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { UpgradeBanner } from "../../components/UpgradeBanner";
import { MemoryPanel } from "../../components/MemoryPanel";

export function Chat() {
  const { route } = useLocation();
  const auth = useModel(AuthModel);
  const chat = useModel(ChatModel);
  const memory = useModel(MemoryModel);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const modelBarRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sidebarOpen = useSignal(false);
  const shortcutsOpen = useSignal(false);

  useEffect(() => {
    auth.checkSession();
    chat.fetchModels();
  }, []);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!auth.loading.value && !auth.authenticated.value) {
      route("/auth");
    }
  }, [auth.loading.value, auth.authenticated.value]);

  useEffect(() => {
    if (auth.authenticated.value) {
      chat.connect().then(() => memory.loadMemories());
    }
    return () => chat.disconnect();
  }, [auth.authenticated.value]);

  // Refresh memory list when streaming ends (AI may have saved a memory via tool)
  useEffect(() => {
    if (!chat.streaming.value && auth.authenticated.value) {
      memory.loadMemories();
    }
  }, [chat.streaming.value]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages.value.length, chat.messages.value[chat.messages.value.length - 1]?.content]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      );
    }

    function toggleSidebar(nextOpen?: boolean) {
      sidebarOpen.value = nextOpen ?? !sidebarOpen.value;
    }

    function focusModelSelector() {
      const activeButton =
        modelBarRef.current?.querySelector<HTMLButtonElement>("[aria-checked='true']");
      activeButton?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const hasCommandModifier = event.metaKey || event.ctrlKey;
      const editable = isEditableTarget(event.target);

      if (event.key === "Escape") {
        if (shortcutsOpen.value) {
          shortcutsOpen.value = false;
          event.preventDefault();
          return;
        }

        if (sidebarOpen.value) {
          toggleSidebar(false);
          event.preventDefault();
        }

        if (memory.panelOpen.value) {
          memory.panelOpen.value = false;
          event.preventDefault();
        }

        return;
      }

      if (!hasCommandModifier && editable) {
        return;
      }

      if (!hasCommandModifier && !event.altKey && event.key === "?") {
        shortcutsOpen.value = true;
        event.preventDefault();
        return;
      }

      if (!hasCommandModifier) return;

      if (key === "n" && !event.shiftKey) {
        chat.clear();
        composerRef.current?.focus();
        event.preventDefault();
        return;
      }

      if (event.key === "/" && !event.shiftKey) {
        focusModelSelector();
        event.preventDefault();
        return;
      }

      if (key === "s" && event.shiftKey) {
        toggleSidebar();
        event.preventDefault();
        return;
      }

      if (key === "m" && event.shiftKey) {
        memory.togglePanel();
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chat]);

  if (auth.loading.value || !auth.authenticated.value) {
    return <PageLoader />;
  }

  const hasMessages = chat.messages.value.length > 0;
  const limitBannerMessage =
    chat.subscription.value?.plan === "free" &&
    chat.subscription.value.limits.dailyMessages !== null &&
    chat.subscription.value.usage.limitReached
      ? `You've used your ${chat.subscription.value.limits.dailyMessages} free messages for today. Upgrade to Pro for unlimited.`
      : null;
  const composerDisabled = chat.inputLocked.value;
  const composerPlaceholder = chat.inputLocked.value
    ? "Free limit reached for today. Upgrade or come back tomorrow."
    : "Send a message...";

  return (
    <PageShell>
      <ShortcutOverlay open={shortcutsOpen.value} onClose={() => (shortcutsOpen.value = false)} />

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

      <div class="flex-1 flex overflow-hidden">
        <div
          class="flex-1 flex flex-col overflow-hidden"
          onClick={() => {
            if (sidebarOpen.value) sidebarOpen.value = false;
            if (memory.panelOpen.value) memory.panelOpen.value = false;
          }}
        >
          <TopBar
            left={
              <>
                <Button
                  variant="icon"
                  onClick={() => (sidebarOpen.value = !sidebarOpen.value)}
                  title="Toggle sidebar (Cmd/Ctrl+Shift+S)"
                >
                  <MenuIcon size={16} />
                </Button>
                <span class="text-sm font-semibold text-white shrink-0 tracking-tight">
                  le chien
                </span>
                {hasMessages && (
                  <Button variant="icon" onClick={chat.clear} title="New chat (Cmd/Ctrl+N)">
                    <PlusIcon size={14} />
                  </Button>
                )}
              </>
            }
            right={
              <>
                <StatusDot
                  active={chat.connected.value}
                  title={chat.connected.value ? "Connected" : "Disconnected"}
                />
                <TextLink onClick={() => memory.togglePanel()}>Memory</TextLink>
                <TextLink onClick={() => (shortcutsOpen.value = true)}>Shortcuts</TextLink>
                <TextLink onClick={() => auth.signOut()}>Sign out</TextLink>
              </>
            }
          />

          <ModelSelector
            models={chat.models.value}
            selected={chat.selectedModel.value}
            onSelect={(id) => (chat.selectedModel.value = id)}
            disabled={chat.streaming.value}
            barRef={modelBarRef}
          />

          {/* Messages */}
          <div class="flex-1 overflow-y-auto">
            {!hasMessages ? (
              <EmptyState />
            ) : (
              <ContentContainer class="py-6 space-y-1">
                {chat.messages.value.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} streaming={chat.streaming.value} />
                ))}
                <div ref={messagesEnd} />
              </ContentContainer>
            )}
          </div>

          {chat.error.value && <ErrorBanner message={chat.error.value} />}

          {limitBannerMessage && (
            <UpgradeBanner
              message={limitBannerMessage}
              onUpgrade={() => chat.startCheckout()}
              loading={chat.checkoutPending.value}
            />
          )}

          <ChatInput
            value={chat.input.value}
            onInput={(v) => (chat.input.value = v)}
            onSend={() => chat.send()}
            onStop={() => chat.stop()}
            canSend={chat.canSend.value}
            streaming={chat.streaming.value}
            disabled={composerDisabled}
            placeholder={composerPlaceholder}
            textareaRef={composerRef}
          />
        </div>

        <MemoryPanel
          open={memory.panelOpen.value}
          onClose={() => (memory.panelOpen.value = false)}
          memories={memory.memories.value}
          loading={memory.loading.value}
          error={memory.error.value}
          adding={memory.adding.value}
          addKey={memory.addKey.value}
          addValue={memory.addValue.value}
          onAddKeyChange={(v) => (memory.addKey.value = v)}
          onAddValueChange={(v) => (memory.addValue.value = v)}
          onStartAdding={() => memory.startAdding()}
          onCancelAdding={() => memory.cancelAdding()}
          onCreateMemory={() => memory.createMemory()}
          editingId={memory.editingId.value}
          editKey={memory.editKey.value}
          editValue={memory.editValue.value}
          onEditKeyChange={(v) => (memory.editKey.value = v)}
          onEditValueChange={(v) => (memory.editValue.value = v)}
          onStartEditing={(m) => memory.startEditing(m)}
          onCancelEditing={() => memory.cancelEditing()}
          onSaveEdit={() => memory.saveEdit()}
          onDeleteMemory={(id) => memory.deleteMemory(id)}
        />
      </div>
    </PageShell>
  );
}
