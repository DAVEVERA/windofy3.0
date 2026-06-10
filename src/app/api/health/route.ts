import { getAiServiceHealth } from "@/lib/aiBackend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ai = await getAiServiceHealth();
  const ok = ai.ok;

  return Response.json(
    {
      ok,
      service: "windofy-web",
      ai,
    },
    { status: ok ? 200 : 503 },
  );
}
