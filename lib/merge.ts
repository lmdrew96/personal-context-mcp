import type { PersonalContext, Fact, Relationship, ClaudeIdentity } from "./types";

/**
 * Linking an existing context token to an account.
 *
 * If the account's own context is empty (the normal case — you just signed up
 * and want to adopt the token you already had), the link is a straight adoption.
 * If BOTH sides hold data, we refuse to guess: non-overlapping items always
 * merge, but anything present on both sides with different content is reported
 * as a conflict for the user to resolve explicitly.
 */

export type ConflictSide = "account" | "token";

export type Conflict = {
  collection: "user" | "facts" | "relationships" | "claudeIdentities";
  /** Stable identifier used as the resolution key: fact label, person name, identity name, or "user". */
  key: string;
  account: unknown;
  token: unknown;
};

export type LinkPlan = {
  /** True when neither side would lose anything — safe to apply without prompting. */
  clean: boolean;
  accountIsEmpty: boolean;
  conflicts: Conflict[];
  /** Counts of items that merge with no ambiguity. */
  additions: {
    fromAccount: { facts: string[]; relationships: string[]; claudeIdentities: string[] };
    fromToken: { facts: string[]; relationships: string[]; claudeIdentities: string[] };
  };
};

const norm = (s: string) => s.trim().toLowerCase();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const isEmptyContext = (c: PersonalContext): boolean =>
  !c.user?.name?.trim() &&
  (c.facts?.length ?? 0) === 0 &&
  (c.relationships?.length ?? 0) === 0 &&
  (c.claudeIdentities?.length ?? 0) === 0;

type Keyed<T> = { key: string; item: T };
const index = <T>(items: T[] | undefined, keyOf: (t: T) => string): Map<string, Keyed<T>> => {
  const m = new Map<string, Keyed<T>>();
  for (const item of items ?? []) m.set(norm(keyOf(item)), { key: keyOf(item), item });
  return m;
};

const factKey = (f: Fact) => f.label;
const relKey = (r: Relationship) => r.name;
const idKey = (c: ClaudeIdentity) => c.name;

/** Compare the two contexts without changing anything. */
export const planLink = (account: PersonalContext, token: PersonalContext): LinkPlan => {
  const conflicts: Conflict[] = [];
  const additions: LinkPlan["additions"] = {
    fromAccount: { facts: [], relationships: [], claudeIdentities: [] },
    fromToken: { facts: [], relationships: [], claudeIdentities: [] },
  };

  const collections = [
    { name: "facts" as const, a: index(account.facts, factKey), b: index(token.facts, factKey) },
    { name: "relationships" as const, a: index(account.relationships, relKey), b: index(token.relationships, relKey) },
    { name: "claudeIdentities" as const, a: index(account.claudeIdentities, idKey), b: index(token.claudeIdentities, idKey) },
  ];

  for (const { name, a, b } of collections) {
    for (const [k, { key, item }] of a) {
      const other = b.get(k);
      if (!other) additions.fromAccount[name].push(key);
      else if (!same(item, other.item)) conflicts.push({ collection: name, key, account: item, token: other.item });
    }
    for (const [k, { key }] of b) {
      if (!a.has(k)) additions.fromToken[name].push(key);
    }
  }

  const accountHasUser = !!account.user?.name?.trim();
  const tokenHasUser = !!token.user?.name?.trim();
  if (accountHasUser && tokenHasUser && !same(account.user, token.user)) {
    conflicts.push({ collection: "user", key: "user", account: account.user, token: token.user });
  }

  const accountIsEmpty = isEmptyContext(account);
  return { clean: accountIsEmpty || conflicts.length === 0, accountIsEmpty, conflicts, additions };
};

const resolutionFor = (r: Record<string, ConflictSide>, collection: string, key: string): ConflictSide =>
  r[`${collection}:${norm(key)}`] ?? "token";

/**
 * Apply the merge. Builds on the TOKEN side, because that token survives the
 * link and keeps serving the MCP URL any Claude is already connected to.
 */
export const applyLink = (
  account: PersonalContext,
  token: PersonalContext,
  resolutions: Record<string, ConflictSide> = {}
): PersonalContext => {
  const pick = <T>(
    collection: "facts" | "relationships" | "claudeIdentities",
    a: T[] | undefined,
    b: T[] | undefined,
    keyOf: (t: T) => string
  ): T[] => {
    const ai = index(a, keyOf);
    const bi = index(b, keyOf);
    const out: T[] = [];
    for (const [k, { key, item }] of bi) {
      const mine = ai.get(k);
      if (mine && !same(item, mine.item) && resolutionFor(resolutions, collection, key) === "account") {
        out.push(mine.item);
      } else {
        out.push(item);
      }
    }
    for (const [k, { item }] of ai) if (!bi.has(k)) out.push(item);
    return out;
  };

  const accountHasUser = !!account.user?.name?.trim();
  const tokenHasUser = !!token.user?.name?.trim();
  const user =
    !tokenHasUser ? (accountHasUser ? account.user : token.user)
    : !accountHasUser ? token.user
    : same(account.user, token.user) ? token.user
    : resolutionFor(resolutions, "user", "user") === "account" ? account.user
    : token.user;

  return {
    user,
    claudeIdentities: pick("claudeIdentities", account.claudeIdentities, token.claudeIdentities, idKey),
    facts: pick("facts", account.facts, token.facts, factKey),
    relationships: pick("relationships", account.relationships, token.relationships, relKey),
  };
};
