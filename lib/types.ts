export type ClaudeIdentity = {
  name: string;
  role: string;
  home: string;
  access: string;
  blurb: string;
};

export type ProjectStatus = "active" | "paused" | "concept" | "archived";

export type Project = {
  name: string;
  slug?: string;
  url?: string;
  summary: string;
  stack?: string[];
  architecture?: string;
  status: ProjectStatus;
  currentFocus?: string;
};

export type Relationship = {
  name: string;
  role: string;
  context?: string;
};

export type PersonalContext = {
  identity: {
    name: string;
    pronouns?: string;
    communicationStyle?: string;
  };
  claudeIdentities: ClaudeIdentity[];
  projects: Project[];
  relationships: Relationship[];
  preferences: string[];
  customInstructions: string;
};

export const DEFAULT_CONTEXT: PersonalContext = {
  identity: {
    name: "",
    pronouns: "",
    communicationStyle: "",
  },
  claudeIdentities: [],
  projects: [],
  relationships: [],
  preferences: [],
  customInstructions: "",
};

// ── Legacy types (for migration) ─────────────────────────────────────────────

export type LegacyProject = {
  name: string;
  description: string;
  status: string;
};

export type LegacyRelationship = {
  name: string;
  role: string;
};

export type LegacyPersonalContext = {
  identity: PersonalContext["identity"];
  claudeIdentities: ClaudeIdentity[];
  projects: LegacyProject[];
  relationships: LegacyRelationship[];
  preferences: string[];
  customInstructions: string;
};
