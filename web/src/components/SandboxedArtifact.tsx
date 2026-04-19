import { useEffect, useRef } from "preact/hooks";
import { signal, createModel, useModel } from "@preact/signals";
import { Show } from "@preact/signals/utils";
import { SandboxBridge } from "../runtime/bridge";

const ArtifactModel = createModel(() => {
  const error = signal<string | null>(null);
  const collapsed = signal(false);
  return { error, collapsed };
});

export function SandboxedArtifact({ id, code }: { id: string; code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<SandboxBridge | null>(null);
  const model = useModel(ArtifactModel);

  useEffect(() => {
    if (!containerRef.current) return;

    bridgeRef.current?.destroy();
    model.error.value = null;

    const bridge = new SandboxBridge(containerRef.current, {
      onError: (msg) => {
        model.error.value = msg;
      },
    });
    bridgeRef.current = bridge;
    bridge.mount(code);

    return () => {
      bridge.destroy();
      bridgeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, code]);

  return (
    <div class="my-3 rounded-lg border border-neutral-700/40 bg-neutral-900/40 overflow-hidden">
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-neutral-700/40 bg-neutral-800/40">
        <span class="text-[11px] font-medium text-neutral-400 tracking-wide uppercase">
          Artifact
        </span>
        <button
          type="button"
          onClick={() => (model.collapsed.value = !model.collapsed.value)}
          class="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          {model.collapsed.value ? "Show" : "Hide"}
        </button>
      </div>
      <Show when={model.error}>
        <div class="px-3 py-2 text-xs text-red-400 bg-red-950/30 border-b border-red-900/30">
          Artifact error: {model.error.value}
        </div>
      </Show>
      <div
        ref={containerRef}
        class="sandboxed-artifact-body p-3 bg-neutral-950 text-neutral-200 max-h-[480px] overflow-auto"
        style={{ display: model.collapsed.value ? "none" : "block" }}
      />
    </div>
  );
}
