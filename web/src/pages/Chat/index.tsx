import { useEffect, useRef } from "preact/hooks";
import { useLocation } from "preact-iso";
import { useModel } from "@preact/signals";
import { For, Show } from "@preact/signals/utils";
import { AuthModel } from "../../models/auth";
import { ChatModel } from "../../models/chat";
import { ChatUIModel } from "../../models/chat-ui";
import { MemoryModel } from "../../models/memory";
import { trackEvent } from "../../lib/posthog";
import { TamagotchiModel } from "../../models/tamagotchi";
import { PageShell, ContentContainer, PageLoader } from "../../components/ui/Layout";
import { MenuIcon, PlusIcon, DogIcon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Button";
import { StatusDot } from "../../components/ui/StatusDot";
import { TextLink } from "../../components/ui/TextLink";
import { TopBar } from "../../components/TopBar";
import { ModelSelector } from "../../components/ModelSelector";
import { Sidebar } from "../../components/Sidebar";
import { TamagotchiWidget } from "../../components/TamagotchiWidget";
import { ShortcutOverlay } from "../../components/ShortcutOverlay";
import { ChatBubble } from "../../components/ChatBubble";
import { ChatInput } from "../../components/ChatInput";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { UpgradeBanner } from "../../components/UpgradeBanner";
import { MemoryPanel } from "../../components/MemoryPanel";

export function Chat({ conversationId }: { conversationId?: string }) {
  const auth = useModel(AuthModel);
  const chat = useModel(ChatModel);
  const memory = useModel(MemoryModel);
  const tamagotchi = useModel(TamagotchiModel);
  const ui = useModel(ChatUIModel);
  const { route } = useLocation();
  const messagesEnd = useRef<HTMLDivElement>(null);
  const modelBarRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    auth.checkSession();
    chat.fetchModels();
  }, []);

  useEffect(() => {
    if (auth.authenticated.value) {
      chat.connect().then(() => {
        memory.loadMemories();
        tamagotchi.loadPet();
      });
    }
    return () => chat.disconnect();
  }, [auth.authenticated.value]);

  // Refresh memory list when streaming ends (AI may have saved a memory via tool)
  useEffect(() => {
    if (!chat.streaming.value && auth.authenticated.value) {
      memory.loadMemories();
    }
  }, [chat.streaming.value]);

  // URL → model: apply conversation selection from the route
  useEffect(() => {
    if (!auth.authenticated.value || !chat.connected.value) return;
    const active = chat.activeConversationId.value;
    if (conversationId && conversationId !== active) {
      chat.selectConversation(conversationId);
    } else if (!conversationId && active) {
      chat.clear();
    }
  }, [conversationId, chat.connected.value, auth.authenticated.value]);

  // Model → URL: keep the path in sync when state changes (e.g. after creating a new conversation).
  // Gated on connection so a reload of /chat/:id doesn't strip the id before URL→model has a chance to select it.
  useEffect(() => {
    if (!chat.connected.value) return;
    const active = chat.activeConversationId.value;
    if (active && active !== conversationId) {
      route(`/chat/${active}`, true);
    } else if (!active && conversationId) {
      route("/chat", true);
    }
  }, [chat.activeConversationId.value, conversationId, chat.connected.value]);

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
        if (ui.shortcutsOpen.value) {
          ui.closeShortcuts();
          event.preventDefault();
          return;
        }

        if (ui.sidebarOpen.value) {
          ui.closeSidebar();
          event.preventDefault();
        }

        if (memory.panelOpen.value) {
          memory.panelOpen.value = false;
          event.preventDefault();
        }

        if (ui.petPopoverOpen.value) {
          ui.closePetPopover();
          event.preventDefault();
        }

        return;
      }

      if (!hasCommandModifier && editable) {
        return;
      }

      if (!hasCommandModifier && !event.altKey && event.key === "?") {
        ui.openShortcuts();
        event.preventDefault();
        return;
      }

      if (!hasCommandModifier) return;

      if (key === "n" && !event.shiftKey) {
        route("/chat");
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
        ui.toggleSidebar();
        event.preventDefault();
        return;
      }

      if (key === "m" && event.shiftKey) {
        memory.togglePanel();
        event.preventDefault();
        return;
      }

      if (key === "p" && event.shiftKey) {
        ui.togglePetPopover();
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [route]);

  if (auth.loading.value) {
    return <PageLoader />;
  }

  const hasMessages = chat.messages.value.length > 0;
  const sub = chat.subscription.value;
  const limitBannerMessage =
    sub?.plan === "free" && sub.limits.dailyMessages !== null && sub.usage.limitReached
      ? `You've used your ${sub.limits.dailyMessages} free messages for today. Upgrade to Pro for unlimited.`
      : sub?.plan === "free" && sub.usage.premiumLimitReached && chat.selectedModelIsPremium.value
        ? `You've used your ${sub.limits.dailyPremiumMessages} premium model messages for today. Upgrade to Pro for unlimited premium access.`
        : null;
  const composerDisabled = !auth.authenticated.value || chat.inputLocked.value;
  const isPremiumLock =
    chat.inputLocked.value && !sub?.usage.limitReached && sub?.usage.premiumLimitReached;
  const composerPlaceholder = !auth.authenticated.value
    ? "Sign in to start chatting..."
    : isPremiumLock
      ? "Premium model limit reached. Switch models or upgrade to Pro."
      : chat.inputLocked.value
        ? "Free limit reached for today. Upgrade or come back tomorrow."
        : "Send a message...";

  return (
    <PageShell>
      <ShortcutOverlay open={ui.shortcutsOpen.value} onClose={ui.closeShortcuts} />

      <Sidebar
        open={ui.sidebarOpen.value}
        onClose={ui.closeSidebar}
        conversations={chat.conversations.value}
        activeId={chat.activeConversationId.value}
        onSelect={(id) => {
          route(`/chat/${id}`);
          ui.closeSidebar();
        }}
        onNew={() => {
          route("/chat");
          ui.closeSidebar();
        }}
        onDelete={(id) => chat.deleteConversation(id)}
        pet={tamagotchi.pet.value}
        petDisabled={tamagotchi.actionCooldown.value}
        onFeedPet={() => tamagotchi.feed()}
        onPlayPet={() => tamagotchi.play()}
        onPetDog={() => tamagotchi.petDog()}
      />

      <div class="flex-1 flex overflow-hidden">
        <div
          class="flex-1 flex flex-col overflow-hidden"
          onClick={() => {
            if (ui.sidebarOpen.value) ui.closeSidebar();
            if (memory.panelOpen.value) memory.panelOpen.value = false;
            if (ui.petPopoverOpen.value) ui.closePetPopover();
          }}
        >
          <TopBar
            left={
              <>
                {auth.authenticated.value && (
                  <Button
                    variant="icon"
                    onClick={(e: Event) => {
                      e.stopPropagation();
                      ui.toggleSidebar();
                    }}
                    title="Toggle sidebar (Cmd/Ctrl+Shift+S)"
                  >
                    <MenuIcon size={16} />
                  </Button>
                )}
                <span class="text-sm font-semibold text-white shrink-0 tracking-tight">
                  le chien
                </span>
                {hasMessages && (
                  <Button
                    variant="icon"
                    onClick={(e: Event) => {
                      e.stopPropagation();
                      route("/chat");
                    }}
                    title="New chat (Cmd/Ctrl+N)"
                  >
                    <PlusIcon size={14} />
                  </Button>
                )}
              </>
            }
            right={
              <>
                {auth.authenticated.value && (
                  <StatusDot
                    active={chat.connected.value}
                    title={chat.connected.value ? "Connected" : "Disconnected"}
                  />
                )}
                {auth.authenticated.value && tamagotchi.pet.value && (
                  <div class="relative">
                    <button
                      type="button"
                      onClick={(e: Event) => {
                        e.stopPropagation();
                        ui.togglePetPopover();
                      }}
                      class={`p-1 rounded transition-colors ${
                        tamagotchi.mood.value === "neglected" || tamagotchi.mood.value === "sad"
                          ? "text-red-400 hover:text-red-300"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                      title={`Pet: ${tamagotchi.pet.value.name} (${tamagotchi.mood.value})`}
                      aria-expanded={ui.petPopoverOpen.value}
                    >
                      <DogIcon size={14} />
                    </button>
                    <Show when={ui.petPopoverOpen}>
                      <div
                        class="absolute right-0 top-full mt-2 z-40 w-64 bg-neutral-900 border border-neutral-800 rounded-lg"
                        onClick={(e: Event) => e.stopPropagation()}
                      >
                        <TamagotchiWidget
                          pet={tamagotchi.pet.value}
                          onFeed={() => tamagotchi.feed()}
                          onPlay={() => tamagotchi.play()}
                          onPet={() => tamagotchi.petDog()}
                          disabled={tamagotchi.actionCooldown.value}
                        />
                      </div>
                    </Show>
                  </div>
                )}
                {auth.authenticated.value && (
                  <TextLink
                    onClick={(e: Event) => {
                      e.stopPropagation();
                      memory.togglePanel();
                    }}
                  >
                    Memory
                  </TextLink>
                )}
                <TextLink
                  onClick={(e: Event) => {
                    e.stopPropagation();
                    ui.openShortcuts();
                  }}
                >
                  Shortcuts
                </TextLink>
                {auth.authenticated.value && (
                  <>
                    <span class="w-px h-3.5 bg-neutral-800" />
                    <TextLink as="a" href="/billing">
                      Billing
                    </TextLink>
                    <TextLink
                      onClick={(e: Event) => {
                        e.stopPropagation();
                        auth.signOut();
                      }}
                      class="text-neutral-500"
                    >
                      Sign out
                    </TextLink>
                  </>
                )}
                {!auth.authenticated.value && (
                  <TextLink as="a" href="/auth">
                    Sign in
                  </TextLink>
                )}
              </>
            }
          />

          <ModelSelector
            models={chat.models.value}
            selected={chat.selectedModel.value}
            onSelect={(id) => {
              chat.selectedModel.value = id;
              trackEvent("model_selected", { model: id });
            }}
            disabled={chat.streaming.value}
            barRef={modelBarRef}
            premiumLimitReached={chat.premiumLimitReached.value}
          />

          {/* Messages */}
          <div class="flex-1 overflow-y-auto">
            {!hasMessages ? (
              <EmptyState />
            ) : (
              <ContentContainer class="py-6 space-y-1">
                <For each={chat.messages}>
                  {(msg) => (
                    <ChatBubble key={msg.id} message={msg} streaming={chat.streaming.value} />
                  )}
                </For>
                <div ref={messagesEnd} />
              </ContentContainer>
            )}
          </div>

          <Show when={chat.error}>
            <ErrorBanner message={chat.error.value!} />
          </Show>

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
            enabledExtras={chat.enabledExtras.value}
            disabledExtras={[
              ...(sub?.usage.imageGenerationLimitReached ? ["generate_image" as const] : []),
              ...(sub?.usage.webSearchLimitReached ? ["web_search" as const] : []),
            ]}
            onToggleExtra={(id) => {
              const current = chat.enabledExtras.value;
              chat.enabledExtras.value = current.includes(id)
                ? current.filter((t) => t !== id)
                : [...current, id];
            }}
          />
        </div>

        <MemoryPanel
          open={memory.panelOpen.value}
          onClose={() => (memory.panelOpen.value = false)}
          memories={memory.memories.value}
          loading={memory.loading.value}
          error={memory.error.value}
          onDeleteMemory={(id) => memory.deleteMemory(id)}
        />
      </div>
    </PageShell>
  );
}
