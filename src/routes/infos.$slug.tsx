import { createFileRoute } from "@tanstack/react-router";
import { INFO_PAGES } from "@/lib/site-content";
import { ContentPageView, ContentNotFound } from "@/components/content-page-view";

export const Route = createFileRoute("/infos/$slug")({
  head: ({ params }) => {
    const p = INFO_PAGES[params.slug];
    if (!p) {
      return { meta: [{ title: "Page introuvable — Winstorr" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${p.title} — Winstorr`;
    return {
      meta: [
        { title },
        { name: "description", content: p.description },
        { property: "og:title", content: title },
        { property: "og:description", content: p.description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: InfoPage,
});

function InfoPage() {
  const { slug } = Route.useParams();
  const page = INFO_PAGES[slug];
  if (!page) return <ContentNotFound />;
  return <ContentPageView page={page} />;
}
