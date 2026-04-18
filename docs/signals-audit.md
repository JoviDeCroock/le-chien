# Signals audit — 2026-04-18

## Findings

State layer is already signal-based:

- No `useState` / `useReducer` anywhere in `web/src`.
- No user-defined `createContext` / `useContext` (only `preact-iso` `LocationProvider`, a library primitive — nothing to memoize).
- All shared state lives in `createModel` models under `web/src/models/` (auth, auth-form, billing, chat, chat-ui, memory, tamagotchi).

Remaining non-signal primitives are all legitimate:

- `useRef` for DOM handles (textarea, scroll target, modal close button, model bar, popover wrappers).
- `useRef` for `SpeechRecognition` instance in `ChatInput.tsx` — imperative browser API handle.
- `let subscriptionResetTimer` in `chat.ts` — closure-local timer id, not reactive state.
- `useSignal` local to `ChatInput`, `ToolCallCard`, `ModelSelector` — ephemeral UI state scoped to one component; lifting would be over-abstraction.

## Change

Extracted `ChatUIModel` (`web/src/models/chat-ui.ts`) from `Chat/index.tsx`:

- Holds `sidebarOpen`, `shortcutsOpen`, `petPopoverOpen` signals.
- Exposes `toggleSidebar`, `closeSidebar`, `openShortcuts`, `closeShortcuts`, `togglePetPopover`, `closePetPopover`.

Rationale: these three signals were used across TopBar, Sidebar, ShortcutOverlay, the click-away handler, and the keyboard handler, plus cross-referenced each other in the ESC branch. Centralizing matches the "lift when multiple components need to share it" rule from the signals skill guide.

Other `useSignal` usages (drag, drop-down open, hover, accordion expand) stayed local because they're scoped to a single component.
