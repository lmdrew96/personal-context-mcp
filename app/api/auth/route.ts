import {
  getAccount, putAccount, hashPassword, verifyPassword, normalizeEmail, isValidEmail,
  createSession, destroySession, readCookie, requireAccount, sessionCookie, clearedCookie,
  isRateLimited, clearRateLimit, clientIp, claimToken, SESSION_COOKIE, MIN_PASSWORD_LENGTH,
  type Account,
} from "@/lib/auth";
import { setContext } from "@/lib/storage";
import { DEFAULT_CONTEXT } from "@/lib/types";

// PBKDF2 at 600k iterations is deliberate CPU work — more than the edge runtime
// is meant to do. The MCP and context routes stay on edge.
export const runtime = "nodejs";

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
const fail = (message: string, status = 400, headers?: HeadersInit) =>
  Response.json({ error: message }, { status, headers });

/** Never reveal whether an email exists — same message for both failure modes. */
const BAD_CREDENTIALS = "Email or password is incorrect.";

const publicAccount = (a: Account) => ({ email: a.email, contextToken: a.contextToken, createdAt: a.createdAt });

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Malformed request body.");
  }

  const action = String(body.action ?? "");
  const ip = clientIp(req);

  // ── me ─────────────────────────────────────────────────────────────────────
  if (action === "me") {
    const account = await requireAccount(req);
    if (!account) return json({ account: null });
    return json({ account: publicAccount(account) });
  }

  // ── logout ─────────────────────────────────────────────────────────────────
  if (action === "logout") {
    await destroySession(readCookie(req, SESSION_COOKIE));
    return json({ ok: true }, { headers: { "Set-Cookie": clearedCookie() } });
  }

  // ── signup / login ─────────────────────────────────────────────────────────
  if (action !== "signup" && action !== "login") return fail(`Unknown action: ${action}`);

  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");

  if (!isValidEmail(email)) return fail("That doesn't look like an email address.");

  // Throttle by IP for both actions, and additionally by email on login.
  if (await isRateLimited(`${action}:ip`, ip, action === "signup" ? 5 : 20, 900)) {
    return fail("Too many attempts. Wait 15 minutes and try again.", 429);
  }

  if (action === "signup") {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (await getAccount(email)) {
      // An account exists. Say so plainly — signup is not a credential oracle
      // worth protecting here, and a vague error would just strand the user.
      return fail("An account with that email already exists. Log in instead.", 409);
    }

    const { passwordHash, salt, iterations, hash } = await hashPassword(password);
    const contextToken = crypto.randomUUID();
    const account: Account = {
      email, passwordHash, salt, iterations, hash, contextToken,
      createdAt: new Date().toISOString(),
    };

    // Seed an empty context so the token resolves, then record ownership.
    await setContext(contextToken, { ...DEFAULT_CONTEXT });
    await claimToken(contextToken, email);
    await putAccount(account);

    const sid = await createSession(email);
    return json({ account: publicAccount(account) }, { headers: { "Set-Cookie": sessionCookie(sid) } });
  }

  // login
  if (await isRateLimited("login:email", email, 8, 900)) {
    return fail("Too many attempts for this account. Wait 15 minutes and try again.", 429);
  }
  const account = await getAccount(email);
  if (!account) return fail(BAD_CREDENTIALS, 401);
  if (!(await verifyPassword(account, password))) return fail(BAD_CREDENTIALS, 401);

  await clearRateLimit("login:email", email);
  const sid = await createSession(email);
  return json({ account: publicAccount(account) }, { headers: { "Set-Cookie": sessionCookie(sid) } });
}
