import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/signaler-un-probleme")({
  head: () => ({
    meta: [
      { title: "Signaler un problème — Winstorr" },
      { name: "description", content: "Signalez un produit, un vendeur ou une commande problématique." },
      { property: "og:title", content: "Signaler un problème — Winstorr" },
      { property: "og:description", content: "Signalez un produit, un vendeur ou une commande problématique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Signaler un problème" description="Signalez un produit, un vendeur ou une commande problématique." />,
});
