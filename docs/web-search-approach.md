# Web Search: Approach & Recommendation

How to give le chien the ability to search the web during conversations.

## Options Considered

### Option A: Bing Web Search API

Microsoft's Bing Web Search API. Well-established, high quality results.

- **Pricing:** Free tier at 1,000 calls/month, then paid tiers starting at ~$3/1,000 calls.
- **Pros:** High quality results, strong snippet extraction, image/video/news verticals available, well-documented.
- **Cons:** Requires an Azure account and API key, costs add up at scale, Microsoft ecosystem dependency.

### Option B: SearXNG Self-Hosted

Open source meta-search engine that aggregates results from multiple search engines. Can be self-hosted.

- **Hosting:** Could run as a Docker container on a VPS, or potentially as a Cloudflare Worker (though it's Python-based, so Workers compatibility is unlikely without significant work).
- **Pros:** No API costs, no rate limits, privacy-friendly (no tracking), aggregates multiple sources.
- **Cons:** Operational overhead (hosting, monitoring, updates), result quality varies depending on upstream engines, latency from self-hosted infrastructure, not a simple "call an API" integration.

### Option C: Brave Search API

Brave offers a Search API with a generous free tier and clean interface.

- **Pricing:** Free tier at 2,000 calls/month (1 call/second), then paid plans.
- **Pros:** Good free tier, simple REST API with a single endpoint, decent result quality with snippet text included, no heavyweight infrastructure needed.
- **Cons:** Less established than Bing or Google, smaller index (though growing), company is primarily a browser company.

### Option D: Tavily (AI-Optimized Search)

Built specifically for AI and LLM use cases. Returns pre-processed, LLM-friendly text snippets.

- **Pricing:** Free tier at 1,000 calls/month, paid plans for higher volume.
- **Pros:** Optimized for AI consumption (returns clean extracted content, not just snippets), includes full page content extraction, simple integration, purpose-built for this exact use case.
- **Cons:** Smaller company with less track record, pricing could change, adds a dependency on a niche provider, less control over result ranking.

## Decision: Tavily

We went with Tavily (Option D) because we secured a free account. Key advantages:

1. **AI-optimized output.** Returns clean extracted content and an AI-generated answer summary alongside search results — ideal for LLM consumption.
2. **Simple API.** Single POST endpoint, API key in the request body. Just a `fetch` call from a Worker.
3. **Free tier.** 1,000 calls/month on the free plan covers early-stage usage.
4. **Pairs well with `read_url`.** The search-then-read pattern works: search for results, then call `read_url` on the most relevant URLs for full content.

The `TAVILY_API_KEY` secret is stored in Cloudflare.

## Implementation

The tool lives in `web/server/lib/tools.ts` alongside the existing tools, gated behind the extras dropdown (`extras.has("web_search")`). It uses a POST request to `https://api.tavily.com/search` with `include_answer: true` for an AI-generated summary.

The `TAVILY_API_KEY` secret is set in Cloudflare (not in `wrangler.jsonc`). The tool is only registered when the key is present.

### Frontend

- Extra tool toggle in `ChatInput.tsx` with a search icon.
- `TOOL_LABELS` entry in `ToolCallCard.tsx` renders results in the existing collapsible card.
