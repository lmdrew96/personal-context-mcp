import { getContext, patchContext } from "@/lib/storage";
import { PersonalContext } from "@/lib/types";

export const runtime = "edge";

// MCP tool definitions
const TOOLS = [
  {
    name: "pctx_get_context",
    description: "Retrieve your full personal context: identity, projects, relationships, preferences, and custom instructions.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pctx_update_context",
    description: "Update top-level fields of your personal context (identity, preferences, customInstructions).",
    inputSchema: {
      type: "object",
      properties: {
        identity: {
          type: "object",
          properties: {
            name: { type: "string" },
            pronouns: { type: "string" },
            communicationStyle: { type: "string" },
          },
        },
        preferences: { type: "array", items: { type: "string" } },
        customInstructions: { type: "string" },
      },
    },
  },
  {
    name: "pctx_add_project",
    description: "Add a new project to your personal context.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
      },
      required: ["name", "description", "status"],
    },
  },
  {
    name: "pctx_add_relationship",
    description: "Add a person to your relationships (e.g. co-founder, partner, collaborator).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        role: { type: "string" },
      },
      required: ["name", "role"],
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

export async function POST(req: Request) {
  const body = await req.json();
  const { method, params, id } = body;

  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "personal-context-mcp", version: "1.0.0" },
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
      const ctx = await getContext();
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(ctx, null, 2) }],
      });
    }

    if (name === "pctx_update_context") {
      const patch: Partial<PersonalContext> = {};
      if (args.identity) patch.identity = args.identity as PersonalContext["identity"];
      if (args.preferences) patch.preferences = args.preferences as string[];
      if (args.customInstructions) patch.customInstructions = args.customInstructions as string;
      const updated = await patchContext(patch);
      return ok(id, {
        content: [{ type: "text", text: `Context updated.\n${JSON.stringify(updated, null, 2)}` }],
      });
    }

    if (name === "pctx_add_project") {
      const ctx = await getContext();
      ctx.projects.push({
        name: args.name as string,
        description: args.description as string,
        status: args.status as string,
      });
      await patchContext({ projects: ctx.projects });
      return ok(id, {
        content: [{ type: "text", text: `Project "${args.name}" added.` }],
      });
    }

    if (name === "pctx_add_relationship") {
      const ctx = await getContext();
      ctx.relationships.push({
        name: args.name as string,
        role: args.role as string,
      });
      await patchContext({ relationships: ctx.relationships });
      return ok(id, {
        content: [{ type: "text", text: `Relationship "${args.name}" (${args.role}) added.` }],
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
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
