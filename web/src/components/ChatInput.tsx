import { useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { ContentContainer, BarSection } from "./ui/Layout";
import { SendIcon, StopIcon, PaperclipIcon, XIcon, FileIcon } from "./ui/Icons";
import type { Attachment } from "../models/chat";

function isImageType(type: string) {
  return type.startsWith("image/");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  return (
    <div class="flex items-center gap-1.5 bg-neutral-800 border border-neutral-700/60 rounded-lg px-2 py-1.5 text-xs text-neutral-300 max-w-[180px]">
      {attachment.uploading ? (
        <span class="w-3 h-3 border-2 border-neutral-500 border-t-violet-500 rounded-full animate-spin shrink-0" />
      ) : isImageType(attachment.type) ? (
        <span class="w-3 h-3 text-neutral-400 shrink-0">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            />
            <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="2" />
            <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" />
          </svg>
        </span>
      ) : (
        <FileIcon size={12} class="shrink-0 text-neutral-400" />
      )}
      <span class="truncate">{attachment.name}</span>
      <span class="text-neutral-500 shrink-0">{formatFileSize(attachment.size)}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        class="shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors p-0.5 -mr-0.5"
        title="Remove"
      >
        <XIcon size={10} />
      </button>
    </div>
  );
}

export function ChatInput({
  value,
  onInput,
  onSend,
  onStop,
  onUpload,
  onRemoveAttachment,
  attachments,
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
  onUpload: (file: File) => void;
  onRemoveAttachment: (key: string) => void;
  attachments: Attachment[];
  canSend: boolean;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  textareaRef?: { current: HTMLTextAreaElement | null };
}) {
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const resolvedTextareaRef = textareaRef ?? fallbackRef;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragOver = useSignal(false);

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
        onSend();
        if (resolvedTextareaRef.current) resolvedTextareaRef.current.style.height = "auto";
      }
    }
  }

  function handleSendClick() {
    onSend();
    if (resolvedTextareaRef.current) resolvedTextareaRef.current.style.height = "auto";
  }

  function handleFiles(files: FileList | File[]) {
    for (const file of files) {
      onUpload(file);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver.value = false;
    if (e.dataTransfer?.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver.value = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    dragOver.value = false;
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          onUpload(file);
        }
      }
    }
  }

  const hasAttachments = attachments.length > 0;

  return (
    <BarSection border="top">
      <ContentContainer class="py-3">
        <div
          class={`bg-neutral-900 rounded-xl border transition-colors px-3 py-2 ${
            dragOver.value
              ? "border-violet-500/50 bg-violet-950/10"
              : "border-neutral-800/80 focus-within:border-violet-600/30"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {hasAttachments && (
            <div class="flex flex-wrap gap-1.5 mb-2">
              {attachments.map((att) => (
                <AttachmentChip
                  key={att.key}
                  attachment={att}
                  onRemove={() => onRemoveAttachment(att.key)}
                />
              ))}
            </div>
          )}
          <div class="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              class="shrink-0 p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-all"
              title="Attach file"
              disabled={disabled}
            >
              <PaperclipIcon size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              class="hidden"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv,text/markdown"
              onChange={(e) => {
                const input = e.target as HTMLInputElement;
                if (input.files?.length) {
                  handleFiles(input.files);
                  input.value = "";
                }
              }}
            />
            <textarea
              ref={resolvedTextareaRef}
              value={value}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder ?? "Send a message..."}
              rows={1}
              class="flex-1 bg-transparent text-sm text-white placeholder-neutral-400 resize-none outline-none leading-relaxed py-1"
              style="max-height: 168px;"
              disabled={disabled}
            />
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
        </div>
        <p class="text-center text-xs text-neutral-400 mt-2 select-none">
          Responses generated by AI. Verify important information.
        </p>
      </ContentContainer>
    </BarSection>
  );
}
