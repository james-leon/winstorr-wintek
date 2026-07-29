import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartProvider } from "@/lib/cart-context";
import { AuthProvider } from "@/lib/auth-context";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-6xl text-primary">404</h1>
        <p className="mt-3 text-muted-foreground">Cette page n'existe pas ou a été déplacée.</p>
        <a href="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl text-foreground">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">Réessayez ou revenez à l'accueil.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Réessayer
          </button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium">
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Winstorr — Marketplace de confiance au Cameroun | Électronique, Services, Formations" },
      { name: "description", content: "Winstorr par Wintek : achetez du matériel électronique, des produits numériques, réservez un service technique ou inscrivez-vous à nos formations. Qualité vérifiée, paiement MoMo & Orange Money." },
      { property: "og:site_name", content: "Winstorr" },
      { property: "og:title", content: "Winstorr — Marketplace de confiance au Cameroun | Électronique, Services, Formations" },
      { property: "og:description", content: "Winstorr par Wintek : achetez du matériel électronique, des produits numériques, réservez un service technique ou inscrivez-vous à nos formations. Qualité vérifiée, paiement MoMo & Orange Money." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "fr_FR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#14161A" },
      { name: "twitter:title", content: "Winstorr — Marketplace de confiance au Cameroun | Électronique, Services, Formations" },
      { name: "twitter:description", content: "Winstorr par Wintek : achetez du matériel électronique, des produits numériques, réservez un service technique ou inscrivez-vous à nos formations. Qualité vérifiée, paiement MoMo & Orange Money." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/21f209cc-79ce-4a2b-90c2-2a53dc8c2ca0" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/21f209cc-79ce-4a2b-90c2-2a53dc8c2ca0" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Russo+One&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Winstorr",
          alternateName: "Wintek — Winner Technology",
          url: "/",
          logo: "/favicon.png",
          description: "Marketplace tech du Cameroun opérée par Wintek : électronique, produits numériques, services techniques et formations.",
          areaServed: "CM",
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            areaServed: "CM",
            availableLanguage: ["French"],
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <CartProvider>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <main className="flex-1">
                <Outlet />
              </main>
              <SiteFooter />
            </div>
            <Toaster richColors position="top-right" />
          </CartProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
