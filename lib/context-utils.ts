import type { PersonalContext } from "./types";

/**
 * Strip a PersonalContext down to lightweight summary form.
 * Projects → { name, status } only.
 * Relationships → { name, role } only.
 * Everything else passes through unchanged.
 */
export const summarizeContext = (ctx: PersonalContext): PersonalContext => ({
  ...ctx,
  projects: ctx.projects.map(({ name, status }) => ({
    name,
    summary: "",
    status,
  })),
  relationships: ctx.relationships.map(({ name, role }) => ({
    name,
    role,
  })),
});
