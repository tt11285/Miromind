import { searchListedSecurities } from "@/lib/securities/search";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  return Response.json({ results: searchListedSecurities(query) });
}
