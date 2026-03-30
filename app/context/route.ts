import { getContext } from "@/lib/storage";

export const runtime = "edge";

export async function GET() {
  const ctx = await getContext();
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
