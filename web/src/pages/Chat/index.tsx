import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { useModel } from "@preact/signals";
import { AuthModel } from "../../models/auth";
import { ChatModel } from "../../models/chat";
import { PageShell, ContentContainer, PageLoader } from "../../components/ui/Layout";
import { MenuIcon, PlusIcon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Button";
import { StatusDot } from "../../components/ui/StatusDot";
import { TextLink } from "../../components/ui/TextLink";
import { TopBar } from "../../components/TopBar";
import { ModelSelector } from "../../components/ModelSelector";
import { Sidebar } from "../../components/Sidebar";
import { ChatBubble } from "../../components/ChatBubble";
import { ChatInput } from "../../components/ChatInput";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";

export function Chat() {
  const auth = useModel(AuthModel);
  const chat = useModel(ChatModel);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const modelBarRef = useRef<HTMLDivElement>(null);
  const sidebarOpen = useSignal(false);

  useEffect(() => {
    auth.checkSession();
    chat.fetchModels();
  }, []);

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

  if (auth.loading.value) {
    return <PageLoader />;
  }

  const hasMessages = chat.messages.value.length > 0;

  return (
    <PageShell>
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

      <div class="flex-1 flex flex-col overflow-hidden">
        <TopBar
          left={
            <>
              {auth.authenticated.value && (
                <Button
                  variant="icon"
                  onClick={() => (sidebarOpen.value = !sidebarOpen.value)}
                  title="Toggle sidebar"
                >
                  <MenuIcon size={16} />
                </Button>
              )}
              <span class="text-sm font-semibold text-white shrink-0 tracking-tight">le chien</span>
              {hasMessages && (
                <Button variant="icon" onClick={chat.clear} title="New chat">
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
              {auth.authenticated.value ? (
                <TextLink onClick={() => auth.signOut()}>Sign out</TextLink>
              ) : (
                <TextLink as="a" href="/auth">Sign in</TextLink>
              )}
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

        <ChatInput
          value={chat.input.value}
          onInput={(v) => (chat.input.value = v)}
          onSend={() => chat.send()}
          onStop={() => chat.stop()}
          canSend={chat.canSend.value}
          streaming={chat.streaming.value}
          disabled={!auth.authenticated.value}
        />
      </div>
    </PageShell>
  );
}
