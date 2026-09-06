import { Redis } from "@upstash/redis";
import {
  PersonalContext,
  DEFAULT_CONTEXT,
  Relationship,
  LegacyPersonalContext,
  LegacyRelationship,
} from "./types";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const key = (token: string) => `pctx:${token}`;

// ── Migration helpers ────────────────────────────────────────────────────────

/** Detect whether a relationship has a long role that should be split into role + context. */
const isLegacyRelationship = (r: Record<string, unknown>): r is LegacyRelationship =>
  typeof r.role === "string" && !("context" in r);

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

/**
 * Normalise a stored blob into the current schema.
 *
 * Pre-2.0 blobs carried `identity` (renamed to `user`), a `projects` inventory
 * that duplicated ChaosPatch, and a single `customInstructions` string. The
 * first is renamed, the other two are dropped — the durable content of
 * customInstructions was migrated into `facts` by hand. Because getContext runs
 * this on every read, the next write persists the cleaned shape.
 */
const migrateContext = (raw: Record<string, unknown>): PersonalContext => {
  const legacy = raw as LegacyPersonalContext;
  const { identity: _identity, projects: _projects, customInstructions: _ci, ...rest } =
    raw as Record<string, unknown> & LegacyPersonalContext;

  const ctx: PersonalContext = {
    ...DEFAULT_CONTEXT,
    ...(rest as Partial<PersonalContext>),
    user: (rest as Partial<PersonalContext>).user ?? legacy.identity ?? DEFAULT_CONTEXT.user,
    claudeIdentities: (rest as Partial<PersonalContext>).claudeIdentities ?? [],
    facts: (rest as Partial<PersonalContext>).facts ?? [],
    relationships: (rest as Partial<PersonalContext>).relationships ?? [],
    preferences: (rest as Partial<PersonalContext>).preferences ?? [],
  };

  // Migrate relationships if any are legacy format
  if (ctx.relationships.length > 0 && isLegacyRelationship(ctx.relationships[0] as unknown as Record<string, unknown>)) {
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

/** Does a context blob actually exist for this token? Guards against linking a typo. */
export async function contextExists(token: string): Promise<boolean> {
  return (await redis.exists(key(token))) === 1;
}
