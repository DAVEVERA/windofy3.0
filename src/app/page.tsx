import { WindofyApp } from "@/components/WindofyApp";
import { absoluteUrl, siteMetadata } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${absoluteUrl("/")}#organization`,
      name: siteMetadata.name,
      url: absoluteUrl("/"),
    },
    {
      "@type": "WebSite",
      "@id": `${absoluteUrl("/")}#website`,
      name: siteMetadata.name,
      url: absoluteUrl("/"),
      inLanguage: "nl-NL",
      publisher: {
        "@id": `${absoluteUrl("/")}#organization`,
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WindofyApp />
    </>
  );
}
