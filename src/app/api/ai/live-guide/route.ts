import { assertImageDataUrl, callAiService, errorResponse } from "@/lib/aiBackend";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    assertImageDataUrl(body?.imageDataUrl);

    const data = await callAiService<Record<string, unknown>>(
      "/api/live-guide",
      {
        imageDataUrl: body.imageDataUrl,
        previousInstruction: typeof body.previousInstruction === "string" ? body.previousInstruction : undefined,
        measurementStage: typeof body.measurementStage === "string" ? body.measurementStage : "positioning",
      },
      120_000,
    );

    return Response.json({ ok: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
