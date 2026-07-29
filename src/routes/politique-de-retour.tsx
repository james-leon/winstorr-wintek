import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/politique-de-retour")({
  head: () => ({
    meta: [
      { title: "Politique de retour — Winstorr" },
      { name: "description", content: "Les conditions de retour des produits achetés sur Winstorr." },
      { property: "og:title", content: "Politique de retour — Winstorr" },
      { property: "og:description", content: "Les conditions de retour des produits achetés sur Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Politique de retour" description="Les conditions de retour des produits achetés sur Winstorr." />,
});
