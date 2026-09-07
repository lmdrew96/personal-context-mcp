export type ClaudeIdentity = {
  name: string;
  role: string;
  home: string;
  access: string;
  blurb: string;
};

/** Annotated form returned by pctx_get_context — `self` marks the calling identity. */
export type AnnotatedClaudeIdentity = ClaudeIdentity & { self?: boolean };

export type FactCategory =
  | "linguistic"
  | "academic"
  | "health"
  | "technical"
  | "biographical";

export type FactConfidence =
  | "measured"
  | "reported"
  | "self-identified"
  | "inferred";

export type Fact = {
  /** Unique handle — facts are addressed by label in the CRUD tools. */
  label: string;
  category: FactCategory;
  content: string;
  /** Where the fact came from, e.g. "Praat/parselmouth analysis of own recordings". */
  source?: string;
  /** REQUIRED. "YYYY-MM" or "YYYY-MM-DD". Undated facts rot invisibly. */
  established: string;
  confidence?: FactConfidence;
};

export type Relationship = {
  /** Canonical name. This is the key — add/update/delete address people by it. */
  name: string;
  role: string;
  /**
   * What the user actually calls them ("NugBug", "Xay"). Recognition, not
   * decoration: the user says the nickname and Claude has to land on the right
   * person. NOT an addressing key — see `name`.
   */
  nicknames?: string[];
  /**
   * Free text ("he/him", "she/they"). Absent means UNKNOWN, not neutral —
   * the signal to ask rather than infer from the name.
   */
  pronouns?: string;
  /** Institution or org, e.g. "UD, Dept. of Linguistics & Cognitive Science". */
  affiliation?: string;
  /** When the relationship started. Same format as Fact.established. */
  established?: string;
  context?: string;
};

export type PersonalContext = {
  /** The human this context belongs to. (Named `user` to disambiguate from `claudeIdentities`.) */
  user: {
    name: string;
    pronouns?: string;
    communicationStyle?: string;
  };
  claudeIdentities: ClaudeIdentity[];
  facts: Fact[];
  relationships: Relationship[];
};

export const FACT_CATEGORIES: FactCategory[] = [
  "linguistic",
  "academic",
  "health",
  "technical",
  "biographical",
];

export const FACT_CONFIDENCES: FactConfidence[] = [
  "measured",
  "reported",
  "self-identified",
  "inferred",
];

export const DEFAULT_CONTEXT: PersonalContext = {
  user: {
    name: "",
    pronouns: "",
    communicationStyle: "",
  },
  claudeIdentities: [],
  facts: [],
  relationships: [],
};

/** Lightweight projection returned by depth='summary'. */
export type ContextSummary = Omit<PersonalContext, "facts" | "relationships"> & {
  facts: Pick<Fact, "label" | "category">[];
  relationships: Pick<Relationship, "name" | "role" | "nicknames" | "pronouns" | "affiliation">[];
};

// ── Legacy shapes (read-side migration only) ─────────────────────────────────

/** Pre-3.0 blob: `identity` instead of `user`, a project inventory, a single
 *  customInstructions string, and a `preferences` list. `identity` is renamed
 *  on read; the rest are stripped. */
export type LegacyPersonalContext = {
  identity?: PersonalContext["user"];
  projects?: unknown[];
  customInstructions?: string;
  preferences?: string[];
};

export type LegacyRelationship = {
  name: string;
  role: string;
};
