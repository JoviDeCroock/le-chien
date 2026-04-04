import { useEffect, useRef } from "preact/hooks";
import { AVAILABLE_SHORTCUTS, PLANNED_SHORTCUTS, type ShortcutDefinition } from "../lib/shortcuts";
import { CloseIcon } from "./ui/Icons";

type ShortcutOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function ShortcutOverlay({ open, onClose }: ShortcutOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, [open]);

  if (!open) return null;

  return (
    <div
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        class="w-full max-w-3xl rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-overlay-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div class="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <h2 id="shortcut-overlay-title" class="text-base font-semibold text-white">
              Keyboard shortcuts
            </h2>
            <p class="mt-1 text-sm text-neutral-400">
              Power-user bindings that exist now, plus reserved keys for the next navigation panels.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            title="Close shortcuts"
            class="rounded-md p-1.5 text-neutral-400 transition-all hover:bg-neutral-700 hover:text-white"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div class="grid max-h-[70vh] gap-6 overflow-y-auto px-5 py-5 md:grid-cols-2">
          <ShortcutSection
            title="Available now"
            description="These shortcuts are wired into the current chat experience."
            shortcuts={AVAILABLE_SHORTCUTS}
          />
          <ShortcutSection
            title="Reserved next"
            description="These bindings are held for memory, search, and files so the map can grow without churn."
            shortcuts={PLANNED_SHORTCUTS}
          />
        </div>

        <div class="border-t border-neutral-800 px-5 py-3 text-xs text-neutral-400">
          Press{" "}
          <kbd class="rounded-md border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-neutral-200">
            Esc
          </kbd>{" "}
          to close.
        </div>
      </div>
    </div>
  );
}

function ShortcutSection({
  title,
  description,
  shortcuts,
}: {
  title: string;
  description: string;
  shortcuts: ShortcutDefinition[];
}) {
  return (
    <section>
      <div class="mb-4">
        <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-300">{title}</h3>
        <p class="mt-1 text-sm text-neutral-400">{description}</p>
      </div>

      <div class="space-y-3">
        {shortcuts.map((shortcut) => (
          <div
            class="rounded-lg border border-neutral-800 bg-neutral-950/70 px-4 py-3"
            key={shortcut.id}
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-medium text-white">{shortcut.label}</div>
                <p class="mt-1 text-sm text-neutral-400">{shortcut.description}</p>
              </div>
              {shortcut.availability === "planned" && (
                <span class="shrink-0 rounded-full border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-300">
                  Planned
                </span>
              )}
            </div>
            <div class="mt-3 flex flex-wrap gap-1.5">
              {shortcut.keys.map((key) => (
                <kbd
                  class="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs font-medium text-neutral-200"
                  key={`${shortcut.id}-${key}`}
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
