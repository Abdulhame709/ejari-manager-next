/**
 * Central SEO configuration for EJARI.
 * Update SITE_URL when a custom domain is attached.
 */
export const SITE_URL = "https://ejari-manager-eta.vercel.app";
export const SITE_NAME = "إيجاري EJARI";
export const SITE_TITLE = "إيجاري EJARI — إدارة الإيجارات بثقة";
export const SITE_DESCRIPTION =
  "إيجاري EJARI: منصة ثنائية اللغة لإدارة العقارات والمحلات التجارية والعقود والمستأجرين والفواتير والتحصيلات في اليمن.";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;

/** JSON-LD structured data (Organization + SoftwareApplication + WebSite). */
export const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: "EJARI",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon-512.png`,
        width: 512,
        height: 512,
      },
      description: SITE_DESCRIPTION,
      areaServed: { "@type": "Country", name: "Yemen" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: ["ar", "en"],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "YER",
      },
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "ar",
    },
  ],
} as const;

/** Builds a per-page <title> in the "Page — Site" convention. */
export function pageTitle(page?: string): string {
  return page ? `${page} — ${SITE_NAME}` : SITE_TITLE;
}

/** Canonical URL helper. */
export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
