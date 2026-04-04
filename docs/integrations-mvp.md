# MVP Integrations

## Goal

The first integration set should make the workspace useful as both:

- a source of truth for team context
- a place to take actions safely from chat

The bar for MVP integrations is not "large ecosystem coverage". The bar is
"high-frequency systems our first users already live in".

## Initial MVP Scope

We intend to support the following integrations in the initial MVP:

### 1. Notion

Why it matters:

- common home for team docs, specs, notes, and operating context
- strong fit with workspace memory and retrieval
- useful for both individuals and small teams

Initial capabilities:

- connect a Notion workspace
- search pages and databases from chat
- retrieve page content as context for answers
- create new pages from assistant output
- update existing pages after explicit user approval

### 2. Slack

Why it matters:

- core communication layer for many small teams
- high-value source of recent context, decisions, and requests
- natural destination for assistant-generated updates

Initial capabilities:

- connect a Slack workspace
- search channels and threads the user has access to
- summarize conversations and decisions
- draft messages and status updates
- post messages after explicit user approval

### 3. Gmail

Why it matters:

- email remains a primary system of record for operators and founders
- high leverage for summarization, follow-up, and drafting

Initial capabilities:

- connect a Gmail account
- search inbox and recent threads
- summarize threads inside chat
- draft replies and follow-ups
- send emails after explicit user approval

### 4. Google Calendar

Why it matters:

- makes the assistant operational, not just informative
- complements Gmail for meeting prep and follow-through

Initial capabilities:

- connect a Google Calendar account
- read upcoming events and availability
- summarize meeting schedules and prep context
- create events after explicit user approval
- update event details after explicit user approval

### 5. Sentry

Why it matters:

- directly useful for developer and product teams
- makes debugging and incident triage materially faster

Initial capabilities:

- connect a Sentry organization
- search issues, alerts, and recent regressions
- summarize error trends and likely impact
- fetch issue details into chat context
- create issue comments after explicit user approval

### 6. PostHog

Why it matters:

- complements Sentry with product and behavior context
- strong fit for founders and AI-native operators

Initial capabilities:

- connect a PostHog project
- query events, trends, and funnels
- summarize feature usage and drop-off
- investigate spikes or regressions from chat
- support MCP-based access where appropriate

## Product Rules

These integrations should follow the same interaction model as the rest of the
product:

- retrieval should be visible
- mutating actions should require approval
- access should respect the connected account's permissions
- tool calls should be inspectable in chat
- workspace admins should be able to manage shared integrations cleanly

## Prioritization

Recommended implementation order:

1. Notion
2. Slack
3. Gmail and Google Calendar
4. Sentry
5. PostHog

Rationale:

- Notion and Slack provide the highest-value shared context
- Gmail and Calendar make the assistant useful for day-to-day operator work
- Sentry and PostHog are especially strong for the initial developer-heavy audience

## Proton Ecosystem

We should not treat Proton as an initial MVP integration.

Current recommendation:

- keep Proton in a phase 2 or partner-led bucket
- revisit once there is a stable and clearly documented public integration surface

Why:

- Proton Mail access is possible in some cases through Proton Mail Bridge or
  SMTP submission, but those are not equivalent to a standard cloud OAuth
  integration
- Proton Calendar appears friendlier to import/export and subscription flows
  than to a normal third-party app integration model
- Proton Drive and the rest of the ecosystem do not currently present a clear,
  public developer surface comparable to Google, Slack, Notion, Sentry, or
  PostHog

Implication:

- if we support Proton early, it should likely be framed as experimental
- a full first-class integration should wait for either an official public API
  path or a direct partnership route
