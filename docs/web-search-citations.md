# Web search citations

## What we did

Added inline citations and source cards when the model uses web search, so users can verify claims.

## Two-part approach

### 1. System prompt instruction (chat-agent.ts)
The model is instructed to include numbered markdown links `[1](url)`, `[2](url)` inline next to claims, and list all sources with titles at the end. The existing Markdown renderer handles these links naturally — no frontend parsing needed.

### 2. Source cards in tool call UI (ToolCallCard.tsx)
Web search results are detected via `isWebSearchResult()` and rendered as clickable source cards instead of raw JSON. Each card shows:
- Numbered badge matching the citation index
- Page title (highlights violet on hover)
- Domain name
- Snippet preview (2-line clamp)
- External link icon

Other tool results still use the generic JSON display.

## Design decisions

- Source cards are always visible (not behind the expand toggle) since they're the most useful part of a web search result
- The expanded view skips raw JSON for web search results since the cards already show everything
- Citation numbering in the source cards matches the order Tavily returns results, which matches how the model references them in `[1]`, `[2]` etc.
- Styling follows DESIGN.md: neutral-800/700 surfaces, violet-400 hover accent, 11-12px type sizes for metadata
