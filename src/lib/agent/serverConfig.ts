export function getMiroMindServerConfig() {
  const requestTimeoutMs = process.env.MIROMIND_REQUEST_TIMEOUT_MS
    ? Number(process.env.MIROMIND_REQUEST_TIMEOUT_MS)
    : undefined;

  return {
    apiKey: process.env.MIROMIND_API_KEY,
    model: process.env.MIROMIND_MODEL ?? "mirothinker-1-7-deepresearch",
    baseUrl: process.env.MIROMIND_BASE_URL ?? "https://api.miromind.ai/v1",
    requestTimeoutMs
  };
}
