# Vision

## What this is

A Cloudflare-native AI workspace that gives users a ChatGPT/Claude-like experience on top of strong open models.

The product combines:
- chat
- memory
- authentication
- billing
- workspaces
- search
- attachments
- tool use

The goal is not to be a generic chat wrapper. The goal is to become the operational layer around open models: fast chat, persistent context, grounded retrieval, and useful actions.

## Why it exists

Most AI chat products are still too stateless.

They answer prompts, but they do not really know:
- who the user is
- what the team cares about
- what files matter
- what should be remembered
- what actions should be taken

This product exists to make AI feel less like a session and more like a working environment.

## Product thesis

The winning open-model chat product is not just a model picker.

It is a workspace where:
- the assistant remembers useful context
- files and past conversations are searchable
- teams can collaborate inside shared workspaces
- tools can be invoked directly from chat
- usage, access, and billing are handled cleanly

The value is created by combining model quality with product context.

## Who it is for

The first users are:
- developers
- founders
- small teams
- AI-native operators
- research-heavy users

They want a powerful assistant, but they also want control, persistence, and a path from personal use to team use.

## MVP

The MVP should support:

### Core experience
- chat with curated model modes
- streaming responses
- persistent conversation history

### Context
- user memory
- workspace memory
- file upload and retrieval
- chat and file search

### Product foundations
- auth
- billing
- personal and shared workspaces
- role-based access

### Actions
- tool use inside chat
- inspectable tool calls
- approval for mutating actions

## Principles

### 1. Fast by default
The product should feel immediate. Fast mode should be good enough for most daily use.

### 2. Context makes the product
Memory, retrieval, and workspace knowledge are core, not add-ons.

### 3. Keep model choice simple
Expose a small number of useful modes rather than overwhelming users with raw model names.

### 4. Retrieval should be visible
When an answer comes from files or workspace knowledge, the product should make that clear.

### 5. Tools should feel trustworthy
Tool calls must be visible, understandable, and safe.

### 6. Team-ready early
The product should work for an individual first, but the architecture should support shared workspaces from the start.

## Information Architecture

### Navigation model: Collapsible sidebar

```
┌─────────────────────────────────────────────────────────┐
│ [▼ Workspace]      le chien         [search]  [@user]   │
├────────────┬────────────────────────────────────────────┤
│            │                                            │
│  SIDEBAR   │         MAIN CONTENT                       │
│  (collaps) │                                            │
│            │  ┌─ Chat ─────────────────────────────┐   │
│  Convos    │  │ Model selector bar                  │   │
│  ├ Today   │  │ Messages (scrollable)               │   │
│  ├ Prev 7d │  │  - user / assistant bubbles         │   │
│  └ Older   │  │  - tool call cards (expandable)     │   │
│            │  │  - file attachments (inline preview) │   │
│  Memory    │  │  - source citations                  │   │
│  ├ User    │  │ Input bar                            │   │
│  └ Workspace│ │  - textarea + attach + send          │   │
│            │  └──────────────────────────────────────┘   │
│  Files     │                                            │
│  ├ Recent  │  ┌─ Settings (overlay or page) ────────┐   │
│  └ Browse  │  │ Profile | Workspace | Billing | Members│ │
│            │  └──────────────────────────────────────┘   │
│  Settings  │                                            │
└────────────┴────────────────────────────────────────────┘
```

Sidebar collapses to icon rail on small screens or user toggle.
On mobile (<768px), sidebar is a slide-over drawer, hidden by default.

### Workspace as top-level context

- Workspace selector lives in the top bar (dropdown).
- Switching workspace changes everything: conversations, memory, files, members.
- Every user has a "Personal" workspace by default.
- Shared workspaces show member avatars and role badges.
- The URL reflects the workspace: `/ws/{workspace-slug}/chat/{convo-id}`.

### Content hierarchy per screen

**Chat (primary screen):**
1. First: Current message thread (takes 70%+ of viewport)
2. Second: Input bar (always visible, anchored bottom)
3. Third: Model selector (compact bar, above messages)
4. Fourth: Sidebar navigation (collapsible, secondary)

**Memory panel:**
1. First: Memory entries list (key-value pairs with timestamps)
2. Second: Add/edit memory action
3. Third: Filter (user vs workspace memory)

**Files panel:**
1. First: File list with type icons and previews
2. Second: Upload action (drag-and-drop zone)
3. Third: Search/filter bar

**Settings:**
1. First: Active section content (profile, workspace, billing)
2. Second: Section tabs/nav
3. Third: Danger zone actions (delete workspace, cancel plan) at bottom

## Interaction States

Every UI feature defines what the user sees in each state.

### Chat

| State   | User sees                                                                 |
|---------|---------------------------------------------------------------------------|
| Empty   | "Start your first conversation. Pick a model and ask anything." + [New chat] button, centered in main area |
| Loading | Pulsing dots in assistant bubble, streaming tokens as they arrive         |
| Error   | Inline error banner below the input bar: "Something went wrong. [Retry]" with the failed message preserved |
| Success | Assistant message rendered with markdown, code blocks, citations          |
| Partial | Streaming in progress — tokens render live, send button becomes stop button |

### Conversation List (sidebar)

| State   | User sees                                                                 |
|---------|---------------------------------------------------------------------------|
| Empty   | "No conversations yet" with [New chat] button                            |
| Loading | 3 skeleton shimmer rows in sidebar                                       |
| Error   | "Couldn't load conversations. [Retry]" inline in sidebar                 |
| Success | Conversations grouped: Today, Previous 7 days, Older. Title + last message preview |

### Memory

| State   | User sees                                                                 |
|---------|---------------------------------------------------------------------------|
| Empty   | "Nothing remembered yet. As you chat, save useful context here so your assistant remembers." + [Add memory] button |
| Loading | Skeleton cards with shimmer                                              |
| Error   | "Couldn't load memory. [Retry]"                                          |
| Success | Key-value cards with timestamps, edit/delete actions on hover            |
| Saving  | Inline spinner on the entry being saved, optimistic update               |

### Files

| State   | User sees                                                                 |
|---------|---------------------------------------------------------------------------|
| Empty   | "No files yet. Drop files here or attach them in chat to build your workspace knowledge." + [Upload] button + drag-drop zone |
| Loading | Skeleton list with file type icon placeholders                           |
| Error   | "Upload failed: [reason]. [Retry]" — failed file stays in list with error badge |
| Success | File list with type icons, name, size, date. Click to preview.           |
| Uploading | Progress bar per file, cancel button                                   |

### Search

| State   | User sees                                                                 |
|---------|---------------------------------------------------------------------------|
| Empty   | Search input with placeholder "Search conversations, files, and memory…" |
| No results | "No results for '[query]'. Try different keywords." — no dead end       |
| Loading | Skeleton result rows                                                     |
| Success | Results grouped by type (conversations, files, memory) with highlighted matches |

### Tool Use

| State   | User sees                                                                 |
|---------|---------------------------------------------------------------------------|
| Pending | Tool call card: tool name, parameters preview, [Approve] / [Deny] buttons for mutating actions |
| Running | Tool card with spinner: "Running [tool name]…"                           |
| Success | Tool card with result summary, expandable full output                    |
| Error   | Tool card with red border: "Failed: [reason]". Expandable error detail   |

### Workspace Members

| State   | User sees                                                                 |
|---------|---------------------------------------------------------------------------|
| Empty   | "Just you for now. Invite teammates to collaborate." + [Invite] button   |
| Loading | Skeleton avatar + name rows                                              |
| Success | Member list with avatar, name, role badge. Owner can change roles/remove |

### Billing

| State   | User sees                                                                 |
|---------|---------------------------------------------------------------------------|
| Free tier | Current plan card: "Free" with usage stats. [Upgrade to Pro] prominent button |
| Pro tier | Current plan card: "Pro" with renewal date, usage stats. [Manage billing] link to Polar |
| Loading | Skeleton plan card                                                       |
| Error   | "Couldn't load billing info. [Retry]"                                    |

## User Journey

### Onboarding: Straight to chat

No wizard, no tutorial. The product teaches itself through use.

```
Sign up → Personal workspace auto-created → Empty chat → Input bar focused → Ready
```

### First-time user arc

| Step | User does                   | User feels                | Product provides                           |
|------|-----------------------------|---------------------------|--------------------------------------------|
| 1    | Signs up (email/password)   | Curious, evaluating       | Fast auth → straight to workspace          |
| 2    | Sees empty chat             | Oriented ("I know what this is") | Warm empty state, input bar focused, model defaults to "Fast" |
| 3    | Sends first message         | Engaged — "it works"      | Fast streaming response, conversation auto-saved in sidebar |
| 4    | Has 3+ conversations        | Building habit            | Gentle hint: "Save context to memory for better answers" |
| 5    | Explores memory/files       | Discovery — "it does more" | Empty states with clear actions, not dead ends |
| 6    | Tries a tool call           | Impressed or cautious     | Tool card with preview + approve/deny for mutating actions |
| 7    | Invites a teammate          | Investment — "this is my tool" | Workspace invite flow, shared context visible immediately |

### Returning user arc

| Step | User does                   | User feels                | Product provides                           |
|------|-----------------------------|---------------------------|--------------------------------------------|
| 1    | Opens app                   | Continuity — "it remembers" | Last workspace, recent conversations visible |
| 2    | Continues a conversation    | Productive                | Memory-augmented responses, file references |
| 3    | Searches past work          | Confident in the archive  | Cross-type search (convos, files, memory)  |
| 4    | Switches workspace          | Context shift             | Clean transition, all content scoped        |

### Time-horizon design

- **5 seconds (visceral):** Dark theme, fast load, input bar ready. Feels fast and professional.
- **5 minutes (behavioral):** Streaming is smooth, sidebar updates live, tool calls are transparent. Feels reliable.
- **5 years (reflective):** "This is where my team's AI knowledge lives." Memory and files compound over time. Feels indispensable.

## Design Specifics (anti-slop)

### Model selector: Named modes, not model names

The UI exposes 3-4 intent-based modes, not raw model identifiers:

```
┌─────────────────────────────────┐
│  [Fast]   Deep   Code   Creative │
└─────────────────────────────────┘
```

- **Fast:** Default mode. Optimized for speed and daily use. (e.g., a small, fast model)
- **Deep:** For complex reasoning and long-form work. (e.g., a large reasoning model)
- **Code:** For programming tasks. (e.g., a code-specialized model)
- **Creative:** For writing, brainstorming, open-ended exploration.

Each mode is a curated preset: model + system prompt + temperature.
Selected mode has violet glow. Hover tooltip shows the underlying model name + what it excels at.
No raw model names anywhere in the primary UI. Advanced users see model details in Settings.

Selector is a compact segmented control (not a dropdown, not a scrollable list).

### Tool call UI: Inline expandable cards

Tool calls render as compact cards within the message flow, not separate panels or code blocks.

**Read-only tools (search, retrieve):**
```
┌──────────────────────────────────┐
│ ⚡ web_search              2.1s ▼ │
│ Found 3 results for "query"      │
└──────────────────────────────────┘
```
- Collapsed by default: tool name + status icon + one-line summary + timing
- Expandable: full parameters, output, raw response

**Mutating tools (send, create, delete):**
```
┌──────────────────────────────────┐
│ ⚠ send_email                     │
│ To: team@co  Subject: Q3 update  │
│ [Approve]          [Deny]        │
└──────────────────────────────────┘
```
- Shown before execution with parameter preview
- Approve/Deny buttons. Deny allows the user to explain why.
- After approval: same card transitions to running → success/error state

### Citation & source display

When a response draws from files or workspace memory, citations are inline:
- Superscript reference numbers in the text [1] [2]
- Clicking a citation scrolls to a source card at the bottom of the message
- Source card shows: file name, snippet preview, and link to full file

### What makes this NOT generic

- No hero section. No 3-column features grid. No "AI-powered" tagline.
- The product opens to a focused, empty chat — not a marketing page.
- Memory and files are visible in the sidebar from day one, not hidden in settings.
- Tool calls are first-class UI elements, not hidden console output.
- The workspace switcher makes team context feel structural, not bolt-on.

## Design Tokens (from existing codebase)

These tokens are already established in the codebase. All new features must use them consistently.

### Colors

| Token        | Value         | Usage                              |
|--------------|---------------|-------------------------------------|
| Base         | neutral-950   | Page background                     |
| Surface      | neutral-900   | Cards, sidebar, elevated surfaces   |
| Surface alt  | neutral-800   | Input backgrounds, hover states     |
| Border       | neutral-700   | Borders, dividers                   |
| Text muted   | neutral-400   | Secondary text, placeholders        |
| Text body    | neutral-300   | Body text                           |
| Text heading | white         | Headings, primary labels            |
| Accent       | violet-600    | Primary actions, selected states    |
| Accent hover | violet-500    | Hover on primary actions            |
| Accent glow  | violet-800/900| Selected model mode glow, focus rings |
| Error        | red-400       | Error text, icons                   |
| Error bg     | red-950       | Error banner backgrounds            |
| Success      | green-400     | Success text, icons                 |
| Success bg   | green-900     | Success banner backgrounds          |

### Spacing & Layout

- Spacing scale: Tailwind default (4px base)
- Border radius: `rounded-lg` (8px) for cards, inputs, buttons
- Content max-width: `max-w-3xl` for chat, `max-w-md` for forms
- Sidebar width: ~256px expanded, ~48px collapsed (icon rail)

### Existing Components

| Component | Variants                                    |
|-----------|---------------------------------------------|
| Button    | primary, secondary, ghost, icon, danger-icon |
| Input     | Default (with label, focus ring)            |
| Alert     | error, inline-error, success                |

### New Components Needed for MVP

| Component         | Purpose                                | Extends existing? |
|-------------------|----------------------------------------|--------------------|
| Sidebar           | Collapsible nav with sections          | New                |
| WorkspaceSwitcher | Dropdown in top bar                    | New                |
| ConversationItem  | Sidebar list item with title + preview | New                |
| MemoryCard        | Key-value card with edit/delete        | New                |
| FileItem          | File list item with type icon          | New                |
| ToolCallCard      | Inline expandable card in chat         | New                |
| SkeletonLoader    | Shimmer placeholder for loading states | New                |
| EmptyState        | Reusable: icon + message + action      | New                |
| SearchResult      | Grouped result with highlighted match  | New                |

All new components should use the existing color tokens, `rounded-lg` radius, and Tailwind spacing scale.

## Responsive Design

### Breakpoints

| Viewport     | Width       | Sidebar                   | Model selector       | Chat area             |
|-------------|-------------|---------------------------|----------------------|-----------------------|
| Mobile      | < 768px     | Slide-over drawer (hidden) | Single dropdown      | Full width            |
| Tablet      | 768–1024px  | Icon rail (expandable)    | Compact segmented    | Wider margins         |
| Desktop     | > 1024px    | Full sidebar expanded     | Full segmented bar   | Constrained max-w-3xl |

### Mobile-specific behaviors

- Sidebar opens via hamburger icon in top bar, closes on selection or swipe
- Input bar is full-width, anchored to bottom, with attach icon (no label)
- Tool call cards stack full-width within the message flow
- Workspace switcher in the top bar becomes a full-screen overlay on tap
- Search is a full-screen overlay (not inline in sidebar)
- Settings is a full-screen page (not overlay)
- Touch targets: minimum 44px on all interactive elements

### Tablet-specific behaviors

- Sidebar shows as icon rail (48px). Tap to expand as overlay, not push.
- Chat area has 24px side margins
- Model selector shows abbreviated mode names (F / D / C / Cr) when space is tight

## Accessibility

### Keyboard navigation

- `Tab` moves between major regions: sidebar → model selector → chat messages → input bar
- `Arrow keys` navigate within regions (sidebar items, model modes)
- `Enter` activates buttons, selects conversations, sends messages
- `Shift+Enter` adds newline in input (already implemented)
- `Escape` closes overlays, drawers, expanded tool cards
- `Cmd+K` or `Ctrl+K` opens search

### Screen readers

- All interactive elements have accessible labels
- Chat messages have `role="log"` with `aria-live="polite"` for new messages
- Tool call cards have `aria-expanded` state
- Model selector uses `role="radiogroup"` with `aria-checked`
- Sidebar sections use `role="navigation"` with `aria-label`
- Empty states are announced (not just visual)
- Loading states use `aria-busy="true"`

### Color & contrast

- All text meets WCAG 2.1 AA contrast ratio (4.5:1 for body text, 3:1 for large text)
- Error/success states never rely on color alone — always paired with icons
- Focus indicators: 2px violet-600 ring on all focusable elements (already implemented for inputs)

## Resolved Design Decisions

### Free tier limit behavior: Soft limit with upgrade nudge

- Current conversation completes (never cut a user off mid-response).
- After the response, inline banner: "You've used your free messages for today. Upgrade to Pro for unlimited."
- Next message attempt: input disabled with the same banner. Resets daily or on upgrade.
- Tone: respectful, not punishing. The user just proved the product is valuable to them.

### Memory creation: Manual + AI-suggested

- **Manual:** Sidebar → Memory → [Add memory] button. User types key + value.
- **AI-suggested:** After conversations where the assistant detects saveable context (preferences, facts, decisions), it shows:
  ```
  ┌────────────────────────────────┐
  │ 🧠 Save to memory?             │
  │ "Prefers TypeScript over JS"   │
  │ [Save]   [Edit]   [Dismiss]   │
  └────────────────────────────────┘
  ```
- User always approves/edits before saving. Nothing is stored without consent.
- Memory suggestions appear at the end of a conversation, not mid-stream.

### File attachments in chat: Type-aware inline previews

- **Images:** Inline thumbnail (max 300px wide). Click to expand full-size in lightbox.
- **PDFs:** File icon + name + page count badge. Click to open in-app viewer.
- **Code/text files:** First 5 lines with syntax highlighting. Click to expand full file.
- **Other files:** File type icon + name + file size. Click to download.
- Attachments render above the user's message text.
- In the input bar: attached files show as removable chips before sending.

### Conversation management

- Conversations can be renamed (click title in sidebar → inline edit).
- Delete via right-click context menu (desktop) or swipe-left (mobile) with confirmation dialog.
- Conversations are soft-deleted (recoverable for 30 days from trash).

### Workspace invites

- Invite via email from Settings → Members → [Invite].
- Invitee receives email with join link. Link creates account if needed.
- Roles: Owner (full control), Member (chat + files + memory), Viewer (read-only).

## Design decisions NOT in scope

- **Dark/light theme toggle** — Dark-only for MVP. Reduces surface area, matches developer audience.
- **Custom themes or branding per workspace** — Not needed until enterprise tier.
- **Drag-and-drop sidebar reordering** — Sidebar sections are fixed order for MVP.
- **Real-time collaborative editing** — Workspaces share context but conversations are single-user for now.
- **Voice input/output** — Text-only for MVP.
- **Desktop/mobile native apps** — Web-only. PWA can be explored post-MVP.
- **Animated transitions between screens** — Keep transitions instant. Motion design is post-MVP polish.

## What already exists (design leverage)

- Dark theme: neutral-950 base, violet-600 accent — coherent and implemented
- Button component with 5 variants (primary, secondary, ghost, icon, danger-icon)
- Input component with label, focus ring, error state
- Alert component with 3 variants (error, inline-error, success)
- Chat layout: top bar → content → input bar pattern
- Streaming UX: pulsing dots, live token rendering, stop capability
- Auth flow: sign in / sign up tabs with form validation
- Auto-resize textarea with keyboard shortcuts (Enter to send, Shift+Enter for newline)

## Non-goals

This project is not trying to:
- be a frontier model lab
- support every model under the sun
- build a full autonomous agent platform in v1
- replace strong product design with “AI magic”

## Success

We win if users come back because the product becomes their working context.

That means:
- they trust it with their files
- they rely on its memory
- they use it across sessions
- they invite teammates into shared workspaces
- they treat it as infrastructure, not a novelty