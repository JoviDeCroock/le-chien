import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { useModel } from "@preact/signals";
import { AuthModel } from "../../models/auth";
import { ChatModel } from "../../models/chat";
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

export function Chat() {
  const auth = useModel(AuthModel);
  const chat = useModel(ChatModel);
  const memory = useModel(MemoryModel);
  const tamagotchi = useModel(TamagotchiModel);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const modelBarRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sidebarOpen = useSignal(false);
  const shortcutsOpen = useSignal(false);
  const petPopoverOpen = useSignal(false);

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

        if (petPopoverOpen.value) {
          petPopoverOpen.value = false;
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
        return;
      }

      if (key === "p" && event.shiftKey) {
        petPopoverOpen.value = !petPopoverOpen.value;
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chat]);

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
            if (sidebarOpen.value) sidebarOpen.value = false;
            if (memory.panelOpen.value) memory.panelOpen.value = false;
            if (petPopoverOpen.value) petPopoverOpen.value = false;
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
                      sidebarOpen.value = !sidebarOpen.value;
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
                      chat.clear();
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
                        petPopoverOpen.value = !petPopoverOpen.value;
                      }}
                      class={`p-1 rounded transition-colors ${
                        tamagotchi.mood.value === "neglected" || tamagotchi.mood.value === "sad"
                          ? "text-red-400 hover:text-red-300"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                      title={`Pet: ${tamagotchi.pet.value.name} (${tamagotchi.mood.value})`}
                      aria-expanded={petPopoverOpen.value}
                    >
                      <DogIcon size={14} />
                    </button>
                    {petPopoverOpen.value && (
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
                    )}
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
                    shortcutsOpen.value = true;
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
