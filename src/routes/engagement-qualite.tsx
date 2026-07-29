import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/engagement-qualite")({
  head: () => ({
    meta: [
      { title: "Notre engagement qualité — Winstorr" },
      { name: "description", content: "Comment Wintek contrôle la qualité des produits vendus sur Winstorr." },
      { property: "og:title", content: "Notre engagement qualité — Winstorr" },
      { property: "og:description", content: "Comment Wintek contrôle la qualité des produits vendus sur Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Notre engagement qualité" description="Comment Wintek contrôle la qualité des produits vendus sur Winstorr." />,
});
