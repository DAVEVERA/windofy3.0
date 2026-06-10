import { getSupabaseUser, isSupabaseConfigured, supabaseRest } from "@/lib/supabaseRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SampleSyncItem = {
  productId?: unknown;
  windowId?: unknown;
  colorName?: unknown;
  colorHex?: unknown;
  quantity?: unknown;
};

type SampleSyncBody = {
  projectId?: unknown;
  shippingName?: unknown;
  shippingAddress?: unknown;
  shippingPostalCode?: unknown;
  items?: SampleSyncItem[];
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function badRequest(error: string) {
  return Response.json({ ok: false, error }, { status: 400 });
}

function unauthorized(error = "Login vereist om staaltjes in Mijn account op te slaan.") {
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

  const body = await request.json().catch(() => null) as SampleSyncBody | null;
  if (!body || typeof body !== "object") {
    return badRequest("Ongeldige staaltjesaanvraag.");
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const validItems = items
    .map((item) => ({
      productId: readString(item.productId),
      windowId: readString(item.windowId),
      colorName: readString(item.colorName),
      colorHex: readString(item.colorHex),
      quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    }))
    .filter((item) => item.productId && item.colorName && /^#[0-9a-fA-F]{6}$/.test(item.colorHex));

  if (!validItems.length) {
    return badRequest("Voeg minimaal een geldig kleurstaaltje toe.");
  }

  const [sampleOrder] = await supabaseRest<Array<{ id: string }>>("sample_orders", {
    accessToken,
    method: "POST",
    prefer: "return=representation",
    body: [{
      user_id: user.id,
      project_id: readString(body.projectId) || null,
      status: "submitted",
      shipping_name: readString(body.shippingName) || user.email || null,
      shipping_address: readString(body.shippingAddress) || null,
      shipping_postal_code: readString(body.shippingPostalCode) || null,
      total_cents: 0,
    }],
  });

  if (!sampleOrder?.id) {
    throw new Error("Staaltjesorder kon niet worden opgeslagen.");
  }

  await supabaseRest("sample_order_items", {
    accessToken,
    method: "POST",
    body: validItems.map((item) => ({
      sample_order_id: sampleOrder.id,
      product_id: item.productId,
      window_id: item.windowId || null,
      color_name: item.colorName,
      color_hex: item.colorHex,
      quantity: item.quantity,
      unit_price_cents: 0,
    })),
  });

  return Response.json({
    ok: true,
    sampleOrder: {
      id: sampleOrder.id,
      itemCount: validItems.length,
    },
  });
}
