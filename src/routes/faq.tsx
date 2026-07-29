import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Questions fréquentes — Winstorr" },
      { name: "description", content: "Réponses aux questions fréquentes des clients Winstorr." },
      { property: "og:title", content: "FAQ — Questions fréquentes — Winstorr" },
      { property: "og:description", content: "Réponses aux questions fréquentes des clients Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="FAQ — Questions fréquentes" description="Réponses aux questions fréquentes des clients Winstorr." />,
});
