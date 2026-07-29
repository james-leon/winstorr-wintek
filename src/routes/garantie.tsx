import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/garantie")({
  head: () => ({
    meta: [
      { title: "Garantie qualité — Winstorr" },
      { name: "description", content: "La garantie et le SAV assurés par Wintek." },
      { property: "og:title", content: "Garantie qualité — Winstorr" },
      { property: "og:description", content: "La garantie et le SAV assurés par Wintek." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Garantie qualité" description="La garantie et le SAV assurés par Wintek." />,
});
