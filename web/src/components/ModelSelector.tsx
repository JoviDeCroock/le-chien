import type { RefObject } from "preact";
import { useSignal } from "@preact/signals";
import { BarSection, ContentContainer } from "./ui/Layout";

export type Model = {
  id: string;
  name: string;
  description: string;
  tag: string;
  speed: "instant" | "fast" | "moderate";
  bestFor: string;
};

const speedConfig = {
  instant: { label: "Instant", dots: 3 },
  fast: { label: "Fast", dots: 2 },
  moderate: { label: "Thoughtful", dots: 1 },
} as const;

function SpeedIndicator({ speed }: { speed: Model["speed"] }) {
  const config = speedConfig[speed];
  return (
    <div class="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          class={`w-1 h-1 rounded-full ${i < config.dots ? "bg-current" : "bg-current opacity-20"}`}
        />
      ))}
      <span class="text-[10px] ml-0.5 opacity-70">{config.label}</span>
    </div>
  );
}

export function ModelSelector({
  models,
  selected,
  onSelect,
  disabled,
  barRef,
}: {
  models: Model[];
  selected: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  barRef?: RefObject<HTMLDivElement>;
}) {
  const hoveredId = useSignal<string | null>(null);

  function focusModel(button: HTMLButtonElement | null) {
    window.requestAnimationFrame(() => button?.focus());
  }

  function handleKeyDown(event: KeyboardEvent, index: number) {
    let nextIndex = index;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % models.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + models.length) % models.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = models.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextModel = models[nextIndex];
    onSelect(nextModel.id);

    const currentButton = event.currentTarget as HTMLButtonElement | null;
    focusModel(
      currentButton?.parentElement?.querySelector<HTMLButtonElement>(
        `[data-model-id="${nextModel.id}"]`,
      ) ?? null,
    );
  }

  const selectedModel = models.find((m) => m.id === selected);
  const hovered = models.find((m) => m.id === hoveredId.value);
  const displayModel = hovered ?? selectedModel;

  return (
    <BarSection class="border-b border-neutral-800/40 bg-neutral-950/80">
      <ContentContainer class="py-3">
        <div class="flex flex-col gap-2">
          {/* Model cards */}
          <div
            ref={barRef}
            class="flex items-stretch gap-2 overflow-x-auto"
            role="radiogroup"
            aria-label="Model selector"
            style="scrollbar-width: none; -ms-overflow-style: none;"
          >
            {models.map((m) => {
              const isSelected = selected === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelect(m.id)}
                  onMouseEnter={() => (hoveredId.value = m.id)}
                  onMouseLeave={() => (hoveredId.value = null)}
                  onKeyDown={(event) =>
                    handleKeyDown(
                      event,
                      models.findIndex((model) => model.id === m.id),
                    )
                  }
                  disabled={disabled}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  data-model-id={m.id}
                  class={`
                    group shrink-0 flex flex-col items-start gap-1 px-3 py-2 rounded-lg
                    text-left transition-all min-w-[100px]
                    ${
                      isSelected
                        ? "bg-violet-600/15 text-violet-300 border border-violet-500/40 shadow-[0_0_16px_rgba(124,58,237,0.12)]"
                        : "bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 border border-neutral-800/50"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50
                  `}
                >
                  <div class="flex items-center gap-2 w-full">
                    <span
                      class={`text-sm font-semibold tracking-tight ${
                        isSelected ? "text-white" : "text-neutral-200 group-hover:text-white"
                      }`}
                    >
                      {m.name}
                    </span>
                    <span
                      class={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-violet-500/25 text-violet-300"
                          : "bg-neutral-800 text-neutral-500 group-hover:text-neutral-400"
                      }`}
                    >
                      {m.tag}
                    </span>
                  </div>
                  <div
                    class={`${
                      isSelected
                        ? "text-violet-300/70"
                        : "text-neutral-500 group-hover:text-neutral-400"
                    }`}
                  >
                    <SpeedIndicator speed={m.speed} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Description bar — shows info for hovered or selected model */}
          {displayModel && (
            <div class="flex items-center gap-2 px-1 min-h-[20px]">
              <p class="text-xs text-neutral-500 leading-tight">
                <span class="text-neutral-400">{displayModel.description}</span>
                <span class="mx-1.5 text-neutral-700">·</span>
                <span>Best for {displayModel.bestFor.toLowerCase()}</span>
              </p>
            </div>
          )}
        </div>
      </ContentContainer>
    </BarSection>
  );
}
