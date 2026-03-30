import { kv } from "@vercel/kv";
import { PersonalContext, DEFAULT_CONTEXT } from "./types";

const KEY = "personal_context";

export async function getContext(): Promise<PersonalContext> {
  const stored = await kv.get<PersonalContext>(KEY);
  return stored ?? { ...DEFAULT_CONTEXT };
}

export async function setContext(ctx: PersonalContext): Promise<void> {
  await kv.set(KEY, ctx);
}

export async function patchContext(patch: Partial<PersonalContext>): Promise<PersonalContext> {
  const current = await getContext();
  const updated: PersonalContext = { ...current, ...patch };
  await setContext(updated);
  return updated;
}
