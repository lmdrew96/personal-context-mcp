import { Redis } from "@upstash/redis";

/**
 * Account auth for the editor GUI only.
 *
 * The /mcp endpoint deliberately stays token-authenticated with no login — any
 * connected Claude holds only the URL, and putting a session in front of it
 * would break every existing connection and the portability the project is
 * built on. An account is a convenience wrapper that remembers which context
 * token is yours; it is not a second access layer over the data.
 */

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── Key space (everything under pctx:) ───────────────────────────────────────
const accountKey = (email: string) => `pctx:account:${email}`;
const sessionKey = (sid: string) => `pctx:session:${sid}`;
const ownerKey = (contextToken: string) => `pctx:tokenowner:${contextToken}`;
const rateKey = (scope: string, id: string) => `pctx:rl:${scope}:${id}`;

export const SESSION_COOKIE = "pctx_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Stored in the record so the cost can be raised later without breaking old hashes. */
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH = "SHA-256";
const SALT_BYTES = 16;
const KEY_BYTES = 32;

export const MIN_PASSWORD_LENGTH = 10;

export type Account = {
  email: string;
  passwordHash: string; // base64
  salt: string; // base64
  iterations: number;
  hash: string; // e.g. "SHA-256"
  contextToken: string;
  createdAt: string;
};

// ── Encoding helpers ─────────────────────────────────────────────────────────

const toB64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

const fromB64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const randomB64Url = (bytes: number): string => {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return toB64(buf.buffer).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Constant-time comparison — never short-circuit on the first differing byte. */
const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

// ── Password hashing (Web Crypto PBKDF2) ─────────────────────────────────────

const derive = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
  hash: string
): Promise<ArrayBuffer> => {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash },
    keyMaterial,
    KEY_BYTES * 8
  );
};

export const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await derive(password, salt, PBKDF2_ITERATIONS, PBKDF2_HASH);
  return {
    passwordHash: toB64(bits),
    salt: toB64(salt.buffer),
    iterations: PBKDF2_ITERATIONS,
    hash: PBKDF2_HASH,
  };
};

export const verifyPassword = async (account: Account, password: string): Promise<boolean> => {
  const bits = await derive(
    password,
    fromB64(account.salt),
    account.iterations ?? PBKDF2_ITERATIONS,
    account.hash ?? PBKDF2_HASH
  );
  return timingSafeEqual(new Uint8Array(bits), fromB64(account.passwordHash));
};

// ── Email ────────────────────────────────────────────────────────────────────

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ── Accounts ─────────────────────────────────────────────────────────────────

export const getAccount = (email: string) => redis.get<Account>(accountKey(email));

export const putAccount = (account: Account) => redis.set(accountKey(account.email), account);

/** Which account owns a context token, if any. Unowned tokens stay URL-accessible. */
export const getTokenOwner = (contextToken: string) => redis.get<string>(ownerKey(contextToken));

export const claimToken = (contextToken: string, email: string) =>
  redis.set(ownerKey(contextToken), email);

export const releaseToken = (contextToken: string) => redis.del(ownerKey(contextToken));

// ── Sessions (opaque random ids, revocable, no signing secret needed) ────────

export const createSession = async (email: string): Promise<string> => {
  const sid = randomB64Url(32);
  await redis.set(sessionKey(sid), email, { ex: SESSION_TTL_SECONDS });
  return sid;
};

export const readSession = async (sid: string | undefined): Promise<string | null> => {
  if (!sid) return null;
  return (await redis.get<string>(sessionKey(sid))) ?? null;
};

export const destroySession = async (sid: string | undefined): Promise<void> => {
  if (sid) await redis.del(sessionKey(sid));
};

export const sessionCookie = (sid: string) =>
  `${SESSION_COOKIE}=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;

export const clearedCookie = () =>
  `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

export const readCookie = (req: Request, name: string): string | undefined => {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
};

/** Resolve the signed-in account from the request cookie, or null. */
export const requireAccount = async (req: Request): Promise<Account | null> => {
  const email = await readSession(readCookie(req, SESSION_COOKIE));
  if (!email) return null;
  return (await getAccount(email)) ?? null;
};

// ── Rate limiting ────────────────────────────────────────────────────────────

/**
 * Hash the identifier so raw IP addresses never become Redis key names.
 * The scope stays readable (`pctx:rl:login:ip:…`) so these keys are still
 * self-explanatory when you're looking at the store directly.
 */
const rateId = async (id: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return toB64(digest).replace(/[+/=]/g, "").slice(0, 22);
};

/** Returns true when the caller is over budget. Fails OPEN if Redis errors. */
export const isRateLimited = async (
  scope: string,
  id: string,
  max: number,
  windowSeconds: number
): Promise<boolean> => {
  try {
    const k = rateKey(scope, await rateId(id));
    const n = await redis.incr(k);
    if (n === 1) {
      await redis.expire(k, windowSeconds);
    } else if ((await redis.ttl(k)) < 0) {
      // INCR created the key but the EXPIRE never landed (a transient Redis
      // error on the first request). Without this the counter never resets and
      // the caller is locked out of login permanently.
      await redis.expire(k, windowSeconds);
    }
    return n > max;
  } catch {
    return false;
  }
};

export const clearRateLimit = async (scope: string, id: string) =>
  redis.del(rateKey(scope, await rateId(id)));

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
