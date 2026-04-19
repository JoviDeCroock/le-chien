import { useRef, useEffect, useCallback } from "preact/hooks";
import { useComputed, useSignal } from "@preact/signals";
import { Show } from "@preact/signals/utils";
import { ContentContainer, BarSection } from "./ui/Layout";
import {
  SendIcon,
  StopIcon,
  MicIcon,
  ImageIcon,
  GlobeIcon,
  SearchIcon,
  ChevronUpIcon,
} from "./ui/Icons";
import type { ExtraTool } from "../models/chat";

const SpeechRecognition =
  typeof window !== "undefined"
    ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
    : undefined;

const EXTRA_TOOLS: { id: ExtraTool; label: string; icon: typeof ImageIcon }[] = [
  { id: "generate_image", label: "Image generation", icon: ImageIcon },
  { id: "read_url", label: "Web access", icon: GlobeIcon },
  { id: "web_search", label: "Web search", icon: SearchIcon },
];

export function ChatInput({
  value,
  onInput,
  onSend,
  onStop,
  canSend,
  streaming,
  disabled,
  placeholder,
  textareaRef,
  enabledExtras,
  disabledExtras,
  onToggleExtra,
}: {
  value: string;
  onInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  textareaRef?: { current: HTMLTextAreaElement | null };
  enabledExtras: ExtraTool[];
  disabledExtras?: ExtraTool[];
  onToggleExtra: (id: ExtraTool) => void;
}) {
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const resolvedTextareaRef = textareaRef ?? fallbackRef;
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listening = useSignal(false);
  const dropdownOpen = useSignal(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const chevronClass = useComputed(
    () => `transition-transform duration-150 ${dropdownOpen.value ? "" : "rotate-180"}`,
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    listening.value = false;
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        dropdownOpen.value = false;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleListening() {
    if (listening.value) {
      stopListening();
      return;
    }

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognitionRef.current = recognition;

    const baseValue = value;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      const separator = baseValue && !baseValue.endsWith(" ") ? " " : "";
      onInput(baseValue + separator + final + interim);
    };

    recognition.onerror = () => {
      listening.value = false;
    };

    recognition.onend = () => {
      listening.value = false;
    };

    recognition.start();
    listening.value = true;
  }

  function handleInput(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    onInput(el.value);
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 168) + "px";
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        if (listening.value) stopListening();
        onSend();
        if (resolvedTextareaRef.current) resolvedTextareaRef.current.style.height = "auto";
      }
    }
  }

  function handleSendClick() {
    if (listening.value) stopListening();
    onSend();
    if (resolvedTextareaRef.current) resolvedTextareaRef.current.style.height = "auto";
  }

  const hasSpeech = !!SpeechRecognition;
  const activeCount = enabledExtras.length;

  return (
    <BarSection border="top">
      <ContentContainer class="py-3">
        <div class="flex items-end gap-2 bg-neutral-900 rounded-xl border border-neutral-800 focus-within:border-violet-600/40 transition-colors px-3 py-2">
          <textarea
            ref={resolvedTextareaRef}
            value={value}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Send a message..."}
            rows={1}
            class="flex-1 bg-transparent text-sm text-white placeholder-neutral-400 resize-none outline-none leading-relaxed py-1"
            style="max-height: 168px;"
            disabled={disabled}
          />
          {hasSpeech && !streaming && (
            <button
              onClick={toggleListening}
              disabled={disabled}
              class={`shrink-0 p-2 rounded-lg transition-all duration-150 ${
                listening.value
                  ? "bg-red-600/20 text-red-400 hover:bg-red-600/30 animate-pulse"
                  : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              title={listening.value ? "Stop listening" : "Voice input"}
            >
              <MicIcon size={16} />
            </button>
          )}
          {streaming ? (
            <button
              onClick={onStop}
              class="shrink-0 p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-all"
              title="Stop generating"
            >
              <StopIcon size={16} />
            </button>
          ) : (
            <button
              onClick={handleSendClick}
              disabled={!canSend}
              class="shrink-0 p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 active:scale-[0.95] transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-violet-600"
              title="Send message"
            >
              <SendIcon size={16} />
            </button>
          )}
        </div>
        <div class="flex items-center justify-between mt-2">
          {/* Extras dropdown */}
          <div class="relative" ref={dropdownRef}>
            <button
              onClick={() => (dropdownOpen.value = !dropdownOpen.value)}
              class={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-all duration-150 ${
                activeCount > 0
                  ? "bg-violet-600/15 text-violet-400 hover:bg-violet-600/25"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
              }`}
              title="Toggle extra tools"
            >
              <ChevronUpIcon size={12} class={chevronClass} />
              <span>Tools</span>
              {activeCount > 0 && (
                <span class="bg-violet-600/30 text-violet-300 text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </button>
            <Show when={dropdownOpen}>
              <div class="absolute bottom-full left-0 mb-1 w-52 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-50">
                <div class="px-3 py-2 border-b border-neutral-800">
                  <span class="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                    Extra tools
                  </span>
                </div>
                {EXTRA_TOOLS.map(({ id, label, icon: ToolIcon }) => {
                  const active = enabledExtras.includes(id);
                  const limitReached = disabledExtras?.includes(id) ?? false;
                  return (
                    <button
                      key={id}
                      onClick={() => !limitReached && onToggleExtra(id)}
                      disabled={limitReached}
                      class={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                        limitReached
                          ? "text-neutral-600 cursor-not-allowed"
                          : active
                            ? "text-white bg-violet-600/10"
                            : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
                      }`}
                      title={limitReached ? "Daily limit reached" : undefined}
                    >
                      <ToolIcon size={14} />
                      <span class="flex-1 text-left">
                        {label}
                        {limitReached && (
                          <span class="text-[11px] text-neutral-600 ml-1">— limit reached</span>
                        )}
                      </span>
                      {!limitReached && (
                        <div
                          class={`w-7 h-4 rounded-full transition-colors duration-150 flex items-center ${
                            active ? "bg-violet-600 justify-end" : "bg-neutral-700 justify-start"
                          }`}
                        >
                          <div class="w-3 h-3 bg-white rounded-full mx-0.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Show>
          </div>
          <p class="text-xs text-neutral-400 select-none">
            Responses generated by AI. Verify important information.
          </p>
        </div>
      </ContentContainer>
    </BarSection>
  );
}
