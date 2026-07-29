import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Nous contacter — Winstorr" },
      { name: "description", content: "Contactez l'équipe Winstorr par téléphone, email ou WhatsApp." },
      { property: "og:title", content: "Nous contacter — Winstorr" },
      { property: "og:description", content: "Contactez l'équipe Winstorr par téléphone, email ou WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Nous contacter" description="Contactez l'équipe Winstorr par téléphone, email ou WhatsApp." />,
});
