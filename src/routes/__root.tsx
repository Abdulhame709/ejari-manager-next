import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  SITE_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  OG_IMAGE,
  STRUCTURED_DATA,
} from "@/lib/seo";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير متاحة أو تم نقلها.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => {
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
    const googleVerify = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION as string | undefined;
    const bingVerify = import.meta.env.VITE_BING_SITE_VERIFICATION as string | undefined;
    const yandexVerify = import.meta.env.VITE_YANDEX_SITE_VERIFICATION as string | undefined;

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { title: SITE_TITLE },
        { name: "description", content: SITE_DESCRIPTION },
        { name: "application-name", content: SITE_NAME },
        { name: "theme-color", content: "#0a1e3d" },
        { name: "color-scheme", content: "dark light" },
        { name: "format-detection", content: "telephone=no" },
        // Search engine verification (rendered only when configured)
        ...(googleVerify ? [{ name: "google-site-verification", content: googleVerify }] : []),
        ...(bingVerify ? [{ name: "msvalidate.01", content: bingVerify }] : []),
        ...(yandexVerify ? [{ name: "yandex-verification", content: yandexVerify }] : []),
        // Apple PWA
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: SITE_NAME },
        // Open Graph
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:title", content: SITE_TITLE },
        { property: "og:description", content: SITE_DESCRIPTION },
        { property: "og:url", content: SITE_URL },
        { property: "og:image", content: OG_IMAGE },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: SITE_NAME },
        { property: "og:locale", content: "ar_YE" },
        { property: "og:locale:alternate", content: "en_US" },
        // Twitter Cards
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: SITE_TITLE },
        { name: "twitter:description", content: SITE_DESCRIPTION },
        { name: "twitter:image", content: OG_IMAGE },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
        { rel: "manifest", href: "/site.webmanifest" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap",
        },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(STRUCTURED_DATA),
        },
        // Google Analytics 4 (only when a measurement ID is configured)
        ...(gaId
          ? [
              {
                src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`,
                async: true,
              },
              {
                children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`,
              },
            ]
          : []),
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Registers the PWA service worker in production browsers. */
function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || import.meta.env.DEV) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures (e.g. private browsing) are non-fatal.
    });
  }, []);
}

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  useServiceWorker();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
