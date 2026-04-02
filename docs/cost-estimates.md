# Cost Estimates & Ad Revenue Opportunity

## Per-User Cost Breakdown

All user-facing models are Workers AI models, making inference the dominant but
still low cost. Infrastructure costs (Durable Objects, D1) are negligible at
~$0.002/user/month combined.

### Free Tier (20 msgs/day)

| Model tier | Cost/user/month | Notes |
|------------|----------------:|-------|
| Default (GLM 4.7 Flash) | ~$0.02 | Cheapest path |
| Mid-size (Kimi K2.5, Llama 4 Scout) | ~$0.02 | Similar pricing tier |
| 120B models (GPT-OSS, Nemotron) | ~$0.39 | 18x more expensive |

### Pro Tier (unlimited msgs, Kimi K2.5 example)

| Usage profile | Msgs/day | Cost/user/month |
|--------------|----------|----------------:|
| Casual | 30 | ~$0.04 |
| Regular | 70 | ~$0.11 |
| Power user | 200 | ~$0.51 |
| Degenerate | 500+ | ~$1.95 |

### History Trimming (implemented)

Conversation history is trimmed to a sliding window of ~12k tokens (~48k
characters) before each API call. Older messages beyond this budget are dropped,
keeping the most recent exchanges. This caps per-message input cost at ~12k
tokens regardless of conversation length, making total conversation cost
**linear** (O(n)) instead of quadratic.

| Message # in conversation | Approx input tokens | Cost at $0.01/M |
|--------------------------|--------------------:|----------------:|
| 1 | 500 | $0.000005 |
| 10 | 6,500 | $0.000065 |
| 50 | 12,000 (capped) | $0.00012 |
| 100 | 12,000 (capped) | $0.00012 |
| 500 | 12,000 (capped) | $0.00012 |

Long conversations no longer pose a runaway cost risk. A future improvement
could summarize dropped messages to preserve context.

## Ad Revenue Opportunity

### Viable Options

**1. Contextual sponsor slots (best fit)**

A single sponsor banner in the sidebar or between conversations, served by
developer-focused ad networks like Carbon Ads or EthicalAds. These respect
privacy (no tracking cookies) and fit the utilitarian design.

- Developer-audience CPMs: $2-5
- No user data sharing required
- Low implementation effort

**2. Rewarded ads for bonus messages**

Show a skippable sponsor message when the 20-message limit is hit in exchange
for 1-3 bonus messages. Creates a "rewarded ad" model that reinforces the
upgrade funnel rather than undermining it.

**3. Model provider partnerships**

Model providers may pay for default-model placement or branding. B2B deal, not
traditional ads.

### Poor Fits (avoid)

- **Display ad networks (AdSense):** clutters the UI, damages premium feel
- **In-chat ads:** destroys trust immediately
- **Behavioral tracking:** conflicts with EU data residency stance

### Revenue Estimates

| Free DAU | Ad format | Est. monthly revenue |
|---------:|-----------|---------------------:|
| 1,000 | Carbon Ads sidebar | ~$450 |
| 10,000 | Carbon Ads sidebar | ~$4,500 |
| 1,000 | Rewarded (limit hit) | ~$150-300 |
| 10,000 | Rewarded (limit hit) | ~$1,500-3,000 |

### Break-Even Analysis

Free users cost ~$0.02-0.39/month depending on model choice. At 1,000 free DAU:

- Total free-user cost: $20-390/month
- Carbon Ads revenue: ~$450/month
- **Ad revenue covers free-tier costs at ~1,000+ DAU on default models**

The free tier's primary value remains as a conversion funnel to Pro, not as an
ad-revenue source. Ads are a supplement, not a strategy.
