export type ClaudeIdentity = {
  name: string;
  role: string;
  home: string;
  access: string;
  blurb: string;
};

export type PersonalContext = {
  identity: {
    name: string;
    pronouns?: string;
    communicationStyle?: string;
  };
  claudeIdentities: ClaudeIdentity[];
  projects: {
    name: string;
    description: string;
    status: string;
  }[];
  relationships: {
    name: string;
    role: string;
  }[];
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
