# Pricing Strategy

## Tiers

### Free ($0)

| Dimension | Limit |
|-----------|-------|
| Messages/day | 20 |
| Premium model messages/day | 5 |
| Image generations/day | 5 |
| Available models | All (premium models gated by premium message limit) |

### Pro ($8/month, or $6/month billed yearly at $72/year)

| Dimension | Limit |
|-----------|-------|
| Messages/day | Unlimited |
| Premium model messages/day | Unlimited |
| Image generations/day | Unlimited |
| Available models | All |

## Why $8/month

- **High margin.** Even a power user on 120B models costs ~$2/month. 75%+ gross margin worst-case.
- **Under $10 threshold.** Feels like casual spend, no approval friction.
- **Undercuts incumbents.** ChatGPT Plus and Claude Pro are $20. We compete on workspace value + open models at a lower price.
- **Yearly discount drives retention.** 25% off ($72/year) is meaningful without destroying unit economics.
- **Room to grow.** A $15-20 "Power" tier can be added later for proprietary model access (OpenAI, Anthropic) without cannibalizing Pro.

## Premium models

Models marked `premium: true` in `server/lib/models.ts` consume premium message quota on the free plan. Currently:

- `kimi-k2.5` (Converser) — conversational, fast
- `gpt-oss-120b` (Pro) — 120B parameter, smart
- `nemotron-3-120b` (Thinker) — 120B parameter, reasoning

Free users get 5 premium messages/day. This is the primary upgrade trigger — trying a premium model and hitting the limit.

## Feature gating approach

We gate by **usage limits**, not by hiding models. Free users can see and try all models, but premium models draw from a separate, smaller daily quota. This creates aspiration: users discover the quality difference and upgrade.

Future feature gates (not yet implemented):
- Workspace count (free: 1 personal, pro: 3+)
- File storage limits
- Conversation history retention
- Search scope

## Break-even math

| Scale | Free users | Pro users | Monthly revenue | Monthly cost | Margin |
|-------|-----------|-----------|-----------------|-------------|--------|
| Early (1K) | 900 | 100 | $800 | ~$50 | 94% |
| Growth (10K) | 8,500 | 1,500 | $12,000 | ~$900 | 92% |
| Scale (50K) | 40,000 | 10,000 | $80,000 | ~$8,000 | 90% |

Ad revenue from Carbon Ads on the free tier ($450-4,500/month at 1-10K DAU) further subsidizes free users. See `cost-estimates.md` for detailed per-user cost breakdowns and ad revenue analysis.

## Polar configuration

Set up a single **Pro** product in Polar at $8/month with a $72/year variant. The `POLAR_PRO_PRODUCT_ID` env var points to this product. The Team tier can wait for real team usage data.
