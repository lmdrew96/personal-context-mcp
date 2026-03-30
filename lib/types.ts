export type PersonalContext = {
  identity: {
    name: string;
    pronouns?: string;
    communicationStyle?: string;
  };
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
  projects: [],
  relationships: [],
  preferences: [],
  customInstructions: "",
};
