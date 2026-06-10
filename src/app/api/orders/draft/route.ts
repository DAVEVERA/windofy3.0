export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DraftOrderCustomer = {
  name?: unknown;
  email?: unknown;
  postalCode?: unknown;
  houseNumber?: unknown;
  address?: unknown;
};

type DraftOrderItem = {
  id?: unknown;
  roomName?: unknown;
  windowName?: unknown;
  price?: unknown;
  measurement?: {
    widthMm?: unknown;
    heightMm?: unknown;
    depthMm?: unknown;
  };
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createReference() {
  const bytes = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
  return `WDF-${new Date().getFullYear()}-${String(bytes + 100000).padStart(6, "0")}`;
}

function badRequest(error: string) {
  return Response.json({ ok: false, error }, { status: 400 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return badRequest("Ongeldige orderaanvraag.");
  }

  const customer = (body as { customer?: DraftOrderCustomer }).customer ?? {};
  const normalizedCustomer = {
    name: readString(customer.name),
    email: readString(customer.email),
    postalCode: readString(customer.postalCode).toUpperCase(),
    houseNumber: readString(customer.houseNumber),
    address: readString(customer.address),
  };

  if (!normalizedCustomer.name || !normalizedCustomer.email || !normalizedCustomer.postalCode || !normalizedCustomer.houseNumber) {
    return badRequest("Naam, e-mail, postcode en huisnummer zijn verplicht.");
  }

  if (!isValidEmail(normalizedCustomer.email)) {
    return badRequest("Gebruik een geldig e-mailadres.");
  }

  const items = Array.isArray((body as { items?: unknown }).items)
    ? ((body as { items: DraftOrderItem[] }).items)
    : [];

  if (!items.length) {
    return badRequest("De winkelwagen is leeg.");
  }

  const invalidItem = items.find((item) => {
    const width = Number(item.measurement?.widthMm);
    const height = Number(item.measurement?.heightMm);
    const price = Number(item.price);
    return !readString(item.windowName) || !Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200 || !Number.isFinite(price) || price <= 0;
  });

  if (invalidItem) {
    return badRequest("Controleer alle raamafmetingen en prijzen voordat je de betaling voorbereidt.");
  }

  const totalCents = Number((body as { totalCents?: unknown }).totalCents);
  const calculatedTotal = items.reduce((total, item) => total + Math.round(Number(item.price)), 0);

  if (!Number.isFinite(totalCents) || Math.round(totalCents) !== calculatedTotal) {
    return badRequest("Het ordertotaal komt niet overeen met de winkelwagen.");
  }

  const paymentMethod = (body as { paymentMethod?: unknown }).paymentMethod === "card" ? "card" : "ideal";

  return Response.json({
    ok: true,
    order: {
      id: crypto.randomUUID(),
      reference: createReference(),
      status: "pending-payment",
      paymentMethod,
      paymentProvider: paymentMethod === "ideal" ? "mollie" : "stripe",
      totalCents: calculatedTotal,
      customer: normalizedCustomer,
      itemCount: items.length,
      createdAt: new Date().toISOString(),
    },
  });
}
