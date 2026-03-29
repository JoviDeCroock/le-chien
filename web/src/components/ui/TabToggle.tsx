import type { ComponentChildren } from "preact";

interface Tab {
  id: string;
  label: ComponentChildren;
}

interface TabToggleProps {
  tabs: Tab[];
  active: string;
  onSelect: (id: string) => void;
  class?: string;
}

/** Segmented tab toggle — neutral-900 background with active highlight. */
export function TabToggle({ tabs, active, onSelect, class: className }: TabToggleProps) {
  return (
    <div
      class={`flex rounded-lg bg-neutral-900 border border-neutral-800 p-1 ${className ?? ""}`.trim()}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          class={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
            active === tab.id ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
          }`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
