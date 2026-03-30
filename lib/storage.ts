import { Redis } from "@upstash/redis";
import { PersonalContext, DEFAULT_CONTEXT } from "./types";

const redis = new Redis({
  url: process.env.CONTEXT_KV_REST_API_URL!,
  token: process.env.CONTEXT_KV_REST_API_TOKEN!,
});

const key = (token: string) => `pctx:${token}`;

export async function getContext(token: string): Promise<PersonalContext> {
  const stored = await redis.get<PersonalContext>(key(token));
  return stored ?? { ...DEFAULT_CONTEXT };
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
