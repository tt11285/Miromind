export async function GET(): Promise<Response> {
  return Response.json({
    liveAvailable: Boolean(process.env.MIROMIND_API_KEY),
    model: process.env.MIROMIND_MODEL ?? "mirothinker-1-7-deepresearch",
    fallbackAvailable: true
  });
}
