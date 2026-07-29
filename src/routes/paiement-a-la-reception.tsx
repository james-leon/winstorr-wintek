import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/paiement-a-la-reception")({
  head: () => ({
    meta: [
      { title: "Paiement à la réception — Winstorr" },
      { name: "description", content: "Payer votre commande Winstorr au moment du retrait." },
      { property: "og:title", content: "Paiement à la réception — Winstorr" },
      { property: "og:description", content: "Payer votre commande Winstorr au moment du retrait." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Paiement à la réception" description="Payer votre commande Winstorr au moment du retrait." />,
});
