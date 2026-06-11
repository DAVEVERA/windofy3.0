import { getAiServiceHealth } from "@/lib/aiBackend";
import { getOpenAiVisionHealth } from "@/lib/openAiVisionBackend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ai = await getAiServiceHealth();
  const openai = getOpenAiVisionHealth();
  const ok = ai.ok || openai.ok;

  return Response.json(
    {
      ok,
      service: "windofy-web",
      ai,
      openai,
      activeAiBackend: ai.ok ? "python-ai-service" : openai.ok ? "openai-responses" : "none",
    },
    { status: ok ? 200 : 503 },
  );
}
