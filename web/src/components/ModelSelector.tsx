import type { RefObject } from "preact";
import { BarSection, ContentContainer } from "./ui/Layout";

export type Model = {
  id: string;
  name: string;
  description: string;
};

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
    focusModel(currentButton?.parentElement?.querySelector<HTMLButtonElement>(`[data-model-id="${nextModel.id}"]`) ?? null);
  }

  return (
    <BarSection class="border-b border-neutral-800/40 bg-neutral-950/80">
      <ContentContainer class="py-2">
        <div
          ref={barRef}
          class="flex items-center gap-1.5 overflow-x-auto"
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
                onKeyDown={(event) => handleKeyDown(event, models.findIndex((model) => model.id === m.id))}
                disabled={disabled}
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                data-model-id={m.id}
                class={`
                  shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${
                    isSelected
                      ? "bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                      : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800/60"
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                title={m.description}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      </ContentContainer>
    </BarSection>
  );
}
