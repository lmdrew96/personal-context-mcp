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
