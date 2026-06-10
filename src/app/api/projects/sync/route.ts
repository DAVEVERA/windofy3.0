import { getSupabaseUser, isSupabaseConfigured, supabaseRest } from "@/lib/supabaseRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncWindow = {
  id?: unknown;
  roomName?: unknown;
  windowName?: unknown;
  status?: unknown;
  measurement?: {
    widthMm?: unknown;
    heightMm?: unknown;
    depthMm?: unknown;
    source?: unknown;
    confidence?: unknown;
  };
  configuration?: {
    catalogProductId?: unknown;
    mountingMethod?: unknown;
    controlSide?: unknown;
    lightTransmission?: unknown;
  };
  priceCents?: unknown;
};

type ProjectSyncBody = {
  projectName?: unknown;
  totalCents?: unknown;
  windows?: SyncWindow[];
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function badRequest(error: string) {
  return Response.json({ ok: false, error }, { status: 400 });
}

function unauthorized(error = "Login vereist om dit project in Mijn account op te slaan.") {
  return Response.json({ ok: false, error }, { status: 401 });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : "";
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return Response.json(
      { ok: false, error: "Supabase is niet geconfigureerd op de server.", mode: "local-only" },
      { status: 503 },
    );
  }

  const accessToken = bearerToken(request);
  if (!accessToken) {
    return unauthorized();
  }

  const user = await getSupabaseUser(accessToken);
  if (!user) {
    return unauthorized("Supabase sessie is ongeldig of verlopen.");
  }

  const body = await request.json().catch(() => null) as ProjectSyncBody | null;
  if (!body || typeof body !== "object") {
    return badRequest("Ongeldige projectaanvraag.");
  }

  const projectName = readString(body.projectName) || "Windofy project";
  const totalCents = Number(body.totalCents);
  const windows = Array.isArray(body.windows) ? body.windows : [];
  if (!Number.isFinite(totalCents) || totalCents < 0) {
    return badRequest("Projecttotaal is ongeldig.");
  }

  const measurableWindows = windows.filter((window) => {
    const width = Number(window.measurement?.widthMm);
    const height = Number(window.measurement?.heightMm);
    return readString(window.windowName) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  });

  const [project] = await supabaseRest<Array<{ id: string }>>("customer_projects", {
    accessToken,
    method: "POST",
    prefer: "return=representation",
    body: [{
      user_id: user.id,
      name: projectName,
      status: measurableWindows.length ? "ready-to-order" : "draft",
      room_count: new Set(measurableWindows.map((window) => readString(window.roomName))).size,
      window_count: measurableWindows.length,
      total_cents: Math.round(totalCents),
      saved_at: new Date().toISOString(),
    }],
  });

  if (!project?.id) {
    throw new Error("Project kon niet worden opgeslagen.");
  }

  const insertedWindows = measurableWindows.length
    ? await supabaseRest<Array<{ id: string; client_id: string }>>("project_windows?select=id,client_id", {
      accessToken,
      method: "POST",
      prefer: "return=representation",
      body: measurableWindows.map((window) => ({
        project_id: project.id,
        client_id: readString(window.id),
        room_name: readString(window.roomName) || "Ruimte",
        window_name: readString(window.windowName),
        status: readString(window.status) || "needs-review",
        width_mm: Math.round(Number(window.measurement?.widthMm)),
        height_mm: Math.round(Number(window.measurement?.heightMm)),
        depth_mm: Number.isFinite(Number(window.measurement?.depthMm)) ? Math.round(Number(window.measurement?.depthMm)) : null,
        measurement_source: readString(window.measurement?.source) || "manual",
        measurement_confidence: Number.isFinite(Number(window.measurement?.confidence)) ? Number(window.measurement?.confidence) : null,
      })),
    })
    : [];

  const windowIdByClientId = new Map(insertedWindows.map((window) => [window.client_id, window.id]));
  const configurations = measurableWindows.flatMap((window) => {
    const productId = readString(window.configuration?.catalogProductId);
    const savedWindowId = windowIdByClientId.get(readString(window.id));
    if (!productId || !savedWindowId) {
      return [];
    }

    return [{
      window_id: savedWindowId,
      product_id: productId,
      mounting_method: readString(window.configuration?.mountingMethod) || "inside-recess",
      control_side: readString(window.configuration?.controlSide) || null,
      light_transmission: Number.isFinite(Number(window.configuration?.lightTransmission))
        ? Math.round(Number(window.configuration?.lightTransmission))
        : null,
      unit_price_cents: Math.max(0, Math.round(Number(window.priceCents) || 0)),
      quantity: 1,
    }];
  });

  if (configurations.length) {
    await supabaseRest("project_window_configurations", {
      accessToken,
      method: "POST",
      body: configurations,
    });
  }

  return Response.json({
    ok: true,
    project: {
      id: project.id,
      savedWindows: insertedWindows.length,
      savedConfigurations: configurations.length,
    },
  });
}
