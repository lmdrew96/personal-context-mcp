import { getContext, patchContext } from "@/lib/storage";
import { summarizeContext } from "@/lib/context-utils";
import { PersonalContext, ClaudeIdentity, Project, ProjectStatus, Relationship } from "@/lib/types";

export const runtime = "edge";

const VALID_STATUSES: ProjectStatus[] = ["active", "paused", "concept", "archived"];

// MCP tool definitions
const TOOLS = [
  {
    name: "pctx_get_context",
    description: "Retrieve your personal context. Use depth='summary' for a lightweight overview (project names+summaries+statuses, relationship names+roles). Use depth='full' (default) for everything including architecture notes, stack, and relationship context.",
    inputSchema: {
      type: "object",
      properties: {
        depth: {
          type: "string",
          enum: ["summary", "full"],
          description: "Level of detail. 'summary' returns lightweight fields only (saves tokens). 'full' returns everything. Default: 'full'.",
        },
      },
      required: [],
    },
  },
  {
    name: "pctx_update_context",
    description: "Update top-level fields of your personal context (identity, claudeIdentities, preferences, customInstructions).",
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
        name: { type: "string", description: "Project name." },
        summary: { type: "string", description: "1-2 sentence elevator pitch." },
        status: { type: "string", enum: VALID_STATUSES, description: "Project status." },
        slug: { type: "string", description: "Short identifier for cross-referencing (e.g. 'chatos')." },
        url: { type: "string", description: "Live URL (e.g. 'chatos.adhdesigns.dev')." },
        stack: { type: "array", items: { type: "string" }, description: "Tech stack tags (e.g. ['Next.js', 'Convex', 'Clerk'])." },
        architecture: { type: "string", description: "Deeper technical/architecture notes." },
        currentFocus: { type: "string", description: "What's actively being worked on right now." },
      },
      required: ["name", "summary", "status"],
    },
  },
  {
    name: "pctx_update_project",
    description: "Update an existing project in your personal context by name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the project to update." },
        summary: { type: "string", description: "1-2 sentence elevator pitch." },
        status: { type: "string", enum: VALID_STATUSES, description: "Project status." },
        slug: { type: "string", description: "Short identifier for cross-referencing." },
        url: { type: "string", description: "Live URL." },
        stack: { type: "array", items: { type: "string" }, description: "Tech stack tags." },
        architecture: { type: "string", description: "Deeper technical/architecture notes." },
        currentFocus: { type: "string", description: "What's actively being worked on right now." },
      },
      required: ["name"],
    },
  },
  {
    name: "pctx_delete_project",
    description: "Delete an existing project from your personal context by name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the project to delete." },
      },
      required: ["name"],
    },
  },
  {
    name: "pctx_add_relationship",
    description: "Add a person to your relationships (e.g. co-founder, partner, collaborator).",
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
    description: "Update an existing relationship in your personal context by name.",
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
    description: "Delete a relationship from your personal context by name.",
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
        name: { type: "string", description: "Your name (e.g. Claudiu, Coru, Cody)." },
        role: { type: "string", description: "Your role (e.g. Platform voice, Desktop companion)." },
        home: { type: "string", description: "Where you live (e.g. Cha(t)os platform, Claude Code CLI)." },
        access: { type: "string", description: "What you can access (e.g. Full pctx memory, all users)." },
        blurb: { type: "string", description: "A short self-description (e.g. Claudiu lives here)." },
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

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return err(null, -32600, "Missing token — use /mcp?token=YOUR_UUID");
  const callerName = url.searchParams.get("name");

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
      const identities = ctx.claudeIdentities ?? [];

      if (callerName) {
        const self = identities.find(
          (ci) => ci.name.toLowerCase() === callerName.toLowerCase()
        );
        const peers = identities.filter(
          (ci) => ci.name.toLowerCase() !== callerName.toLowerCase()
        );
        const { claudeIdentities: _, ...rest } = ctx;
        const shaped = {
          ...rest,
          you: self ?? { name: callerName, role: "unknown", home: "unknown", access: "unknown", blurb: "" },
          peers,
        };
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(shaped, null, 2) }],
        });
      }

      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(ctx, null, 2) }],
      });
    }

    if (name === "pctx_update_context") {
      const patch: Partial<PersonalContext> = {};
      if (args.identity) patch.identity = args.identity as PersonalContext["identity"];
      if (args.claudeIdentities) patch.claudeIdentities = args.claudeIdentities as PersonalContext["claudeIdentities"];
      if (args.preferences) patch.preferences = args.preferences as string[];
      if (args.customInstructions) patch.customInstructions = args.customInstructions as string;
      if (args.projects) patch.projects = args.projects as PersonalContext["projects"];
      if (args.relationships) patch.relationships = args.relationships as PersonalContext["relationships"];
      const updated = await patchContext(token, patch);
      return ok(id, {
        content: [{ type: "text", text: `Context updated.\n${JSON.stringify(updated, null, 2)}` }],
      });
    }

    if (name === "pctx_add_project") {
      const ctx = await getContext(token);
      const project: Project = {
        name: args.name as string,
        summary: args.summary as string,
        status: (args.status as ProjectStatus) ?? "active",
      };
      if (args.slug) project.slug = args.slug as string;
      if (args.url) project.url = args.url as string;
      if (args.stack) project.stack = args.stack as string[];
      if (args.architecture) project.architecture = args.architecture as string;
      if (args.currentFocus) project.currentFocus = args.currentFocus as string;
      ctx.projects.push(project);
      await patchContext(token, { projects: ctx.projects });
      return ok(id, {
        content: [{ type: "text", text: `Project "${args.name}" added.` }],
      });
    }

    if (name === "pctx_update_project") {
      const ctx = await getContext(token);
      const idx = ctx.projects.findIndex((p) => p.name === args.name);
      if (idx === -1) return err(id, -32602, `Project "${args.name}" not found.`);
      const p = ctx.projects[idx];
      if (args.summary !== undefined) p.summary = args.summary as string;
      if (args.status !== undefined) p.status = args.status as ProjectStatus;
      if (args.slug !== undefined) p.slug = args.slug as string;
      if (args.url !== undefined) p.url = args.url as string;
      if (args.stack !== undefined) p.stack = args.stack as string[];
      if (args.architecture !== undefined) p.architecture = args.architecture as string;
      if (args.currentFocus !== undefined) p.currentFocus = args.currentFocus as string;
      await patchContext(token, { projects: ctx.projects });
      return ok(id, {
        content: [{ type: "text", text: `Project "${args.name}" updated.` }],
      });
    }

    if (name === "pctx_delete_project") {
      const ctx = await getContext(token);
      const idx = ctx.projects.findIndex((p) => p.name === args.name);
      if (idx === -1) return err(id, -32602, `Project "${args.name}" not found.`);
      ctx.projects.splice(idx, 1);
      await patchContext(token, { projects: ctx.projects });
      return ok(id, {
        content: [{ type: "text", text: `Project "${args.name}" deleted.` }],
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
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
