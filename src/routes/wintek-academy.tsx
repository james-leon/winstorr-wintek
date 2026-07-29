import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/wintek-academy")({
  head: () => ({
    meta: [
      { title: "Wintek Academy — Winstorr" },
      { name: "description", content: "Les formations techniques proposées par Wintek." },
      { property: "og:title", content: "Wintek Academy — Winstorr" },
      { property: "og:description", content: "Les formations techniques proposées par Wintek." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Wintek Academy" description="Les formations techniques proposées par Wintek." />,
});
