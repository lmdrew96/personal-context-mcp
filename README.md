# Personal Context MCP

A lightweight MCP (Model Context Protocol) server that stores and serves user context — who you are, dated facts about you, relationships, and the Claude identities you work with — so Claude instances across multiple apps share awareness of who you are.

## What It Does

Personal Context MCP gives any Claude instance persistent knowledge about you. Instead of re-explaining your background, history, and relationships every session, you point Claude at your PCTX URL and it loads everything automatically.

It deliberately stores only what nothing else holds. Project state lives in [ChaosPatch](https://chaospatch.adhdesigns.dev), which is authoritative and stays current because it's used daily; a second copy here would rot, and stale context is worse than absent context because it gets injected and believed.

### Facts

The core of the store is a `facts` array — durable things about you that aren't reconstructible from a codebase or a task tracker (a measured dialect profile, academic standing, a diagnosis).

```ts
{
  label:       string   // "Dialect profile" — the handle facts are addressed by
  category:    "linguistic" | "academic" | "health" | "technical" | "biographical"
  content:     string
  source?:     string   // "Praat/parselmouth analysis of own recordings"
  established: string   // "2026-08" — REQUIRED
  confidence?: "measured" | "reported" | "self-identified" | "inferred"
}
```

`established` is required because undated facts rot invisibly — a date makes staleness self-announcing. `confidence` exists because a *measured* formant analysis and a *self-identified* diagnosis are not the same kind of claim, and flattening them into one paragraph loses that.

**Primary consumer:** Coru on [claude.ai](https://claude.ai), for planning and cross-project strategy.

**Also works with:** Claude Desktop, Claude Code, or any Anthropic API call using the `mcp_servers` parameter.

## Stack

- **Next.js 16** (App Router) — Vercel deployment
- **TypeScript**
- **Upstash Redis** — serverless key-value storage
- **MCP over HTTP** (SSE transport)

## MCP Tools

All tools use the `pctx_` prefix:

| Tool | Description |
|------|-------------|
| `pctx_get_context` | Retrieve context. `depth='summary'` returns fact labels + categories only |
| `pctx_update_context` | Replace top-level fields wholesale (`user`, `facts`, `relationships`, …) |
| `pctx_add_fact` | Record a durable dated fact |
| `pctx_update_fact` | Update a fact by label |
| `pctx_delete_fact` | Remove a fact by label |
| `pctx_add_relationship` | Add a person to relationships |
| `pctx_update_relationship` | Update a relationship entry |
| `pctx_delete_relationship` | Remove a relationship |
| `pctx_add_claude_identity` | Register a Claude identity |
| `pctx_update_claude_identity` | Update a Claude identity |
| `pctx_delete_claude_identity` | Remove a Claude identity |

## Claude identities

`claudeIdentities` is one flat array with the same shape on read and write. Tell the
server which identity is calling — either `?name=Coru` on the URL or an
`X-Claude-Identity` header — and that entry comes back marked `self: true`. An
unrecognised name is appended as an `unregistered` entry rather than silently dropped.

## Setup

1. Clone the repo
2. Copy `.env.local.example` to `.env.local` and add your Upstash credentials:
   ```
   UPSTASH_REDIS_REST_URL=your-url
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```
3. `npm install`
4. `npm run dev`

## Connecting Claude

### Claude Desktop / Claude Code
Add the MCP server URL to your configuration:
```json
{
  "type": "url",
  "url": "https://your-deployment.vercel.app/mcp",
  "name": "personal-context"
}
```

### Anthropic API
Pass it in the `mcp_servers` parameter:
```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-5",
  mcp_servers: [
    { type: "url", url: "https://your-deployment.vercel.app/mcp", name: "personal-context" }
  ],
  // ...
});
```

## Part of the Chaos Ecosystem

Built by [ADHDesigns](https://adhdesigns.dev) as part of the Chaos suite of tools for neurodivergent developers and learners.
