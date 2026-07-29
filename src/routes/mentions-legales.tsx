import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Winstorr" },
      { name: "description", content: "Informations légales sur Wintek et la marketplace Winstorr." },
      { property: "og:title", content: "Mentions légales — Winstorr" },
      { property: "og:description", content: "Informations légales sur Wintek et la marketplace Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Mentions légales" description="Informations légales sur Wintek et la marketplace Winstorr." />,
});
