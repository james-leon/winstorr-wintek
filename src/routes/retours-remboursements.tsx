import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/retours-remboursements")({
  head: () => ({
    meta: [
      { title: "Retours & remboursements — Winstorr" },
      { name: "description", content: "Comment demander un retour ou un remboursement sur Winstorr." },
      { property: "og:title", content: "Retours & remboursements — Winstorr" },
      { property: "og:description", content: "Comment demander un retour ou un remboursement sur Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Retours & remboursements" description="Comment demander un retour ou un remboursement sur Winstorr." />,
});
