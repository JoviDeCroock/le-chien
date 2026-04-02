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

## Recommendation: Brave Search API

Brave Search is the right choice for le chien because:

1. **Generous free tier.** 2,000 calls/month covers early-stage usage without any cost. That is enough for a meaningful beta period.
2. **Simple API.** Single endpoint, single API key header. No SDKs, no OAuth, no Azure portal. Just a `fetch` call from a Worker.
3. **Good result quality.** Results include title, URL, and description text that the model can work with directly.
4. **No infrastructure.** No self-hosting, no containers, no extra services. A Cloudflare Worker can call Brave Search directly.
5. **Pairs well with `read_url`.** The `read_url` tool already exists in le chien. The model can use a search-then-read pattern: first search for results, then call `read_url` on the most relevant URLs for full content. This gives the model both breadth (search results) and depth (full page text).

### Fallback path

If Brave Search quality is insufficient or pricing becomes unfavorable, Tavily is the natural second choice due to its AI-optimized output. The tool interface would stay the same; only the fetch URL and response parsing would change.

## Implementation Sketch

The tool would live in `api/src/lib/tools.ts` alongside the existing tools. It follows the same `tool()` pattern with a Zod input schema.

```typescript
web_search: tool({
  description: "Search the web for current information. Use this for questions about recent events, products, people, or anything that benefits from up-to-date information.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    count: z.number().optional().default(5).describe("Number of results (1-10)"),
  }),
  execute: async ({ query, count }) => {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      {
        headers: { "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY },
      }
    );
    const data = await res.json();
    return {
      query,
      results: data.web.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      })),
    };
  },
}),
```

### Search-then-read pattern

The model already has access to `read_url`. With `web_search` added, the expected multi-step pattern is:

1. Model calls `web_search` with a query.
2. Model receives a list of results (title, URL, snippet).
3. If the snippets are sufficient, the model answers directly.
4. If the model needs more detail, it calls `read_url` on one or more of the result URLs.
5. Model synthesizes the full content into a response.

This pattern is enabled by `stopWhen: stepCountIs(5)` which already allows multi-step tool chaining.

### Configuration

Add `BRAVE_SEARCH_API_KEY` as a secret in the Worker environment (via `wrangler secret put` or the Cloudflare dashboard). No other configuration needed.

### Frontend

Add an entry to `TOOL_LABELS` in `web/src/components/ToolCallCard.tsx`:

```typescript
web_search: { label: "Web Search", icon: "search" },
```

The tool result (list of search results with titles and URLs) will render in the existing collapsible `ToolCallCard` component. No new UI components needed.
