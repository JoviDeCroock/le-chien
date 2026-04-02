import { useRef, useEffect, useCallback } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { ContentContainer, BarSection } from "./ui/Layout";
import { SendIcon, StopIcon, MicIcon } from "./ui/Icons";

const SpeechRecognition =
  typeof window !== "undefined"
    ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
    : undefined;

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
}) {
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const resolvedTextareaRef = textareaRef ?? fallbackRef;
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listening = useSignal(false);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    listening.value = false;
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
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

  return (
    <BarSection border="top">
      <ContentContainer class="py-3">
        <div class="flex items-end gap-2 bg-neutral-900 rounded-xl border border-neutral-800/80 focus-within:border-violet-600/30 transition-colors px-3 py-2">
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
        <p class="text-center text-xs text-neutral-400 mt-2 select-none">
          Responses generated by AI. Verify important information.
        </p>
      </ContentContainer>
    </BarSection>
  );
}
