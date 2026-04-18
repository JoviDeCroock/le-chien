import { useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { KnowledgeFile, FilesLimits } from "../models/files";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Layout";
import { CloseIcon, FileIcon, LockIcon, UploadIcon } from "./ui/Icons";

export type FilesPanelProps = {
  open: boolean;
  onClose: () => void;
  files: KnowledgeFile[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  isLocked: boolean;
  limits: FilesLimits;
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onUpgrade: () => void;
};

export function FilesPanel({
  open,
  onClose,
  files,
  loading,
  uploading,
  error,
  isLocked,
  limits,
  onUpload,
  onDelete,
  onUpgrade,
}: FilesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragActive = useSignal(false);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const file = list[0];
    if (file) onUpload(file);
  };

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        class={`fixed inset-0 z-20 transition-opacity duration-200 ${
          open ? "bg-black/40 pointer-events-auto" : "bg-black/0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        class={`fixed right-0 z-30 h-full w-72 shrink-0 bg-neutral-900 border-l border-neutral-800 flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Files"
        aria-hidden={!open}
      >
        <div class="h-12 shrink-0 flex items-center justify-between px-3 border-b border-neutral-800">
          <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Files
            {!isLocked && limits.maxFiles > 0 && (
              <span class="ml-2 text-neutral-500 normal-case tracking-normal">
                {files.length}/{limits.maxFiles}
              </span>
            )}
          </span>
          <Button variant="icon" onClick={onClose} title="Close files panel">
            <CloseIcon size={16} />
          </Button>
        </div>

        {error && (
          <div class="px-3 py-2 text-xs text-red-400 bg-red-950/50 border-b border-neutral-800">
            {error}
          </div>
        )}

        <div class="flex-1 overflow-y-auto py-1">
          {isLocked ? (
            <FilesLockedState onUpgrade={onUpgrade} />
          ) : loading ? (
            <div class="space-y-2 px-3 py-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} class="h-12" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <FilesEmptyState
              dragActive={dragActive.value}
              onPick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                dragActive.value = true;
              }}
              onDragLeave={() => (dragActive.value = false)}
              onDrop={(e) => {
                e.preventDefault();
                dragActive.value = false;
                handleFiles(e.dataTransfer?.files ?? null);
              }}
            />
          ) : (
            <div class="space-y-1 px-1 py-1">
              {files.map((f) => (
                <FileCard key={f.id} file={f} onDelete={() => onDelete(f.id)} />
              ))}
            </div>
          )}
        </div>

        {!isLocked && files.length > 0 && (
          <div class="shrink-0 border-t border-neutral-800 p-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || files.length >= limits.maxFiles}
              class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadIcon size={14} />
              {uploading ? "Uploading…" : "Upload file"}
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          class="hidden"
          onChange={(e) => {
            handleFiles((e.currentTarget as HTMLInputElement).files);
            (e.currentTarget as HTMLInputElement).value = "";
          }}
        />
      </aside>
    </>
  );
}

function FilesLockedState({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div class="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div class="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-3 text-neutral-400">
        <LockIcon size={18} />
      </div>
      <p class="text-xs text-neutral-300 font-medium mb-1">Files are a Pro feature</p>
      <p class="text-xs text-neutral-400 leading-relaxed mb-4">
        Upload PDFs, notes, and other documents. le chien can reference them in any chat.
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
      >
        Upgrade to Pro
      </button>
    </div>
  );
}

type EmptyStateProps = {
  dragActive: boolean;
  onPick: () => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
};

function FilesEmptyState({ dragActive, onPick, onDragOver, onDragLeave, onDrop }: EmptyStateProps) {
  return (
    <div class="px-3 py-3">
      <button
        type="button"
        onClick={onPick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        class={`w-full flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-lg border border-dashed transition-colors text-center ${
          dragActive
            ? "border-violet-500 bg-violet-950/30"
            : "border-neutral-700 bg-neutral-900/50 hover:border-neutral-600"
        }`}
      >
        <UploadIcon size={18} class="text-neutral-400" />
        <p class="text-xs font-medium text-neutral-200">Drop files here</p>
        <p class="text-[11px] text-neutral-500 leading-relaxed">
          PDF, text, markdown, docx · up to 25 MB each
        </p>
      </button>
    </div>
  );
}

function FileCard({ file, onDelete }: { file: KnowledgeFile; onDelete: () => void }) {
  return (
    <div class="group mx-1 px-2.5 py-2 rounded-lg hover:bg-neutral-800/50 transition-colors">
      <div class="flex items-start gap-2.5">
        <span class="mt-0.5 text-neutral-500 shrink-0">
          <FileIcon size={14} />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-white truncate">{file.filename}</p>
          <div class="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-500">
            <span>{formatBytes(file.size)}</span>
            <span class="w-1 h-1 rounded-full bg-neutral-700" />
            <FileStatus status={file.status} />
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          class="shrink-0 p-1 rounded text-neutral-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete"
        >
          <CloseIcon size={12} />
        </button>
      </div>
    </div>
  );
}

function FileStatus({ status }: { status: KnowledgeFile["status"] }) {
  if (status === "ready") {
    return (
      <span class="inline-flex items-center gap-1 text-green-400">
        <span class="w-1.5 h-1.5 rounded-full bg-green-400" />
        Ready
      </span>
    );
  }
  if (status === "error") {
    return (
      <span class="inline-flex items-center gap-1 text-red-400">
        <span class="w-1.5 h-1.5 rounded-full bg-red-400" />
        Error
      </span>
    );
  }
  return (
    <span class="inline-flex items-center gap-1 text-amber-400">
      <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      Indexing
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
