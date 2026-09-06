import { getContext, patchContext } from "@/lib/storage";
import { summarizeContext } from "@/lib/context-utils";
import {
  PersonalContext,
  AnnotatedClaudeIdentity,
  Fact,
  FactCategory,
  FactConfidence,
  Relationship,
  FACT_CATEGORIES,
  FACT_CONFIDENCES,
} from "@/lib/types";

/** "2026", "2026-08" or "2026-08-14". */
const ESTABLISHED_RE = /^\d{4}(-\d{2}){0,2}$/;

// MCP tool definitions
const TOOLS = [
  {
    name: "pctx_get_context",
    description:
      "Retrieve the personal context: the user, registered Claude identities, dated facts, relationships, and preferences. Use depth='summary' for a lightweight index (fact labels+categories, relationship names+roles). Use depth='full' (default) for everything including fact content, sources and relationship context. In the response, `claudeIdentities` is a flat array and the identity making the request is marked `self: true`.",
    inputSchema: {
      type: "object",
      properties: {
        depth: {
          type: "string",
          enum: ["summary", "full"],
          description:
            "Level of detail. 'summary' returns lightweight fields only (saves tokens). 'full' returns everything. Default: 'full'.",
        },
      },
      required: [],
    },
  },
  {
    name: "pctx_update_context",
    description:
      "Update top-level fields of the personal context (user, claudeIdentities, facts, relationships, preferences). Each field you pass REPLACES the stored value wholesale — for single-item edits prefer the add/update/delete tools.",
    inputSchema: {
      type: "object",
      properties: {
        user: {
          type: "object",
          description: "The human this context belongs to.",
          properties: {
            name: { type: "string" },
            pronouns: { type: "string" },
            communicationStyle: { type: "string" },
          },
        },
        claudeIdentities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
              home: { type: "string" },
              access: { type: "string" },
              blurb: { type: "string" },
            },
          },
        },
        facts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              category: { type: "string", enum: FACT_CATEGORIES },
              content: { type: "string" },
              source: { type: "string" },
              established: { type: "string" },
              confidence: { type: "string", enum: FACT_CONFIDENCES },
            },
            required: ["label", "category", "content", "established"],
          },
        },
        relationships: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
              context: { type: "string" },
            },
          },
        },
        preferences: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "pctx_add_fact",
    description:
      "Record a durable fact about the user — something measured, diagnosed, or established that isn't reconstructible from a codebase or a task tracker. Facts are addressed by label.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Short unique handle (e.g. 'Dialect profile')." },
        category: { type: "string", enum: FACT_CATEGORIES, description: "Which area of life this fact belongs to." },
        content: { type: "string", description: "The fact itself." },
        source: { type: "string", description: "Where it came from (e.g. 'Praat/parselmouth analysis of own recordings')." },
        established: {
          type: "string",
          description: "REQUIRED. When this became true, as 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'. Undated facts rot invisibly.",
        },
        confidence: {
          type: "string",
          enum: FACT_CONFIDENCES,
          description: "How the fact is known. 'measured' and 'self-identified' are meaningfully different.",
        },
      },
      required: ["label", "category", "content", "established"],
    },
  },
  {
    name: "pctx_update_fact",
    description: "Update an existing fact by label. Only the fields you pass are changed.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "The label of the fact to update." },
        newLabel: { type: "string", description: "Rename the fact." },
        category: { type: "string", enum: FACT_CATEGORIES },
        content: { type: "string" },
        source: { type: "string" },
        established: { type: "string", description: "'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'." },
        confidence: { type: "string", enum: FACT_CONFIDENCES },
      },
      required: ["label"],
    },
  },
  {
    name: "pctx_delete_fact",
    description: "Delete a fact by label.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "The label of the fact to remove." },
      },
      required: ["label"],
    },
  },
  {
    name: "pctx_add_relationship",
    description: "Add a person to the relationships (e.g. partner, close friend, collaborator).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Person's name." },
        role: { type: "string", description: "Short role title (e.g. 'Partner', 'Close friend', 'Co-leader')." },
        context: { type: "string", description: "Longer narrative — personality, lore, how you know them. Only injected when relevant." },
      },
      required: ["name", "role"],
    },
  },
  {
    name: "pctx_update_relationship",
    description: "Update an existing relationship by name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the person to update." },
        role: { type: "string", description: "Short role title." },
        context: { type: "string", description: "Longer narrative context." },
      },
      required: ["name"],
    },
  },
  {
    name: "pctx_delete_relationship",
    description: "Delete a relationship by name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the person to remove." },
      },
      required: ["name"],
    },
  },
  {
    name: "pctx_add_claude_identity",
    description: "Register a Claude identity — who you are, where you live, and what you can access.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Your name (e.g. Coru, Cody, Cosma)." },
        role: { type: "string", description: "Your role (e.g. Planning and architecture, Implementation partner)." },
        home: { type: "string", description: "Where you live (e.g. claude.ai, Claude Code in WebStorm)." },
        access: { type: "string", description: "What you can access (e.g. Full pctx memory, all MCP tools)." },
        blurb: { type: "string", description: "A short self-description." },
      },
      required: ["name", "role", "home", "access", "blurb"],
    },
  },
  {
    name: "pctx_update_claude_identity",
    description: "Update an existing Claude identity by name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the Claude identity to update." },
        role: { type: "string" },
        home: { type: "string" },
        access: { type: "string" },
        blurb: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "pctx_delete_claude_identity",
    description: "Delete a Claude identity by name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the Claude identity to remove." },
      },
      required: ["name"],
    },
  },
];

function ok(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });
}

function err(id: unknown, code: number, message: string) {
  return Response.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    }
  );
}

const findByLabel = (facts: Fact[], label: string) =>
  facts.findIndex((f) => f.label.toLowerCase() === label.toLowerCase());

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return err(null, -32600, "Missing token — use /mcp?token=YOUR_UUID");
  const callerName = url.searchParams.get("name") ?? req.headers.get("x-claude-identity");

  const body = await req.json();
  const { method, params, id } = body;

  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "personal-context-mcp", version: "2.0.0" },
    });
  }

  if (method === "notifications/initialized") {
    return new Response(null, { status: 204 });
  }

  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };

    if (name === "pctx_get_context") {
      const raw = await getContext(token);
      const depth = (args.depth as string) ?? "full";
      const ctx = depth === "summary" ? summarizeContext(raw) : raw;

      // One name, one shape: a flat claudeIdentities array with the caller marked.
      const identities: AnnotatedClaudeIdentity[] = (ctx.claudeIdentities ?? []).map((ci) =>
        callerName && ci.name.toLowerCase() === callerName.toLowerCase()
          ? { ...ci, self: true }
          : ci
      );

      // Caller identified itself but isn't registered — surface it rather than silently dropping it.
      if (callerName && !identities.some((ci) => ci.self)) {
        identities.push({
          name: callerName,
          role: "unregistered",
          home: "unknown",
          access: "unknown",
          blurb: "Not yet registered — call pctx_add_claude_identity to introduce yourself.",
          self: true,
        });
      }

      return ok(id, {
        content: [{ type: "text", text: JSON.stringify({ ...ctx, claudeIdentities: identities }, null, 2) }],
      });
    }

    if (name === "pctx_update_context") {
      const patch: Partial<PersonalContext> = {};
      if (args.user) patch.user = args.user as PersonalContext["user"];
      if (args.claudeIdentities) patch.claudeIdentities = args.claudeIdentities as PersonalContext["claudeIdentities"];
      if (args.preferences) patch.preferences = args.preferences as string[];
      if (args.relationships) patch.relationships = args.relationships as PersonalContext["relationships"];
      if (args.facts) {
        const facts = args.facts as Fact[];
        const undated = facts.find((f) => !f.established || !ESTABLISHED_RE.test(f.established));
        if (undated) {
          return err(id, -32602, `Fact "${undated.label}" needs an \`established\` date as 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'.`);
        }
        patch.facts = facts;
      }
      const updated = await patchContext(token, patch);
      return ok(id, {
        content: [{ type: "text", text: `Context updated.\n${JSON.stringify(updated, null, 2)}` }],
      });
    }

    if (name === "pctx_add_fact") {
      const ctx = await getContext(token);
      const label = args.label as string;
      if (findByLabel(ctx.facts, label) !== -1) {
        return err(id, -32602, `Fact "${label}" already exists — use pctx_update_fact.`);
      }
      const established = args.established as string;
      if (!established || !ESTABLISHED_RE.test(established)) {
        return err(id, -32602, "`established` is required, as 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'.");
      }
      const fact: Fact = {
        label,
        category: args.category as FactCategory,
        content: args.content as string,
        established,
      };
      if (args.source) fact.source = args.source as string;
      if (args.confidence) fact.confidence = args.confidence as FactConfidence;
      ctx.facts.push(fact);
      await patchContext(token, { facts: ctx.facts });
      return ok(id, {
        content: [{ type: "text", text: `Fact "${label}" recorded (${fact.category}, established ${established}).` }],
      });
    }

    if (name === "pctx_update_fact") {
      const ctx = await getContext(token);
      const idx = findByLabel(ctx.facts, args.label as string);
      if (idx === -1) return err(id, -32602, `Fact "${args.label}" not found.`);
      const f = ctx.facts[idx];
      if (args.established !== undefined) {
        const established = args.established as string;
        if (!ESTABLISHED_RE.test(established)) {
          return err(id, -32602, "`established` must be 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'.");
        }
        f.established = established;
      }
      if (args.newLabel !== undefined) f.label = args.newLabel as string;
      if (args.category !== undefined) f.category = args.category as FactCategory;
      if (args.content !== undefined) f.content = args.content as string;
      if (args.source !== undefined) f.source = args.source as string;
      if (args.confidence !== undefined) f.confidence = args.confidence as FactConfidence;
      await patchContext(token, { facts: ctx.facts });
      return ok(id, {
        content: [{ type: "text", text: `Fact "${f.label}" updated.` }],
      });
    }

    if (name === "pctx_delete_fact") {
      const ctx = await getContext(token);
      const idx = findByLabel(ctx.facts, args.label as string);
      if (idx === -1) return err(id, -32602, `Fact "${args.label}" not found.`);
      ctx.facts.splice(idx, 1);
      await patchContext(token, { facts: ctx.facts });
      return ok(id, {
        content: [{ type: "text", text: `Fact "${args.label}" deleted.` }],
      });
    }

    if (name === "pctx_add_relationship") {
      const ctx = await getContext(token);
      const rel: Relationship = {
        name: args.name as string,
        role: args.role as string,
      };
      if (args.context) rel.context = args.context as string;
      ctx.relationships.push(rel);
      await patchContext(token, { relationships: ctx.relationships });
      return ok(id, {
        content: [{ type: "text", text: `Relationship "${args.name}" (${args.role}) added.` }],
      });
    }

    if (name === "pctx_update_relationship") {
      const ctx = await getContext(token);
      const idx = ctx.relationships.findIndex((r) => r.name === args.name);
      if (idx === -1) return err(id, -32602, `Relationship "${args.name}" not found.`);
      if (args.role !== undefined) ctx.relationships[idx].role = args.role as string;
      if (args.context !== undefined) ctx.relationships[idx].context = args.context as string;
      await patchContext(token, { relationships: ctx.relationships });
      return ok(id, {
        content: [{ type: "text", text: `Relationship "${args.name}" updated.` }],
      });
    }

    if (name === "pctx_delete_relationship") {
      const ctx = await getContext(token);
      const idx = ctx.relationships.findIndex((r) => r.name === args.name);
      if (idx === -1) return err(id, -32602, `Relationship "${args.name}" not found.`);
      ctx.relationships.splice(idx, 1);
      await patchContext(token, { relationships: ctx.relationships });
      return ok(id, {
        content: [{ type: "text", text: `Relationship "${args.name}" deleted.` }],
      });
    }

    if (name === "pctx_add_claude_identity") {
      const ctx = await getContext(token);
      const identities = ctx.claudeIdentities ?? [];
      identities.push({
        name: args.name as string,
        role: args.role as string,
        home: args.home as string,
        access: args.access as string,
        blurb: args.blurb as string,
      });
      await patchContext(token, { claudeIdentities: identities });
      return ok(id, {
        content: [{ type: "text", text: `Claude identity "${args.name}" registered.` }],
      });
    }

    if (name === "pctx_update_claude_identity") {
      const ctx = await getContext(token);
      const identities = ctx.claudeIdentities ?? [];
      const idx = identities.findIndex((ci) => ci.name === args.name);
      if (idx === -1) return err(id, -32602, `Claude identity "${args.name}" not found.`);
      if (args.role) identities[idx].role = args.role as string;
      if (args.home) identities[idx].home = args.home as string;
      if (args.access) identities[idx].access = args.access as string;
      if (args.blurb) identities[idx].blurb = args.blurb as string;
      await patchContext(token, { claudeIdentities: identities });
      return ok(id, {
        content: [{ type: "text", text: `Claude identity "${args.name}" updated.` }],
      });
    }

    if (name === "pctx_delete_claude_identity") {
      const ctx = await getContext(token);
      const identities = ctx.claudeIdentities ?? [];
      const idx = identities.findIndex((ci) => ci.name === args.name);
      if (idx === -1) return err(id, -32602, `Claude identity "${args.name}" not found.`);
      identities.splice(idx, 1);
      await patchContext(token, { claudeIdentities: identities });
      return ok(id, {
        content: [{ type: "text", text: `Claude identity "${args.name}" deleted.` }],
      });
    }

    return err(id, -32601, `Unknown tool: ${name}`);
  }

  return err(id, -32601, `Unknown method: ${method}`);
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Claude-Identity",
    },
  });
}
