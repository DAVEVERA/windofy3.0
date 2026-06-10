import { assertImageDataUrl, callAiService, errorResponse } from "@/lib/aiBackend";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    assertImageDataUrl(body?.imageDataUrl);

    if (!body?.config || typeof body.config !== "object" || Array.isArray(body.config)) {
      return Response.json({ ok: false, error: "Configuratie ontbreekt." }, { status: 400 });
    }

    const data = await callAiService<{ imageDataUrl: string }>("/api/render", {
      imageDataUrl: body.imageDataUrl,
      config: body.config,
      state: typeof body.state === "string" ? body.state : "Geheel uitgerold",
      mounting: typeof body.mounting === "string" ? body.mounting : undefined,
      extraOptions: body.extraOptions && typeof body.extraOptions === "object" ? body.extraOptions : {},
    });

    return Response.json({ ok: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
