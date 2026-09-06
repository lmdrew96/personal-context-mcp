import type { PersonalContext, ContextSummary } from "./types";

/**
 * Strip a PersonalContext down to lightweight summary form.
 * Facts → { label, category } only (no content, no source).
 * Relationships → { name, role } only.
 * Everything else passes through unchanged.
 */
export const summarizeContext = (ctx: PersonalContext): ContextSummary => ({
  ...ctx,
  facts: ctx.facts.map(({ label, category }) => ({ label, category })),
  relationships: ctx.relationships.map(({ name, role }) => ({ name, role })),
});

/**
 * Accept either a bare token or a full MCP/context URL.
 *
 * The GUI hands out a URL ("…/mcp?token=UUID") but the load field wanted a bare
 * token, and pasting the URL silently produced `?token=https://…/mcp?` — a key
 * that misses in Redis and renders as a perfectly valid empty context. Parse
 * both forms rather than failing quietly.
 */
export const parseContextToken = (raw: string): string | null => {
  const input = raw.trim();
  if (!input) return null;

  const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (UUID.test(input)) return input.toLowerCase();

  // Any URL-ish input: pull the LAST token= value, since a pasted MCP URL
  // nested inside another query string yields two of them.
  const matches = [...input.matchAll(/[?&]token=([^&\s]+)/g)];
  if (matches.length) {
    const candidate = decodeURIComponent(matches[matches.length - 1][1]);
    if (UUID.test(candidate)) return candidate.toLowerCase();
  }
  return null;
};
