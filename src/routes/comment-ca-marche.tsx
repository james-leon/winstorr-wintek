import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/comment-ca-marche")({
  head: () => ({
    meta: [
      { title: "Comment ça marche — Winstorr" },
      { name: "description", content: "Commander, payer et récupérer votre commande sur Winstorr." },
      { property: "og:title", content: "Comment ça marche — Winstorr" },
      { property: "og:description", content: "Commander, payer et récupérer votre commande sur Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Comment ça marche" description="Commander, payer et récupérer votre commande sur Winstorr." />,
});
