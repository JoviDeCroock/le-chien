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