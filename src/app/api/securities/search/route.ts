import { getSecuritySearchProvider } from "@/lib/securities/search";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const results = await getSecuritySearchProvider().search(query);
  return Response.json({ results });
}
