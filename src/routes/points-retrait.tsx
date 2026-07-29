import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/points-retrait")({
  head: () => ({
    meta: [
      { title: "Points de retrait — Winstorr" },
      { name: "description", content: "Les points de retrait Winstorr à Douala et ailleurs." },
      { property: "og:title", content: "Points de retrait — Winstorr" },
      { property: "og:description", content: "Les points de retrait Winstorr à Douala et ailleurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Points de retrait" description="Les points de retrait Winstorr à Douala et ailleurs." />,
});
