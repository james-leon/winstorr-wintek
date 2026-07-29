import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/moyens-de-paiement")({
  head: () => ({
    meta: [
      { title: "Moyens de paiement — Winstorr" },
      { name: "description", content: "MTN Mobile Money, Orange Money et carte bancaire sur Winstorr." },
      { property: "og:title", content: "Moyens de paiement — Winstorr" },
      { property: "og:description", content: "MTN Mobile Money, Orange Money et carte bancaire sur Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Moyens de paiement" description="MTN Mobile Money, Orange Money et carte bancaire sur Winstorr." />,
});
