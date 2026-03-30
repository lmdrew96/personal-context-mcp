import { Redis } from "@upstash/redis";
import { PersonalContext, DEFAULT_CONTEXT } from "./types";

const redis = new Redis({
  url: process.env.CONTEXT_KV_REST_API_URL!,
  token: process.env.CONTEXT_KV_REST_API_TOKEN!,
});

const KEY = "personal_context";

export async function getContext(): Promise<PersonalContext> {
  const stored = await redis.get<PersonalContext>(KEY);
  return stored ?? { ...DEFAULT_CONTEXT };
}

export async function setContext(ctx: PersonalContext): Promise<void> {
  await redis.set(KEY, ctx);
}

export async function patchContext(patch: Partial<PersonalContext>): Promise<PersonalContext> {
  const current = await getContext();
  const updated: PersonalContext = { ...current, ...patch };
  await setContext(updated);
  return updated;
}
