import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos de Wintek — Winstorr" },
      { name: "description", content: "Qui est Wintek, l'entreprise derrière la marketplace Winstorr." },
      { property: "og:title", content: "À propos de Wintek — Winstorr" },
      { property: "og:description", content: "Qui est Wintek, l'entreprise derrière la marketplace Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="À propos de Wintek" description="Qui est Wintek, l'entreprise derrière la marketplace Winstorr." />,
});
