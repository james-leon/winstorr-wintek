import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import { iconForCategory } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

export type SidebarCategory = {
  id: string;
  name: string;
  slug: string;
  product_type: string | null;
  children: { id: string; name: string; slug: string; product_type: string | null }[];
};

const VISIBLE = 10;

function searchFor(c: { slug: string; product_type: string | null }): Record<string, unknown> {
  return c.product_type ? { type: c.product_type, category: c.slug } : { category: c.slug };
}

/** Desktop / tablet departments column with hover flyout for sub-categories. */
export function CategorySidebar({ categories }: { categories: SidebarCategory[] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  if (categories.length === 0) return null;
  const shown = expanded ? categories : categories.slice(0, VISIBLE);
  const hasMore = categories.length > VISIBLE;

  return (
    <nav
      aria-label={t("home.allCategories")}
      className="relative hidden lg:block"
      onMouseLeave={() => setHovered(null)}
    >
      <div className="overflow-hidden rounded-[var(--radius-r-lg)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-blue-soft)] px-3 py-2.5">
          <LayoutGrid className="h-4 w-4" style={{ color: "var(--color-blue-brand)" }} strokeWidth={2.2} />
          <span className="font-heading text-[13px] font-extrabold tracking-tight text-[var(--color-ink)]">
            {t("home.allCategories")}
          </span>
        </div>

        <ul className="py-1">
          {shown.map((c) => {
            const Icon = iconForCategory(c.slug);
            const active = hovered === c.id;
            return (
              <li key={c.id} onMouseEnter={() => setHovered(c.id)}>
                <Link
                  to="/catalogue"
                  search={searchFor(c) as never}
                  className={cn(
                    "no-link-color flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-[var(--color-ink)] transition-colors",
                    active && "bg-[var(--color-blue-soft)] text-[var(--color-blue-brand)]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {c.children.length > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted-ink)]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full border-t border-[var(--color-line)] px-3 py-2 text-left text-[12px] font-semibold text-[var(--color-blue-brand)] hover:bg-[var(--color-blue-soft)]"
          >
            {expanded ? t("home.seeLess") : t("home.seeMore")}
          </button>
        )}
      </div>

      {/* Flyout */}
      {(() => {
        const cat = shown.find((c) => c.id === hovered && c.children.length > 0);
        if (!cat) return null;
        return (
          <div className="absolute left-full top-0 z-30 ml-2 w-[420px] rounded-[var(--radius-r-lg)] border border-[var(--color-line)] bg-white p-3 shadow-[var(--shadow-lift)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-heading text-[13px] font-extrabold text-[var(--color-ink)]">{cat.name}</span>
              <Link
                to="/catalogue"
                search={searchFor(cat) as never}
                className="text-[11px] font-semibold text-[var(--color-blue-brand)]"
              >
                {t("home.seeAll")}
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {cat.children.map((sub) => (
                <li key={sub.id}>
                  <Link
                    to="/catalogue"
                    search={searchFor(sub) as never}
                    className="no-link-color block truncate rounded-[var(--radius-r)] px-2 py-1.5 text-[12.5px] text-[var(--color-ink)] hover:bg-[var(--color-blue-soft)] hover:text-[var(--color-blue-brand)]"
                  >
                    {sub.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
    </nav>
  );
}

/** Mobile / tablet fallback: horizontal scrollable chip row. */
export function CategoryChipRow({ categories }: { categories: SidebarCategory[] }) {
  if (categories.length === 0) return null;
  return (
    <div className="lg:hidden -mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2 pb-1">
        {categories.map((c) => {
          const Icon = iconForCategory(c.slug);
          return (
            <Link
              key={c.id}
              to="/catalogue"
              search={searchFor(c) as never}
              className="no-link-color inline-flex items-center gap-1.5 rounded-[var(--radius-r-pill,999px)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--color-ink)] shadow-[var(--shadow-soft)]"
            >
              <Icon className="h-3.5 w-3.5" style={{ color: "var(--color-blue-brand)" }} strokeWidth={2.2} />
              {c.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
