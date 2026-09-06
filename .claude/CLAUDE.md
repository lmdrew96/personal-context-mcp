# Claude Code Instructions for Personal Context MCP

> Project-specific instructions. General coding conventions, git workflow, communication style, and identity are in the global CLAUDE.md — don't duplicate them here.

## Project Overview

Personal Context MCP (PCTX) is a lightweight MCP server that stores and serves user context — who Nae is, dated facts about her, relationships, preferences, and the Claude identities she works with. It's the persistent memory layer that gives Claude instances across the Chaos ecosystem awareness of who she is.

It deliberately does NOT store project state — ChaosPatch is authoritative for that. A second copy here has no update pressure and rots, and stale context is worse than absent context because it gets injected and believed.

**Primary consumer:** Coru on claude.ai (planning, architecture, cross-project strategy)
**Also used by:** Claude Desktop, Claude Code (via MCP connector), any Anthropic API call with `mcp_servers` param

**Live:** personal-context-mcp.vercel.app
**Repo:** github.com/lmdrew96/personal-context-mcp

---

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Framework** | Next.js 16 (App Router) | Vercel deployment |
| **Language** | TypeScript | Minimal config |
| **Storage** | Upstash Redis (`@upstash/redis`) | Key-value store, serverless-friendly |
| **Protocol** | MCP over HTTP (SSE transport) | Compatible with Anthropic API `mcp_servers` param |

This is intentionally a tiny project — no ORM, no auth library, no UI framework. Just an API route that speaks MCP.

---

## Architecture

### How It Works
1. User owns a PCTX URL (e.g., `personal-context-mcp.vercel.app/mcp`)
2. Any Claude instance can connect to it as an MCP server
3. Claude calls `pctx_get_context` to load the user, facts, relationships and preferences
4. Context is formatted into system prompt prefix for personalization

### Data Model (Upstash Redis)
Stored as JSON per user key. Structure:
```typescript
{
  user: { name, pronouns, communicationStyle },
  claudeIdentities: [{ name, role, home, access, blurb }],
  facts: [{ label, category, content, source?, established, confidence? }],
  relationships: [{ name, role, context? }],
  preferences: string[]
}
```

### MCP Tools
**Tool prefix:** `pctx_`

- `pctx_get_context` — Retrieve full context
- `pctx_update_context` — Replace top-level fields wholesale (user, facts, relationships, …)
- `pctx_add_fact` / `pctx_update_fact` / `pctx_delete_fact` — Fact CRUD (addressed by label)
- `pctx_add_relationship` / `pctx_update_relationship` / `pctx_delete_relationship` — Relationship CRUD
- `pctx_add_claude_identity` / `pctx_update_claude_identity` / `pctx_delete_claude_identity` — Claude identity management

### MCP Route
The MCP endpoint lives in `app/` (Next.js App Router API route). SSE transport.

---

## Key Constraints

- **Auth is GUI-only** — the editor at `/` is behind email + password (own implementation: PBKDF2-HMAC-SHA256 via Web Crypto, opaque session ids in Redis, httpOnly cookie). No Clerk, no JWT.
- **`/mcp` and `/context` stay token-authenticated with no login** — this is load-bearing, not an oversight. Connected Claude instances hold only the URL; putting a session in front of those routes breaks every existing connection and the portability the project exists for. An account is a convenience wrapper that remembers which context token is yours, not a second access layer over the data.
- **Auth routes run on the `nodejs` runtime**, MCP/context stay on `edge` — 600k-iteration PBKDF2 is more CPU than an edge function should do.
- **Thin UI** — `app/page.tsx` is a single-file editor behind the login, for hand-editing context. Everything it does is also doable through MCP tools; keep it that way rather than growing app-specific features into it.
- **Upstash Redis** — serverless, no persistent connections. All reads/writes are HTTP-based. No need to worry about connection pooling.
- **Keep it small** — this project should stay minimal. Resist scope creep. It stores context and serves it. That's it.

---

## Environment Variables

```
UPSTASH_REDIS_REST_URL=       # From Upstash dashboard
UPSTASH_REDIS_REST_TOKEN=     # From Upstash dashboard
```

---

## Build Commands

```bash
npm run dev           # Next.js dev server
npm run build         # Production build
npm run start         # Start production server
```

Note: This project uses **npm**, not pnpm.

---

## Common Issues

| Problem | Solution |
|---------|----------|
| Redis connection fails | Check `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local` |
| MCP tools not appearing in Claude Desktop | Verify the MCP server URL is correct and the SSE endpoint responds |
| Context returns empty | Almost always the wrong token, not lost data. A missing key returns DEFAULT_CONTEXT, which renders as a valid empty context. Verify the token before assuming data loss. |
| Changes not reflecting | Upstash is eventually consistent but usually instant — check for typos in the key |
