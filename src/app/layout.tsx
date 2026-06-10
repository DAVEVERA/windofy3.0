import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { absoluteUrl, siteMetadata, siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="nl" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
