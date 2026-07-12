import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  rating: number;
  count?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
};

const SIZES = {
  sm: { star: "h-3.5 w-3.5", text: "text-xs" },
  md: { star: "h-4 w-4", text: "text-sm" },
  lg: { star: "h-5 w-5", text: "text-base" },
};

export function StarRating({ rating, count, size = "sm", showCount = true, className }: Props) {
  const s = SIZES[size];
  const rounded = Math.round(rating * 2) / 2;
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex" aria-label={`Note ${rating.toFixed(1)} sur 5`}>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          return (
            <span key={i} className="relative inline-block">
              <Star className={cn(s.star, "text-muted-foreground/40")} />
              {(filled || half) && (
                <span
                  className="absolute inset-0 overflow-hidden text-accent"
                  style={{ width: half ? "50%" : "100%" }}
                >
                  <Star className={cn(s.star, "fill-accent text-accent")} />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {showCount && (
        <span className={cn(s.text, "text-muted-foreground")}>
          {count && count > 0 ? (
            <>
              <span className="font-medium text-foreground">{rating.toFixed(1)}</span> ({count})
            </>
          ) : (
            "Aucun avis"
          )}
        </span>
      )}
    </div>
  );
}
