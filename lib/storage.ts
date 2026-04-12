import { Redis } from "@upstash/redis";
import {
  PersonalContext,
  DEFAULT_CONTEXT,
  Project,
  ProjectStatus,
  Relationship,
  LegacyProject,
  LegacyRelationship,
} from "./types";

const redis = new Redis({
  url: process.env.CONTEXT_KV_REST_API_URL!,
  token: process.env.CONTEXT_KV_REST_API_TOKEN!,
});

const key = (token: string) => `pctx:${token}`;

// ── Migration helpers ────────────────────────────────────────────────────────

const VALID_STATUSES: ProjectStatus[] = ["active", "paused", "concept", "archived"];

/** Parse a freeform legacy status string into a structured status + currentFocus. */
const parseStatus = (raw: string): { status: ProjectStatus; currentFocus?: string } => {
  const lower = raw.toLowerCase();
  for (const s of VALID_STATUSES) {
    if (lower.startsWith(s) || lower.includes(s)) {
      // Everything after the status keyword (strip leading punctuation/whitespace)
      const rest = raw.replace(new RegExp(`.*?${s}`, "i"), "").replace(/^[\s—–\-:,]+/, "").trim();
      return { status: s, currentFocus: rest || undefined };
    }
  }
  return { status: "active", currentFocus: raw.trim() || undefined };
};

/** Detect whether a project object is legacy format (has `description`, no `summary`). */
const isLegacyProject = (p: Record<string, unknown>): p is LegacyProject =>
  typeof p.description === "string" && !("summary" in p);

/** Detect whether a relationship has a long role that should be split into role + context. */
const isLegacyRelationship = (r: Record<string, unknown>): r is LegacyRelationship =>
  typeof r.role === "string" && !("context" in r);

/** Migrate a legacy project to the new schema. */
const migrateProject = (p: LegacyProject): Project => {
  const { status, currentFocus } = parseStatus(p.status);
  return {
    name: p.name,
    summary: p.description,
    status,
    currentFocus,
  };
};

/** Migrate a legacy relationship — split long roles into role + context. */
const migrateRelationship = (r: LegacyRelationship): Relationship => {
  const role = r.role.trim();
  // Short roles (under ~60 chars with no sentence structure) stay as-is
  if (role.length < 60 && !role.includes(". ") && !role.includes("\n")) {
    return { name: r.name, role };
  }
  // Split on first sentence boundary or dash
  const splitMatch = role.match(/^([^.!?\n—]+)[.!?\n—]\s*([\s\S]*)$/);
  if (splitMatch) {
    return {
      name: r.name,
      role: splitMatch[1].trim(),
      context: splitMatch[2].trim() || undefined,
    };
  }
  // Fallback: entire string as role (it's long but no clear split point)
  return { name: r.name, role };
};

/** Migrate an entire context blob if it contains legacy-format data. */
const migrateContext = (raw: Record<string, unknown>): PersonalContext => {
  const ctx = raw as PersonalContext;

  // Migrate projects if any are legacy format
  if (Array.isArray(ctx.projects) && ctx.projects.length > 0 && isLegacyProject(ctx.projects[0] as Record<string, unknown>)) {
    ctx.projects = (ctx.projects as unknown as LegacyProject[]).map(migrateProject);
  }

  // Migrate relationships if any are legacy format
  if (Array.isArray(ctx.relationships) && ctx.relationships.length > 0 && isLegacyRelationship(ctx.relationships[0] as Record<string, unknown>)) {
    ctx.relationships = (ctx.relationships as unknown as LegacyRelationship[]).map(migrateRelationship);
  }

  return ctx;
};

// ── Public API ───────────────────────────────────────────────────────────────

export async function getContext(token: string): Promise<PersonalContext> {
  const stored = await redis.get<Record<string, unknown>>(key(token));
  if (!stored) return { ...DEFAULT_CONTEXT };
  return migrateContext(stored);
}

export async function setContext(token: string, ctx: PersonalContext): Promise<void> {
  await redis.set(key(token), ctx);
}

export async function patchContext(token: string, patch: Partial<PersonalContext>): Promise<PersonalContext> {
  const current = await getContext(token);
  const updated: PersonalContext = { ...current, ...patch };
  await setContext(token, updated);
  return updated;
}
