import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/cgv")({
  head: () => ({
    meta: [
      { title: "Conditions Générales de Vente — Winstorr" },
      { name: "description", content: "Les conditions générales de vente de la marketplace Winstorr." },
      { property: "og:title", content: "Conditions Générales de Vente — Winstorr" },
      { property: "og:description", content: "Les conditions générales de vente de la marketplace Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Conditions Générales de Vente" description="Les conditions générales de vente de la marketplace Winstorr." />,
});
