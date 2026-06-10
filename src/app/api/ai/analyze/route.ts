import { assertImageDataUrl, callAiService, errorResponse } from "@/lib/aiBackend";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    assertImageDataUrl(body?.imageDataUrl);

    const data = await callAiService<Record<string, unknown>>("/api/analyze", {
      imageDataUrl: body.imageDataUrl,
    });

    return Response.json({ ok: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
