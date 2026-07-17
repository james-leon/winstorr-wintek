import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Client-side pagination hook.
 * Slices a filtered array into pages. Automatically resets to page 1
 * when the total item count changes (i.e. when filters/search change).
 */
export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Reset to page 1 when the filtered set shrinks below current page window
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const start = (page - 1) * pageSize;
  const paged = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  return {
    page,
    setPage,
    pageCount,
    pageSize,
    total,
    paged,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, total),
  };
}

type Props = {
  page: number;
  pageCount: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (p: number) => void;
  label?: string;
  className?: string;
};

/**
 * Compact pagination bar: "X–Y sur Z" + prev/next + numbered pages.
 * Renders nothing when there's a single page (still shows the count line).
 */
export function Pagination({
  page, pageCount, total, rangeStart, rangeEnd, onPageChange, label = "résultats", className,
}: Props) {
  if (total === 0) return null;

  const nums = pageNumbers(page, pageCount);

  return (
    <div className={cn("mt-3 flex flex-wrap items-center justify-between gap-3 text-sm", className)}>
      <div className="text-muted-foreground">
        {rangeStart}–{rangeEnd} sur <span className="font-medium text-foreground">{total}</span> {label}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Page précédente">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {nums.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
            ) : (
              <button
                key={n}
                onClick={() => onPageChange(n)}
                className={cn(
                  "h-8 min-w-8 rounded-sm border px-2 text-xs font-medium",
                  n === page
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                {n}
              </button>
            ),
          )}
          <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Page suivante">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function pageNumbers(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}
