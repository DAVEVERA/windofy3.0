import type { Metadata } from "next";
import localFont from "next/font/local";
import { absoluteUrl, siteMetadata, siteUrl } from "@/lib/site";
import "./globals.css";

const balooTammudu = localFont({
  src: "../../font/Baloo Tammudu/BalooTammudu2-VariableFont_wght.ttf",
  variable: "--font-brand",
  display: "swap",
  fallback: ["system-ui", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: siteMetadata.title,
    template: `%s | ${siteMetadata.name}`,
  },
  description: siteMetadata.description,
  alternates: {
    canonical: absoluteUrl("/"),
  },
  keywords: [
    "Windofy",
    "AI raamdecoratie",
    "jaloezieen configurator",
    "houten jaloezieen",
    "aluminium jaloezieen",
    "raam inmeten",
  ],
  applicationName: siteMetadata.name,
  openGraph: {
    title: siteMetadata.title,
    description: siteMetadata.description,
    url: absoluteUrl("/"),
    siteName: siteMetadata.name,
    locale: siteMetadata.locale,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: siteMetadata.title,
    description: siteMetadata.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={balooTammudu.variable}>
      <body>{children}</body>
    </html>
  );
}
