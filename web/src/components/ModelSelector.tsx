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
  return (
    <BarSection class="border-b border-neutral-800/40 bg-neutral-950/80">
      <ContentContainer class="py-2">
        <div
          ref={barRef}
          class="flex items-center gap-1.5 overflow-x-auto"
          style="scrollbar-width: none; -ms-overflow-style: none;"
        >
          {models.map((m) => {
            const isSelected = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                disabled={disabled}
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
