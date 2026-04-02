export type ShortcutDefinition = {
  id: string;
  label: string;
  description: string;
  keys: string[];
  availability: "available" | "planned";
};

export const AVAILABLE_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "new-chat",
    label: "New chat",
    description: "Clear the current thread and start fresh.",
    keys: ["Cmd/Ctrl", "N"],
    availability: "available",
  },
  {
    id: "toggle-sidebar",
    label: "Toggle sidebar",
    description: "Open or close the conversation list drawer.",
    keys: ["Cmd/Ctrl", "Shift", "S"],
    availability: "available",
  },
  {
    id: "focus-models",
    label: "Focus model selector",
    description: "Jump to the selected model pill and use arrow keys to switch.",
    keys: ["Cmd/Ctrl", "/"],
    availability: "available",
  },
  {
    id: "show-shortcuts",
    label: "Show shortcuts",
    description: "Open the shortcut reference overlay from anywhere outside inputs.",
    keys: ["?"],
    availability: "available",
  },
  {
    id: "close-overlay",
    label: "Close overlays",
    description: "Dismiss the shortcut overlay or mobile sidebar.",
    keys: ["Esc"],
    availability: "available",
  },
  {
    id: "select-model-prev-next",
    label: "Switch models",
    description: "Move left or right once the model selector has focus.",
    keys: ["Left/Right"],
    availability: "available",
  },
  {
    id: "select-conversation-prev-next",
    label: "Move in conversations",
    description: "Use the arrow keys to move through the sidebar list.",
    keys: ["Up/Down"],
    availability: "available",
  },
  {
    id: "send-message",
    label: "Send message",
    description: "Submit the current prompt from the composer.",
    keys: ["Enter"],
    availability: "available",
  },
  {
    id: "insert-newline",
    label: "Insert newline",
    description: "Keep typing in the composer without sending.",
    keys: ["Shift", "Enter"],
    availability: "available",
  },
  {
    id: "toggle-memory",
    label: "Toggle memory panel",
    description: "Open or close the memory panel on the right side.",
    keys: ["Cmd/Ctrl", "Shift", "M"],
    availability: "available",
  },
];

export const PLANNED_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "open-search",
    label: "Open search",
    description: "Reserved for the global conversation/files/memory search overlay.",
    keys: ["Cmd/Ctrl", "K"],
    availability: "planned",
  },
  {
    id: "open-files",
    label: "Open files panel",
    description: "Reserved for the workspace files view once it ships.",
    keys: ["Cmd/Ctrl", "Shift", "F"],
    availability: "planned",
  },
];
