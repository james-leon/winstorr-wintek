import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Base URL — resolved from the request at serve time when possible so the
// sitemap stays correct regardless of the deployed domain.
function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const STATIC_ENTRIES: { path: string; priority: string; changefreq: string }[] = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/catalogue", priority: "0.9", changefreq: "daily" },
  { path: "/catalogue?type=physical", priority: "0.8", changefreq: "daily" },
  { path: "/catalogue?type=digital", priority: "0.8", changefreq: "daily" },
  { path: "/catalogue?type=service", priority: "0.8", changefreq: "daily" },
  { path: "/catalogue?type=training", priority: "0.8", changefreq: "daily" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
        const host = request.headers.get("host") ?? url.host;
        const base = `${proto}://${host}`;

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: products } = await supabase
          .from("products")
          .select("slug, updated_at")
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(5000);

        const entries: string[] = [];
        for (const e of STATIC_ENTRIES) {
          entries.push(
            `  <url>\n    <loc>${xmlEscape(base + e.path)}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
          );
        }
        for (const p of products ?? []) {
          entries.push(
            `  <url>\n    <loc>${xmlEscape(`${base}/produits/${p.slug}`)}</loc>\n    <lastmod>${new Date(p.updated_at).toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
          );
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
