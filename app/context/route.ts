import { getContext } from "@/lib/storage";
import { summarizeContext } from "@/lib/context-utils";

export const runtime = "edge";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 400 });
  }

  const raw = await getContext(token);
  const depth = url.searchParams.get("depth") ?? "full";
  const ctx = depth === "summary" ? summarizeContext(raw) : raw;
  return Response.json(ctx, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
