import Link from "next/link";

type PaymentPageProps = {
  searchParams: Promise<{
    session?: string;
    order?: string;
    reference?: string;
    provider?: string;
  }>;
};

export default async function PaymentPage({ searchParams }: PaymentPageProps) {
  const params = await searchParams;
  const provider = params.provider === "stripe" ? "Stripe" : "Mollie";
  const reference = params.reference || "Onbekende referentie";
  const session = params.session || "geen sessie";

  return (
    <main className="payment-page">
      <section className="payment-confirmation">
        <span className="eyebrow">Betaalsessie</span>
        <h1>{provider} betaling staat klaar.</h1>
        <p>
          Conceptbestelling {reference} heeft een server-side betaal-sessie gekregen.
          In productie vervangt deze pagina de providerredirect zodra de Mollie- of Stripe-sleutels gekoppeld zijn.
        </p>
        <div className="payment-details">
          <span>Sessie<strong>{session}</strong></span>
          <span>Provider<strong>{provider}</strong></span>
          <span>Status<strong>Klaar voor redirect</strong></span>
        </div>
        <Link className="primary-button" href="/">Terug naar Windofy</Link>
      </section>
    </main>
  );
}
