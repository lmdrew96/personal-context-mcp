import { requireAccount, getTokenOwner, claimToken, releaseToken, putAccount } from "@/lib/auth";
import { getContext, setContext, contextExists } from "@/lib/storage";
import { parseContextToken } from "@/lib/context-utils";
import { planLink, applyLink, type ConflictSide } from "@/lib/merge";

export const runtime = "nodejs";

const fail = (message: string, status = 400, extra?: Record<string, unknown>) =>
  Response.json({ error: message, ...extra }, { status });

/**
 * Link an existing context token to the signed-in account.
 *
 * The linked token WINS and becomes the account's context, so the MCP URL any
 * Claude is already connected to keeps working. The account's previous context
 * blob is left in Redis (unowned) rather than deleted — after a merge it is a
 * redundant copy, and deleting it would be the one irreversible step here.
 */
export async function POST(req: Request) {
  const account = await requireAccount(req);
  if (!account) return fail("Not signed in.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Malformed request body.");
  }

  const action = String(body.action ?? "preview");
  if (action !== "preview" && action !== "commit") return fail(`Unknown action: ${action}`);

  const linked = parseContextToken(String(body.token ?? ""));
  if (!linked) return fail("That isn't a valid token or MCP URL. Paste either the token itself or the full URL.");

  if (linked === account.contextToken) return fail("That token is already linked to this account.");

  const owner = await getTokenOwner(linked);
  if (owner && owner !== account.email) return fail("That token belongs to another account.", 403);

  if (!(await contextExists(linked))) {
    return fail("No context exists for that token. Check it and try again.", 404);
  }

  const accountCtx = await getContext(account.contextToken);
  const tokenCtx = await getContext(linked);
  const plan = planLink(accountCtx, tokenCtx);

  if (action === "preview") return Response.json({ plan });

  // commit
  const resolutions = (body.resolutions ?? {}) as Record<string, ConflictSide>;
  if (!plan.clean) {
    const unresolved = plan.conflicts.filter(
      (c) => !(`${c.collection}:${c.key.trim().toLowerCase()}` in resolutions)
    );
    if (unresolved.length) {
      return fail(
        `${unresolved.length} conflict${unresolved.length === 1 ? "" : "s"} still need a decision.`,
        409,
        { plan }
      );
    }
  }

  const merged = plan.accountIsEmpty ? tokenCtx : applyLink(accountCtx, tokenCtx, resolutions);
  await setContext(linked, merged);
  await claimToken(linked, account.email);

  const previous = account.contextToken;
  account.contextToken = linked;
  await putAccount(account);
  if (previous && previous !== linked) await releaseToken(previous);

  return Response.json({
    ok: true,
    contextToken: linked,
    previousToken: previous,
    adopted: plan.accountIsEmpty,
    context: merged,
  });
}
