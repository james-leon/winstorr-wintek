import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Winstorr" },
      { name: "description", content: "Comment Winstorr traite et protège vos données personnelles." },
      { property: "og:title", content: "Politique de confidentialité — Winstorr" },
      { property: "og:description", content: "Comment Winstorr traite et protège vos données personnelles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PlaceholderPage title="Politique de confidentialité" description="Comment Winstorr traite et protège vos données personnelles." />,
});
