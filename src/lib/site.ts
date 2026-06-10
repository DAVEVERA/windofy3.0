export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://windofy.nl");

export const siteMetadata = {
  name: "Windofy",
  title: "Windofy | AI-raamdecoratie configurator",
  description:
    "Meet ramen live met AI en visualiseer houten of aluminium jaloezieen direct in je eigen interieur.",
  locale: "nl_NL",
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}
