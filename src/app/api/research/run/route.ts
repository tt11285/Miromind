import { parseResearchTask } from "@/lib/apiSchemas";
import { createMiroMindReasoner } from "@/lib/miromindClient";
import { runResearch } from "@/lib/orchestrator";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await request.json();
    const { task, useMiroMind } = parseResearchTask(input);
    const apiKey = process.env.MIROMIND_API_KEY;
    const model = process.env.MIROMIND_MODEL ?? "gpt-oss-120b";

    const run = await runResearch(task, {
      reasoner:
        useMiroMind && apiKey
          ? createMiroMindReasoner({ apiKey, model })
          : undefined
    });

    return Response.json({ run });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Invalid research task";
}
