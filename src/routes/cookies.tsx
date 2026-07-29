import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookies — Winstorr" },
      { name: "description", content: "L'utilisation des cookies sur Winstorr." },
      { property: "og:title", content: "Cookies — Winstorr" },
      { property: "og:description", content: "L'utilisation des cookies sur Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Cookies" description="L'utilisation des cookies sur Winstorr." />,
});
