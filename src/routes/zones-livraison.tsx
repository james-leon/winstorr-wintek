import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/zones-livraison")({
  head: () => ({
    meta: [
      { title: "Zones de livraison — Winstorr" },
      { name: "description", content: "Les zones desservies par la livraison Winstorr." },
      { property: "og:title", content: "Zones de livraison — Winstorr" },
      { property: "og:description", content: "Les zones desservies par la livraison Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Zones de livraison" description="Les zones desservies par la livraison Winstorr." />,
});
