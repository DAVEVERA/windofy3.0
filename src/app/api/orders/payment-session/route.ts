export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function badRequest(error: string) {
  return Response.json({ ok: false, error }, { status: 400 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return badRequest("Ongeldige betaal-aanvraag.");
  }

  const orderId = readString((body as { orderId?: unknown }).orderId);
  const reference = readString((body as { reference?: unknown }).reference);
  const provider = (body as { provider?: unknown }).provider === "stripe" ? "stripe" : "mollie";
  const totalCents = Number((body as { totalCents?: unknown }).totalCents);

  if (!orderId || !reference) {
    return badRequest("Maak eerst een geldige conceptbestelling aan.");
  }

  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return badRequest("Het betaalbedrag is ongeldig.");
  }

  const paymentSessionId = `pay_${crypto.randomUUID()}`;
  const params = new URLSearchParams({
    session: paymentSessionId,
    order: orderId,
    reference,
    provider,
  });

  return Response.json({
    ok: true,
    session: {
      id: paymentSessionId,
      status: "ready",
      provider,
      redirectUrl: `/betaling?${params.toString()}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
  });
}
